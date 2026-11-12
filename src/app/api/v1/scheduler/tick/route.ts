import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ensureSystemSeeded } from "@/lib/seed-service";
import { apiError, apiSuccess } from "@/lib/api-response";
import { runSchedulerTick, verifySchedulerToken } from "@/services/automation/job-scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function unauthorized() {
  return apiError(
    "UNAUTHORIZED_SCHEDULER",
    "Valid 'Authorization: Bearer <SCHEDULER_SECRET>' header required",
    401
  );
}

/**
 * POST /api/v1/scheduler/tick
 * Called by an external scheduler (GitHub Actions, cron-job.org, self-hosted worker).
 * Short-running: enqueues due jobs only. Optional `?process=N` (max 5) runs a tiny batch.
 */
export async function POST(req: NextRequest) {
  if (!verifySchedulerToken(req.headers.get("authorization"))) return unauthorized();
  await ensureSystemSeeded();

  const source = (req.headers.get("x-scheduler-source") || "external").slice(0, 64);
  const processParam = Number(req.nextUrl.searchParams.get("process") || 0);

  try {
    const result = await runSchedulerTick({
      triggeredBy: source,
      processBatchSize: Number.isFinite(processParam) ? processParam : 0
    });
    return apiSuccess(result);
  } catch (err) {
    return apiError(
      "SCHEDULER_TICK_FAILED",
      err instanceof Error ? err.message : "Scheduler tick failed",
      500
    );
  }
}

/** GET /api/v1/scheduler/tick — schedule + recent run status (same secret required). */
export async function GET(req: NextRequest) {
  if (!verifySchedulerToken(req.headers.get("authorization"))) return unauthorized();
  await ensureSystemSeeded();
  const db = await getDb();
  const [schedules, recentRuns, queue] = await Promise.all([
    db.jobSchedule.findMany({ orderBy: [{ websiteId: "asc" }, { priority: "asc" }] }),
    db.schedulerRun.findMany({ orderBy: { startedAt: "desc" }, take: 20 }),
    db.durableJob.groupBy({ by: ["status"], _count: { _all: true } })
  ]);
  return apiSuccess({
    schedules,
    recentRuns,
    queue: queue.map((q) => ({ status: q.status, count: q._count._all }))
  });
}
