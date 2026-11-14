import { describe, it, expect, beforeAll } from "vitest";
import { getAutomationRepository } from "../src/repositories/automation-repository.factory";
import { migrateAutomationToMongo } from "../src/services/migration/automation-migration-engine";
import { ensureSystemSeeded } from "../src/lib/seed-service";

describe("Phase H — MongoDB Automation Engine & Scheduler Migration", () => {
  const repo = getAutomationRepository();
  const testWebsiteId = "test-site-auto-" + Date.now();

  beforeAll(async () => {
    await ensureSystemSeeded();
    await repo.initIndexes();
  }, 60000);

  it("migrates existing PostgreSQL workflows, executions, jobs, schedules, and runs idempotently", async () => {
    // Dry-run
    const dryRun = await migrateAutomationToMongo({ dryRun: true });
    expect(dryRun.dryRun).toBe(true);
    expect(dryRun.errors.length).toBe(0);

    // Live migration
    const live = await migrateAutomationToMongo({ dryRun: false });
    expect(live.dryRun).toBe(false);
    expect(live.errors.length).toBe(0);

    // Idempotent second live migration
    const rerun = await migrateAutomationToMongo({ dryRun: false });
    expect(rerun.errors.length).toBe(0);
    expect(rerun.workflowsInserted).toBe(0);
    expect(rerun.executionsInserted).toBe(0);
    expect(rerun.jobsInserted).toBe(0);
    expect(rerun.schedulesInserted).toBe(0);
  }, 60000);

  describe("AutomationWorkflow & AutomationExecution CRUD", () => {
    it("creates, queries, updates, and deletes automation workflows and executions", async () => {
      const slug = "test-wf-" + Date.now();
      const workflow = await repo.createWorkflow({
        websiteId: testWebsiteId,
        name: "Test Automation Workflow",
        slug,
        description: "Integration test pipeline",
        workflowType: "INTERNAL_CRON",
        scheduleCron: "0 * * * *",
        maxRetries: 3
      });

      expect(workflow.id).toBeDefined();
      expect(workflow.slug).toBe(slug);
      expect(workflow.status).toBe("IDLE");

      // Query by ID and Slug
      const byId = await repo.findWorkflowById(workflow.id);
      expect(byId?.name).toBe("Test Automation Workflow");
      const bySlug = await repo.findWorkflowBySlug(slug);
      expect(bySlug?.id).toBe(workflow.id);

      // Create execution under this workflow
      const execution = await repo.createExecution({
        workflowId: workflow.id,
        status: "RUNNING",
        triggerSource: "SCHEDULED",
        attemptNumber: 1,
        inputPayload: { siteId: testWebsiteId }
      });
      expect(execution.id).toBeDefined();
      expect(execution.status).toBe("RUNNING");

      // Update execution to SUCCESS
      const finished = await repo.updateExecution(execution.id, {
        status: "SUCCESS",
        finishedAt: new Date(),
        durationMs: 450,
        outputResult: { processed: 10 }
      });
      expect(finished?.status).toBe("SUCCESS");
      expect(finished?.durationMs).toBe(450);

      // Query executions for workflow
      const execList = await repo.findExecutions({ workflowId: workflow.id });
      expect(execList.length).toBe(1);

      // Delete workflow (cascades executions)
      const deleted = await repo.deleteWorkflow(workflow.id);
      expect(deleted).toBe(true);

      const afterDeleteWf = await repo.findWorkflowById(workflow.id);
      expect(afterDeleteWf).toBeNull();
      const afterDeleteExec = await repo.findExecutionById(execution.id);
      expect(afterDeleteExec).toBeNull();
    });
  });

  describe("DurableJob Atomic Claiming, Concurrency & Recovery", () => {
    it("enqueues, atomically claims, recovers, and completes durable jobs", async () => {
      const key = "test-durable-" + Date.now();
      const job = await repo.createDurableJob({
        websiteId: testWebsiteId,
        jobType: "AI_ARTICLE_GENERATION",
        idempotencyKey: key,
        status: "QUEUED",
        priority: 50,
        payload: { title: "Durable Test Article" },
        nextRetryAt: new Date(Date.now() - 5000), // Due now
        maxAttempts: 2
      });

      expect(job.id).toBeDefined();
      expect(job.idempotencyKey).toBe(key);

      // Claim job atomically by Worker A
      const claimedA = await repo.claimNextDurableJob("worker-A", 100); // 100ms lease
      expect(claimedA).not.toBeNull();
      expect(claimedA?.id).toBe(job.id);
      expect(claimedA?.status).toBe("RUNNING");
      expect(claimedA?.attempts).toBe(1);

      // Worker B tries to claim at the same time: should get null because Worker A holds lock
      const claimedB = await repo.claimNextDurableJob("worker-B", 1000);
      expect(claimedB).toBeNull();

      // Wait 150ms for Worker A's lease to expire
      await new Promise((r) => setTimeout(r, 150));

      // Recover stalled jobs
      const recoveredCount = await repo.recoverStalledDurableJobs(new Date());
      expect(recoveredCount).toBeGreaterThanOrEqual(1);

      // Worker B can now claim the recovered job
      const claimedAfterRecovery = await repo.claimNextDurableJob("worker-B", 60000);
      expect(claimedAfterRecovery?.id).toBe(job.id);
      expect(claimedAfterRecovery?.attempts).toBe(2);

      // Worker B completes the job
      const completed = await repo.completeDurableJob(job.id, { articleId: "art-123" });
      expect(completed?.status).toBe("COMPLETED");
      expect(completed?.completedAt).toBeDefined();

      // Counts verification
      const statusCounts = await repo.getDurableJobStatusCounts(testWebsiteId);
      expect(statusCounts.COMPLETED).toBeGreaterThanOrEqual(1);
    });
  });

  describe("JobSchedule & SchedulerRun", () => {
    it("handles recurring schedules, optimistic slot locking, and scheduler run history", async () => {
      const schedKey = "sched-test-" + Date.now();
      const initialNextRun = new Date(Date.now() - 10000); // due 10s ago

      const schedule = await repo.createSchedule({
        key: schedKey,
        jobType: "AUTOMATED_PUBLISHING",
        websiteId: testWebsiteId,
        intervalMinutes: 15,
        priority: 25,
        nextRunAt: initialNextRun
      });

      expect(schedule.id).toBeDefined();
      expect(schedule.key).toBe(schedKey);

      // Find due schedules
      const due = await repo.findDueSchedules(new Date());
      const targetDue = due.find((s) => s.key === schedKey);
      expect(targetDue).toBeDefined();

      // Optimistic lock claim: Worker A claims slot
      const newNextRun = new Date(Date.now() + 15 * 60_000);
      const claimedA = await repo.claimScheduleSlot(schedKey, initialNextRun, newNextRun);
      expect(claimedA).toBe(true);

      // Worker B tries to claim the same slot with old initialNextRun: fails
      const claimedB = await repo.claimScheduleSlot(schedKey, initialNextRun, newNextRun);
      expect(claimedB).toBe(false);

      // Record SchedulerRun
      const run = await repo.createSchedulerRun({
        triggeredBy: "vitest-test-runner",
        status: "RUNNING"
      });
      expect(run.id).toBeDefined();
      expect(run.status).toBe("RUNNING");

      const completedRun = await repo.updateSchedulerRun(run.id, {
        status: "COMPLETED",
        dueSchedules: 1,
        enqueuedCount: 1,
        finishedAt: new Date()
      });
      expect(completedRun?.status).toBe("COMPLETED");
      expect(completedRun?.dueSchedules).toBe(1);

      // Query history
      const runs = await repo.findSchedulerRuns(5);
      expect(runs.length).toBeGreaterThanOrEqual(1);
    });
  });
});
