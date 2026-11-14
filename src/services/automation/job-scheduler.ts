/**
 * EXTERNAL SCHEDULER SERVICE (Vercel Hobby compatible)
 *
 * Vercel Hobby only allows cron jobs that run at most once per day. All sub-daily
 * recurring work is therefore driven by an EXTERNAL trigger (GitHub Actions cron,
 * cron-job.org, or the self-hosted automation worker) that calls a short, secret-
 * protected tick. The tick itself only:
 *   1. recovers expired worker leases,
 *   2. finds due PostgreSQL `JobSchedule` rows (optimistic-locked so concurrent
 *      triggers never double-enqueue),
 *   3. idempotently enqueues `DurableJob` rows (time-bucketed idempotency keys),
 *   4. optionally processes a small bounded batch (0 by default on Vercel),
 *   5. records a `SchedulerRun` audit row.
 * Long-running execution stays in the separately deployed worker.
 */
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";
import {
  DurableJobType,
  EnqueueJobResult,
  enqueueDurableJob,
  processDurableJobBatch,
  recoverStalledJobs
} from "./durable-job-queue";
import { getArticleRepository } from "@/repositories/article-repository.factory";

export interface DefaultScheduleSpec {
  jobType: DurableJobType;
  intervalMinutes: number;
  priority: number;
  /** Content-producing schedules are opt-in to avoid scaled/low-value content. */
  enabledByDefault: boolean;
  payload?: Record<string, unknown>;
}

export const DEFAULT_SCHEDULES: DefaultScheduleSpec[] = [
  { jobType: "SEO_AUDITING", intervalMinutes: 60, priority: 30, enabledByDefault: true },
  { jobType: "SEARCH_PERFORMANCE_MONITORING", intervalMinutes: 180, priority: 20, enabledByDefault: true },
  { jobType: "AUTOMATED_PUBLISHING", intervalMinutes: 30, priority: 10, enabledByDefault: true },
  { jobType: "KEYWORD_RESEARCH", intervalMinutes: 360, priority: 40, enabledByDefault: true },
  { jobType: "ADSENSE_COMPLIANCE_AUDITING", intervalMinutes: 720, priority: 40, enabledByDefault: true },
  // Opt-in: generation runs only when an operator enables it (human-in-the-loop policy).
  { jobType: "AI_ARTICLE_GENERATION", intervalMinutes: 720, priority: 50, enabledByDefault: false },
  { jobType: "IMAGE_GENERATION", intervalMinutes: 720, priority: 50, enabledByDefault: false }
];

export function getSchedulerSecret(): string | null {
  return process.env.SCHEDULER_SECRET || process.env.CRON_SECRET || null;
}

/** Constant-time Bearer token check. Rejects everything when no secret is configured. */
export function verifySchedulerToken(authorizationHeader: string | null): boolean {
  const secret = getSchedulerSecret();
  if (!secret || !authorizationHeader?.startsWith("Bearer ")) return false;
  const provided = Buffer.from(authorizationHeader.slice(7));
  const expected = Buffer.from(secret);
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

export function scheduleKey(jobType: string, websiteId: string | null): string {
  return `${jobType.toLowerCase()}:${websiteId || "global"}`;
}

/** Idempotently creates default schedules for every ACTIVE website (never overwrites operator edits). */
export async function ensureDefaultSchedules(): Promise<number> {
  const db = await getDb();
  const sites = await db.website.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  let created = 0;
  for (const site of sites) {
    for (const spec of DEFAULT_SCHEDULES) {
      const key = scheduleKey(spec.jobType, site.id);
      const exists = await db.jobSchedule.findUnique({ where: { key } });
      if (exists) continue;
      await db.jobSchedule.create({
        data: {
          key,
          jobType: spec.jobType,
          websiteId: site.id,
          intervalMinutes: spec.intervalMinutes,
          priority: spec.priority,
          isEnabled: spec.enabledByDefault,
          nextRunAt: new Date(0), // due on the first tick
          payload: (spec.payload || {}) as Prisma.InputJsonValue
        }
      });
      created++;
    }
  }
  return created;
}

export interface SchedulerTickResult {
  runId: string;
  triggeredBy: string;
  recoveredLocks: number;
  dueSchedules: number;
  enqueuedCount: number;
  deduplicatedCount: number;
  processedCount: number;
  jobs: EnqueueJobResult[];
}

/**
 * Executes one scheduler tick. Safe to call concurrently and repeatedly:
 * schedules are claimed with an optimistic compare-and-set on `nextRunAt`,
 * and enqueued jobs use time-bucketed idempotency keys.
 */
export async function runSchedulerTick(params: {
  triggeredBy: string;
  now?: Date;
  processBatchSize?: number;
  workerId?: string;
}): Promise<SchedulerTickResult> {
  const db = await getDb();
  const now = params.now ?? new Date();
  const run = await db.schedulerRun.create({ data: { triggeredBy: params.triggeredBy } });

  try {
    await ensureDefaultSchedules();
    const recoveredLocks = await recoverStalledJobs();

    const due = await db.jobSchedule.findMany({
      where: { isEnabled: true, nextRunAt: { lte: now } },
      orderBy: { priority: "asc" }
    });

    const jobs: EnqueueJobResult[] = [];
    let claimedCount = 0;

    for (const schedule of due) {
      // Optimistic lock: only one concurrent trigger can advance this schedule.
      const nextRunAt = new Date(now.getTime() + schedule.intervalMinutes * 60_000);
      const claim = await db.jobSchedule.updateMany({
        where: { id: schedule.id, nextRunAt: schedule.nextRunAt },
        data: { nextRunAt, lastRunAt: now }
      });
      if (claim.count === 0) continue;
      claimedCount++;

      // Slot-based idempotency: the claimed `nextRunAt` uniquely identifies this run slot.
      const bucket = schedule.nextRunAt.getTime();
      const baseKey = `sched:${schedule.key}:${bucket}`;
      const basePayload = {
        ...((schedule.payload as Record<string, unknown>) || {}),
        websiteId: schedule.websiteId,
        scheduleKey: schedule.key,
        scheduledBucket: bucket
      };
      const produced: EnqueueJobResult[] = [];

      if (schedule.jobType === "AUTOMATED_PUBLISHING") {
        // Only APPROVED articles are eligible; the publishing gate still re-validates each one.
        const articleRepo = getArticleRepository();
        const approved = schedule.websiteId
          ? await articleRepo.findArticlesByWebsite(schedule.websiteId, {
              status: "APPROVED",
              limit: 10
            })
          : [];
        for (const art of approved) {
          produced.push(
            await enqueueDurableJob({
              websiteId: schedule.websiteId,
              jobType: "AUTOMATED_PUBLISHING",
              idempotencyKey: `sched-publish:${art.id}`,
              priority: schedule.priority,
              payload: { ...basePayload, articleId: art.id, requireHumanApproval: false }
            })
          );
        }
      } else {
        produced.push(
          await enqueueDurableJob({
            websiteId: schedule.websiteId,
            jobType: schedule.jobType as DurableJobType,
            idempotencyKey: baseKey,
            priority: schedule.priority,
            payload: basePayload
          })
        );
      }

      await db.jobSchedule.update({
        where: { id: schedule.id },
        data: { lastJobCount: produced.filter((j) => !j.deduplicated).length }
      });
      jobs.push(...produced);
    }

    let processedCount = 0;
    const batchSize = Math.min(5, Math.max(0, params.processBatchSize ?? 0));
    if (batchSize > 0) {
      const batch = await processDurableJobBatch({
        workerId: params.workerId || `scheduler-${params.triggeredBy}`,
        maxBatchSize: batchSize
      });
      processedCount = batch.processedCount;
    }

    const result: SchedulerTickResult = {
      runId: run.id,
      triggeredBy: params.triggeredBy,
      recoveredLocks,
      dueSchedules: claimedCount,
      enqueuedCount: jobs.filter((j) => !j.deduplicated).length,
      deduplicatedCount: jobs.filter((j) => j.deduplicated).length,
      processedCount,
      jobs
    };

    await db.schedulerRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        recoveredLocks,
        dueSchedules: claimedCount,
        enqueuedCount: result.enqueuedCount,
        deduplicatedCount: result.deduplicatedCount,
        processedCount,
        finishedAt: new Date()
      }
    });
    return result;
  } catch (err) {
    await db.schedulerRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        errorLog: err instanceof Error ? err.message : String(err),
        finishedAt: new Date()
      }
    });
    throw err;
  }
}
