import { getDb } from "@/lib/db";
import { getAutomationRepository } from "@/repositories/automation-repository.factory";
import {
  CreateAutomationExecutionInput,
  CreateAutomationWorkflowInput,
  CreateDurableJobInput,
  CreateJobScheduleInput,
  CreateSchedulerRunInput
} from "@/repositories/automation-repository.types";

export interface AutomationMigrationOptions {
  dryRun?: boolean;
}

export interface AutomationMigrationResult {
  dryRun: boolean;
  workflowsSourceCount: number;
  workflowsInserted: number;
  workflowsSkipped: number;
  executionsSourceCount: number;
  executionsInserted: number;
  executionsSkipped: number;
  jobsSourceCount: number;
  jobsInserted: number;
  jobsSkipped: number;
  schedulesSourceCount: number;
  schedulesInserted: number;
  schedulesSkipped: number;
  schedulerRunsSourceCount: number;
  schedulerRunsInserted: number;
  schedulerRunsSkipped: number;
  errors: Array<{ entity: string; id: string; error: string }>;
}

export async function migrateAutomationToMongo(
  options: AutomationMigrationOptions = {}
): Promise<AutomationMigrationResult> {
  const dryRun = Boolean(options.dryRun);
  const db = await getDb();
  const repo = getAutomationRepository();

  if (!dryRun) {
    await repo.initIndexes();
  }

  // 1. Fetch source rows from PostgreSQL
  const [workflows, executions, durableJobs, schedules, schedulerRuns] = await Promise.all([
    db.automationWorkflow.findMany({ orderBy: { createdAt: "asc" } }),
    db.automationExecution.findMany({ orderBy: { createdAt: "asc" } }),
    db.durableJob.findMany({ orderBy: { createdAt: "asc" } }),
    db.jobSchedule.findMany({ orderBy: { createdAt: "asc" } }),
    db.schedulerRun.findMany({ orderBy: { startedAt: "asc" } })
  ]);

  const result: AutomationMigrationResult = {
    dryRun,
    workflowsSourceCount: workflows.length,
    workflowsInserted: 0,
    workflowsSkipped: 0,
    executionsSourceCount: executions.length,
    executionsInserted: 0,
    executionsSkipped: 0,
    jobsSourceCount: durableJobs.length,
    jobsInserted: 0,
    jobsSkipped: 0,
    schedulesSourceCount: schedules.length,
    schedulesInserted: 0,
    schedulesSkipped: 0,
    schedulerRunsSourceCount: schedulerRuns.length,
    schedulerRunsInserted: 0,
    schedulerRunsSkipped: 0,
    errors: []
  };

  // 2. Migrate Workflows
  for (const wf of workflows) {
    try {
      const existing = await repo.findWorkflowById(wf.id);
      if (existing) {
        result.workflowsSkipped++;
        continue;
      }
      if (!dryRun) {
        const input: CreateAutomationWorkflowInput = {
          id: wf.id,
          websiteId: wf.websiteId,
          name: wf.name,
          slug: wf.slug,
          description: wf.description,
          workflowType: wf.workflowType,
          n8nWorkflowId: wf.n8nWorkflowId,
          webhookUrl: wf.webhookUrl,
          scheduleCron: wf.scheduleCron,
          isEnabled: wf.isEnabled,
          status: wf.status,
          maxRetries: wf.maxRetries,
          retryBackoffMs: wf.retryBackoffMs,
          config: wf.config as Record<string, unknown>,
          lastRunAt: wf.lastRunAt,
          nextRunAt: wf.nextRunAt
        };
        await repo.createWorkflow(input);
      }
      result.workflowsInserted++;
    } catch (err) {
      result.errors.push({
        entity: "AutomationWorkflow",
        id: wf.id,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  // 3. Migrate Executions
  for (const exec of executions) {
    try {
      const existing = await repo.findExecutionById(exec.id);
      if (existing) {
        result.executionsSkipped++;
        continue;
      }
      if (!dryRun) {
        const input: CreateAutomationExecutionInput = {
          id: exec.id,
          workflowId: exec.workflowId,
          status: exec.status,
          triggerSource: exec.triggerSource,
          attemptNumber: exec.attemptNumber,
          startedAt: exec.startedAt,
          finishedAt: exec.finishedAt,
          durationMs: exec.durationMs,
          inputPayload: exec.inputPayload as Record<string, unknown>,
          outputResult: exec.outputResult as Record<string, unknown>,
          errorLog: exec.errorLog
        };
        await repo.createExecution(input);
      }
      result.executionsInserted++;
    } catch (err) {
      result.errors.push({
        entity: "AutomationExecution",
        id: exec.id,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  // 4. Migrate DurableJobs
  for (const job of durableJobs) {
    try {
      const existing = await repo.findDurableJobById(job.id);
      if (existing) {
        result.jobsSkipped++;
        continue;
      }
      if (!dryRun) {
        const input: CreateDurableJobInput = {
          id: job.id,
          websiteId: job.websiteId,
          jobType: job.jobType,
          idempotencyKey: job.idempotencyKey,
          status: job.status,
          priority: job.priority,
          payload: job.payload as Record<string, unknown>,
          result: job.result as Record<string, unknown>,
          errorLog: job.errorLog,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
          nextRetryAt: job.nextRetryAt,
          lockedBy: job.lockedBy,
          lockedUntil: job.lockedUntil,
          startedAt: job.startedAt,
          completedAt: job.completedAt
        };
        await repo.createDurableJob(input);
      }
      result.jobsInserted++;
    } catch (err) {
      result.errors.push({
        entity: "DurableJob",
        id: job.id,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  // 5. Migrate JobSchedules
  for (const sched of schedules) {
    try {
      const existing = await repo.findScheduleById(sched.id);
      if (existing) {
        result.schedulesSkipped++;
        continue;
      }
      if (!dryRun) {
        const input: CreateJobScheduleInput = {
          id: sched.id,
          key: sched.key,
          jobType: sched.jobType,
          websiteId: sched.websiteId,
          intervalMinutes: sched.intervalMinutes,
          priority: sched.priority,
          payload: sched.payload as Record<string, unknown>,
          isEnabled: sched.isEnabled,
          nextRunAt: sched.nextRunAt,
          lastRunAt: sched.lastRunAt,
          lastJobCount: sched.lastJobCount
        };
        await repo.createSchedule(input);
      }
      result.schedulesInserted++;
    } catch (err) {
      result.errors.push({
        entity: "JobSchedule",
        id: sched.id,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  // 6. Migrate SchedulerRuns
  for (const run of schedulerRuns) {
    try {
      const input: CreateSchedulerRunInput = {
        id: run.id,
        triggeredBy: run.triggeredBy,
        status: run.status,
        recoveredLocks: run.recoveredLocks,
        dueSchedules: run.dueSchedules,
        enqueuedCount: run.enqueuedCount,
        deduplicatedCount: run.deduplicatedCount,
        processedCount: run.processedCount,
        errorLog: run.errorLog,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt
      };
      if (!dryRun) {
        await repo.createSchedulerRun(input);
      }
      result.schedulerRunsInserted++;
    } catch (err) {
      result.errors.push({
        entity: "SchedulerRun",
        id: run.id,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  return result;
}
