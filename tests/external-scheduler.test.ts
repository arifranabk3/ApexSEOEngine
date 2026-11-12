import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ensureSystemSeeded } from "@/lib/seed-service";
import {
  enqueueDurableJob,
  processDurableJobById,
  processDurableJobBatch
} from "@/services/automation/durable-job-queue";
import {
  DEFAULT_SCHEDULES,
  runSchedulerTick,
  scheduleKey,
  verifySchedulerToken
} from "@/services/automation/job-scheduler";
import { GET as tickGet, POST as tickPost } from "@/app/api/v1/scheduler/tick/route";

const SECRET = "test-scheduler-secret-0123456789abcdef";
process.env.SCHEDULER_SECRET = SECRET;

function tickRequest(token?: string, query = "") {
  const headers = new Headers({ "X-Scheduler-Source": "vitest" });
  if (token !== undefined) headers.set("Authorization", `Bearer ${token}`);
  return new NextRequest(`http://localhost:3000/api/v1/scheduler/tick${query}`, {
    method: "POST",
    headers
  });
}

describe("Vercel Hobby External Scheduler (PostgreSQL-backed) Suite", () => {
  let websiteId = "";

  beforeAll(async () => {
    await ensureSystemSeeded();
    const db = await getDb();
    websiteId = (await db.website.findFirst({ where: { status: "ACTIVE" } }))!.id;
  });

  it("vercel.json contains no cron more frequent than once per day (Hobby limit)", () => {
    const cfg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "vercel.json"), "utf8"));
    for (const cron of cfg.crons || []) {
      const [minute, hour, dom, month, dow] = String(cron.schedule).split(/\s+/);
      expect(minute).toMatch(/^\d+$/);
      expect(hour).toMatch(/^\d+$/);
      expect([dom, month, dow].every((f) => f === "*")).toBe(true);
    }
  });

  it("rejects missing, wrong, and unconfigured scheduler secrets", async () => {
    expect((await tickPost(tickRequest())).status).toBe(401);
    expect((await tickPost(tickRequest("wrong-secret"))).status).toBe(401);

    const saved = process.env.SCHEDULER_SECRET;
    const savedCron = process.env.CRON_SECRET;
    delete process.env.SCHEDULER_SECRET;
    delete process.env.CRON_SECRET;
    expect(verifySchedulerToken(`Bearer ${SECRET}`)).toBe(false);
    process.env.SCHEDULER_SECRET = saved;
    if (savedCron) process.env.CRON_SECRET = savedCron;

    expect(verifySchedulerToken(`Bearer ${SECRET}`)).toBe(true);
  });

  it("creates default schedules, enqueues due jobs, keeps content generation opt-in, and logs the run", async () => {
    const res = await tickPost(tickRequest(SECRET));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);

    const db = await getDb();
    const schedules = await db.jobSchedule.findMany({ where: { websiteId } });
    expect(schedules.length).toBe(DEFAULT_SCHEDULES.length);

    const aiGen = schedules.find((s) => s.jobType === "AI_ARTICLE_GENERATION")!;
    expect(aiGen.isEnabled).toBe(false);
    const seo = schedules.find((s) => s.jobType === "SEO_AUDITING")!;
    expect(seo.nextRunAt.getTime()).toBeGreaterThan(Date.now());

    const run = await db.schedulerRun.findUnique({ where: { id: json.data.runId } });
    expect(run?.status).toBe("COMPLETED");
    expect(run?.triggeredBy).toBe("vitest");

    // Immediate re-trigger: nothing is due anymore, so no duplicate enqueue.
    const again = await (await tickPost(tickRequest(SECRET))).json();
    expect(again.data.dueSchedules).toBe(0);
    expect(again.data.enqueuedCount).toBe(0);
  });

  it("prevents double-enqueue when two external triggers fire concurrently", async () => {
    const db = await getDb();
    const key = scheduleKey("SEO_AUDITING", websiteId);
    const past = new Date(Date.now() - 1000);
    await db.jobSchedule.update({ where: { key }, data: { nextRunAt: past } });
    const fixedNow = new Date();

    const [a, b] = await Promise.all([
      runSchedulerTick({ triggeredBy: "trigger-a", now: fixedNow }),
      runSchedulerTick({ triggeredBy: "trigger-b", now: fixedNow })
    ]);
    const seoJobsEnqueued = [...a.jobs, ...b.jobs].filter(
      (j) => j.jobType === "SEO_AUDITING" && !j.deduplicated
    );
    expect(seoJobsEnqueued.length).toBe(1);
    expect(a.dueSchedules + b.dueSchedules).toBe(1);
  });

  it("runs the full scheduled workflow end to end: generate -> approve -> scheduled publish -> worker -> PUBLISHED", async () => {
    const db = await getDb();
    const slug = `scheduler-e2e-${Date.now()}`;

    // Opt-in content generation schedule
    const genKey = scheduleKey("AI_ARTICLE_GENERATION", websiteId);
    await db.jobSchedule.update({
      where: { key: genKey },
      data: {
        isEnabled: true,
        nextRunAt: new Date(Date.now() - 1000),
        payload: { title: "Scheduler End-to-End Verified Guide", slug }
      }
    });

    const genTick = await runSchedulerTick({ triggeredBy: "e2e-gen" });
    const genJob = genTick.jobs.find((j) => j.jobType === "AI_ARTICLE_GENERATION")!;
    expect(genJob).toBeTruthy();
    const genDone = await processDurableJobById(genJob.jobId, "e2e-worker");
    expect(genDone.status).toBe("COMPLETED");
    const articleId = (genDone.result as { articleId: string }).articleId;

    // Generated content is a DRAFT; a human approves it.
    const draft = await db.article.findUnique({ where: { id: articleId } });
    expect(draft?.status).toBe("DRAFT");
    await db.article.update({ where: { id: articleId }, data: { status: "APPROVED" } });
    await db.jobSchedule.update({ where: { key: genKey }, data: { isEnabled: false } });

    // External trigger over HTTP picks up the approved article.
    await db.jobSchedule.update({
      where: { key: scheduleKey("AUTOMATED_PUBLISHING", websiteId) },
      data: { nextRunAt: new Date(Date.now() - 1000) }
    });
    const tickJson = await (await tickPost(tickRequest(SECRET))).json();
    const pubJob = (tickJson.data.jobs as Array<{ jobId: string; jobType: string }>).find(
      (j) => j.jobType === "AUTOMATED_PUBLISHING"
    )!;
    expect(pubJob).toBeTruthy();

    // Standalone worker drains the queue (bounded batches).
    for (let i = 0; i < 10; i++) {
      const job = await db.durableJob.findUnique({ where: { id: pubJob.jobId } });
      if (job?.status === "COMPLETED" || job?.status === "DEAD_LETTER") break;
      await processDurableJobBatch({ workerId: "e2e-standalone-worker", maxBatchSize: 25 });
    }

    const finishedJob = await db.durableJob.findUnique({ where: { id: pubJob.jobId } });
    expect(finishedJob?.status).toBe("COMPLETED");
    const published = await db.article.findUnique({ where: { id: articleId } });
    expect(published?.status).toBe("PUBLISHED");
    expect(published?.publishedUrl).toContain(slug);

    // Idempotency: a later tick must not re-enqueue publishing for the same article.
    const dup = await enqueueDurableJob({
      websiteId,
      jobType: "AUTOMATED_PUBLISHING",
      idempotencyKey: `sched-publish:${articleId}`
    });
    expect(dup.deduplicated).toBe(true);
  });

  it("records failures with retry then dead-letter for scheduled jobs", async () => {
    const job = await enqueueDurableJob({
      websiteId,
      jobType: "SEARCH_PERFORMANCE_MONITORING",
      idempotencyKey: `sched-fail-${Date.now()}`,
      maxAttempts: 2,
      payload: { simulateFailure: true, failUntilAttempt: 9 }
    });
    expect((await processDurableJobById(job.jobId, "w")).status).toBe("RETRY_SCHEDULED");
    const final = await processDurableJobById(job.jobId, "w");
    expect(final.status).toBe("DEAD_LETTER");
    expect(final.errorLog).toContain("Simulated");
  });

  it("exposes schedule + run status behind the same secret", async () => {
    const denied = await tickGet(
      new NextRequest("http://localhost:3000/api/v1/scheduler/tick", { headers: new Headers() })
    );
    expect(denied.status).toBe(401);

    const ok = await tickGet(
      new NextRequest("http://localhost:3000/api/v1/scheduler/tick", {
        headers: new Headers({ Authorization: `Bearer ${SECRET}` })
      })
    );
    const json = await ok.json();
    expect(ok.status).toBe(200);
    expect(json.data.schedules.length).toBeGreaterThan(0);
    expect(json.data.recentRuns.length).toBeGreaterThan(0);
  });
});
