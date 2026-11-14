import { Collection, Document } from "mongodb";
import { getMongoDb } from "@/lib/mongodb";
import { randomUUID } from "crypto";
import {
  AutomationExecutionEntity,
  AutomationExecutionEntitySchema,
  AutomationWorkflowEntity,
  AutomationWorkflowEntitySchema,
  CreateAutomationExecutionInput,
  CreateAutomationWorkflowInput,
  CreateDurableJobInput,
  CreateJobScheduleInput,
  CreateSchedulerRunInput,
  DurableJobEntity,
  DurableJobEntitySchema,
  IAutomationRepository,
  JobScheduleEntity,
  JobScheduleEntitySchema,
  SchedulerRunEntity,
  SchedulerRunEntitySchema,
  UpdateAutomationExecutionInput,
  UpdateAutomationWorkflowInput,
  UpdateDurableJobInput,
  UpdateJobScheduleInput,
  UpdateSchedulerRunInput
} from "./automation-repository.types";

interface MongoWorkflowDoc extends Document {
  id: string;
  websiteId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  workflowType: string;
  n8nWorkflowId?: string | null;
  webhookUrl?: string | null;
  scheduleCron?: string | null;
  isEnabled: boolean;
  status: string;
  maxRetries: number;
  retryBackoffMs: number;
  config: unknown;
  lastRunAt?: Date | null;
  nextRunAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MongoExecutionDoc extends Document {
  id: string;
  workflowId: string;
  status: string;
  triggerSource: string;
  attemptNumber: number;
  startedAt: Date;
  finishedAt?: Date | null;
  durationMs?: number | null;
  inputPayload: unknown;
  outputResult: unknown;
  errorLog?: string | null;
  createdAt: Date;
}

interface MongoDurableJobDoc extends Document {
  id: string;
  websiteId?: string | null;
  jobType: string;
  idempotencyKey: string;
  status: string;
  priority: number;
  payload: unknown;
  result?: unknown;
  errorLog?: string | null;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: Date;
  lockedBy?: string | null;
  lockedUntil?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MongoJobScheduleDoc extends Document {
  id: string;
  key: string;
  jobType: string;
  websiteId?: string | null;
  intervalMinutes: number;
  priority: number;
  payload: unknown;
  isEnabled: boolean;
  nextRunAt: Date;
  lastRunAt?: Date | null;
  lastJobCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface MongoSchedulerRunDoc extends Document {
  id: string;
  triggeredBy: string;
  status: string;
  recoveredLocks: number;
  dueSchedules: number;
  enqueuedCount: number;
  deduplicatedCount: number;
  processedCount: number;
  errorLog?: string | null;
  startedAt: Date;
  finishedAt?: Date | null;
}

export class MongoAutomationRepository implements IAutomationRepository {
  private async getWorkflowColl(): Promise<Collection<MongoWorkflowDoc>> {
    const db = await getMongoDb();
    return db.collection<MongoWorkflowDoc>("automation_workflows");
  }

  private async getExecutionColl(): Promise<Collection<MongoExecutionDoc>> {
    const db = await getMongoDb();
    return db.collection<MongoExecutionDoc>("automation_executions");
  }

  private async getDurableJobColl(): Promise<Collection<MongoDurableJobDoc>> {
    const db = await getMongoDb();
    return db.collection<MongoDurableJobDoc>("durable_jobs");
  }

  private async getScheduleColl(): Promise<Collection<MongoJobScheduleDoc>> {
    const db = await getMongoDb();
    return db.collection<MongoJobScheduleDoc>("job_schedules");
  }

  private async getSchedulerRunColl(): Promise<Collection<MongoSchedulerRunDoc>> {
    const db = await getMongoDb();
    return db.collection<MongoSchedulerRunDoc>("scheduler_runs");
  }

  async initIndexes(): Promise<void> {
    const [wfColl, execColl, jobColl, schedColl, runColl] = await Promise.all([
      this.getWorkflowColl(),
      this.getExecutionColl(),
      this.getDurableJobColl(),
      this.getScheduleColl(),
      this.getSchedulerRunColl()
    ]);

    await Promise.all([
      // AutomationWorkflow
      wfColl.createIndex({ id: 1 }, { unique: true, name: "uniq_workflow_id" }),
      wfColl.createIndex({ slug: 1 }, { unique: true, name: "uniq_workflow_slug" }),
      wfColl.createIndex({ websiteId: 1 }, { name: "idx_workflow_websiteId" }),
      wfColl.createIndex({ status: 1 }, { name: "idx_workflow_status" }),
      wfColl.createIndex({ isEnabled: 1 }, { name: "idx_workflow_isEnabled" }),

      // AutomationExecution
      execColl.createIndex({ id: 1 }, { unique: true, name: "uniq_execution_id" }),
      execColl.createIndex({ workflowId: 1, status: 1 }, { name: "idx_execution_workflow_status" }),
      execColl.createIndex({ startedAt: -1 }, { name: "idx_execution_startedAt" }),

      // DurableJob
      jobColl.createIndex({ id: 1 }, { unique: true, name: "uniq_durable_job_id" }),
      jobColl.createIndex({ idempotencyKey: 1 }, { unique: true, name: "uniq_durable_job_key" }),
      jobColl.createIndex({ status: 1, nextRetryAt: 1, priority: -1 }, { name: "idx_durable_job_polling" }),
      jobColl.createIndex({ websiteId: 1, jobType: 1 }, { name: "idx_durable_job_website_type" }),
      jobColl.createIndex({ lockedUntil: 1 }, { name: "idx_durable_job_lockedUntil" }),

      // JobSchedule
      schedColl.createIndex({ id: 1 }, { unique: true, name: "uniq_job_schedule_id" }),
      schedColl.createIndex({ key: 1 }, { unique: true, name: "uniq_job_schedule_key" }),
      schedColl.createIndex({ isEnabled: 1, nextRunAt: 1 }, { name: "idx_job_schedule_due" }),
      schedColl.createIndex({ websiteId: 1 }, { name: "idx_job_schedule_websiteId" }),

      // SchedulerRun
      runColl.createIndex({ id: 1 }, { unique: true, name: "uniq_scheduler_run_id" }),
      runColl.createIndex({ startedAt: -1 }, { name: "idx_scheduler_run_startedAt" })
    ]);
  }

  // --- Mappers ---
  private mapWorkflow(doc: MongoWorkflowDoc): AutomationWorkflowEntity {
    return AutomationWorkflowEntitySchema.parse({
      id: doc.id,
      websiteId: doc.websiteId ?? null,
      name: doc.name,
      slug: doc.slug,
      description: doc.description ?? null,
      workflowType: doc.workflowType || "N8N_WEBHOOK",
      n8nWorkflowId: doc.n8nWorkflowId ?? null,
      webhookUrl: doc.webhookUrl ?? null,
      scheduleCron: doc.scheduleCron ?? null,
      isEnabled: doc.isEnabled ?? true,
      status: doc.status || "IDLE",
      maxRetries: doc.maxRetries ?? 3,
      retryBackoffMs: doc.retryBackoffMs ?? 5000,
      config: doc.config ?? {},
      lastRunAt: doc.lastRunAt ?? null,
      nextRunAt: doc.nextRunAt ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    });
  }

  private mapExecution(doc: MongoExecutionDoc): AutomationExecutionEntity {
    return AutomationExecutionEntitySchema.parse({
      id: doc.id,
      workflowId: doc.workflowId,
      status: doc.status || "RUNNING",
      triggerSource: doc.triggerSource || "MANUAL",
      attemptNumber: doc.attemptNumber ?? 1,
      startedAt: doc.startedAt,
      finishedAt: doc.finishedAt ?? null,
      durationMs: doc.durationMs ?? null,
      inputPayload: doc.inputPayload ?? {},
      outputResult: doc.outputResult ?? {},
      errorLog: doc.errorLog ?? null,
      createdAt: doc.createdAt
    });
  }

  private mapDurableJob(doc: MongoDurableJobDoc): DurableJobEntity {
    return DurableJobEntitySchema.parse({
      id: doc.id,
      websiteId: doc.websiteId ?? null,
      jobType: doc.jobType,
      idempotencyKey: doc.idempotencyKey,
      status: doc.status || "QUEUED",
      priority: doc.priority ?? 10,
      payload: doc.payload ?? {},
      result: doc.result ?? null,
      errorLog: doc.errorLog ?? null,
      attempts: doc.attempts ?? 0,
      maxAttempts: doc.maxAttempts ?? 3,
      nextRetryAt: doc.nextRetryAt,
      lockedBy: doc.lockedBy ?? null,
      lockedUntil: doc.lockedUntil ?? null,
      startedAt: doc.startedAt ?? null,
      completedAt: doc.completedAt ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    });
  }

  private mapSchedule(doc: MongoJobScheduleDoc): JobScheduleEntity {
    return JobScheduleEntitySchema.parse({
      id: doc.id,
      key: doc.key,
      jobType: doc.jobType,
      websiteId: doc.websiteId ?? null,
      intervalMinutes: doc.intervalMinutes,
      priority: doc.priority ?? 20,
      payload: doc.payload ?? {},
      isEnabled: doc.isEnabled ?? true,
      nextRunAt: doc.nextRunAt,
      lastRunAt: doc.lastRunAt ?? null,
      lastJobCount: doc.lastJobCount ?? 0,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    });
  }

  private mapSchedulerRun(doc: MongoSchedulerRunDoc): SchedulerRunEntity {
    return SchedulerRunEntitySchema.parse({
      id: doc.id,
      triggeredBy: doc.triggeredBy,
      status: doc.status || "RUNNING",
      recoveredLocks: doc.recoveredLocks ?? 0,
      dueSchedules: doc.dueSchedules ?? 0,
      enqueuedCount: doc.enqueuedCount ?? 0,
      deduplicatedCount: doc.deduplicatedCount ?? 0,
      processedCount: doc.processedCount ?? 0,
      errorLog: doc.errorLog ?? null,
      startedAt: doc.startedAt,
      finishedAt: doc.finishedAt ?? null
    });
  }

  // ============================================================================
  // AutomationWorkflow Operations
  // ============================================================================

  async createWorkflow(input: CreateAutomationWorkflowInput): Promise<AutomationWorkflowEntity> {
    const coll = await this.getWorkflowColl();
    const id = input.id || randomUUID();
    const now = new Date();

    const doc: MongoWorkflowDoc = {
      id,
      websiteId: input.websiteId ?? null,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      workflowType: input.workflowType || "N8N_WEBHOOK",
      n8nWorkflowId: input.n8nWorkflowId ?? null,
      webhookUrl: input.webhookUrl ?? null,
      scheduleCron: input.scheduleCron ?? null,
      isEnabled: input.isEnabled ?? true,
      status: input.status || "IDLE",
      maxRetries: input.maxRetries ?? 3,
      retryBackoffMs: input.retryBackoffMs ?? 5000,
      config: input.config ?? {},
      lastRunAt: input.lastRunAt ? new Date(input.lastRunAt) : null,
      nextRunAt: input.nextRunAt ? new Date(input.nextRunAt) : null,
      createdAt: now,
      updatedAt: now
    };

    await coll.insertOne(doc);
    return this.mapWorkflow(doc);
  }

  async findWorkflowById(id: string): Promise<AutomationWorkflowEntity | null> {
    const coll = await this.getWorkflowColl();
    const doc = await coll.findOne({ id });
    return doc ? this.mapWorkflow(doc) : null;
  }

  async findWorkflowBySlug(slug: string): Promise<AutomationWorkflowEntity | null> {
    const coll = await this.getWorkflowColl();
    const doc = await coll.findOne({ slug });
    return doc ? this.mapWorkflow(doc) : null;
  }

  async findWorkflowsByWebsite(websiteId?: string | null): Promise<AutomationWorkflowEntity[]> {
    const coll = await this.getWorkflowColl();
    const query: Record<string, unknown> = {};
    if (websiteId) query.websiteId = websiteId;

    const docs = await coll.find(query).sort({ createdAt: -1 }).toArray();
    return docs.map((d) => this.mapWorkflow(d));
  }

  async updateWorkflow(id: string, updates: UpdateAutomationWorkflowInput): Promise<AutomationWorkflowEntity | null> {
    const coll = await this.getWorkflowColl();
    const now = new Date();

    const setFields: Record<string, unknown> = { updatedAt: now };
    if (updates.websiteId !== undefined) setFields.websiteId = updates.websiteId;
    if (updates.name !== undefined) setFields.name = updates.name;
    if (updates.slug !== undefined) setFields.slug = updates.slug;
    if (updates.description !== undefined) setFields.description = updates.description;
    if (updates.workflowType !== undefined) setFields.workflowType = updates.workflowType;
    if (updates.n8nWorkflowId !== undefined) setFields.n8nWorkflowId = updates.n8nWorkflowId;
    if (updates.webhookUrl !== undefined) setFields.webhookUrl = updates.webhookUrl;
    if (updates.scheduleCron !== undefined) setFields.scheduleCron = updates.scheduleCron;
    if (updates.isEnabled !== undefined) setFields.isEnabled = updates.isEnabled;
    if (updates.status !== undefined) setFields.status = updates.status;
    if (updates.maxRetries !== undefined) setFields.maxRetries = updates.maxRetries;
    if (updates.retryBackoffMs !== undefined) setFields.retryBackoffMs = updates.retryBackoffMs;
    if (updates.config !== undefined) setFields.config = updates.config;
    if (updates.lastRunAt !== undefined) {
      setFields.lastRunAt = updates.lastRunAt ? new Date(updates.lastRunAt) : null;
    }
    if (updates.nextRunAt !== undefined) {
      setFields.nextRunAt = updates.nextRunAt ? new Date(updates.nextRunAt) : null;
    }

    const res = await coll.findOneAndUpdate(
      { id },
      { $set: setFields },
      { returnDocument: "after" }
    );
    return res ? this.mapWorkflow(res) : null;
  }

  async upsertWorkflow(input: CreateAutomationWorkflowInput): Promise<AutomationWorkflowEntity> {
    const coll = await this.getWorkflowColl();
    const existing = await coll.findOne({ slug: input.slug });
    if (existing) {
      const updated = await this.updateWorkflow(existing.id, {
        name: input.name,
        description: input.description,
        workflowType: input.workflowType,
        webhookUrl: input.webhookUrl,
        scheduleCron: input.scheduleCron,
        isEnabled: input.isEnabled,
        status: input.status,
        config: input.config
      });
      return updated!;
    }
    return this.createWorkflow(input);
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    const wfColl = await this.getWorkflowColl();
    const execColl = await this.getExecutionColl();

    const res = await wfColl.deleteOne({ id });
    if ((res.deletedCount ?? 0) > 0) {
      await execColl.deleteMany({ workflowId: id });
      return true;
    }
    return false;
  }

  async countWorkflows(filter?: { websiteId?: string | null; isEnabled?: boolean }): Promise<number> {
    const coll = await this.getWorkflowColl();
    const query: Record<string, unknown> = {};
    if (filter?.websiteId !== undefined) query.websiteId = filter.websiteId;
    if (filter?.isEnabled !== undefined) query.isEnabled = filter.isEnabled;
    return coll.countDocuments(query);
  }

  // ============================================================================
  // AutomationExecution Operations
  // ============================================================================

  async createExecution(input: CreateAutomationExecutionInput): Promise<AutomationExecutionEntity> {
    const coll = await this.getExecutionColl();
    const id = input.id || randomUUID();
    const now = new Date();
    const startedAt = input.startedAt ? new Date(input.startedAt) : now;
    const finishedAt = input.finishedAt ? new Date(input.finishedAt) : null;

    const doc: MongoExecutionDoc = {
      id,
      workflowId: input.workflowId,
      status: input.status || "RUNNING",
      triggerSource: input.triggerSource || "MANUAL",
      attemptNumber: input.attemptNumber ?? 1,
      startedAt,
      finishedAt,
      durationMs: input.durationMs ?? null,
      inputPayload: input.inputPayload ?? {},
      outputResult: input.outputResult ?? {},
      errorLog: input.errorLog ?? null,
      createdAt: now
    };

    await coll.insertOne(doc);
    return this.mapExecution(doc);
  }

  async findExecutionById(id: string): Promise<AutomationExecutionEntity | null> {
    const coll = await this.getExecutionColl();
    const doc = await coll.findOne({ id });
    return doc ? this.mapExecution(doc) : null;
  }

  async findExecutions(filter?: { workflowId?: string; limit?: number; offset?: number }): Promise<AutomationExecutionEntity[]> {
    const coll = await this.getExecutionColl();
    const query: Record<string, unknown> = {};
    if (filter?.workflowId) query.workflowId = filter.workflowId;

    let cursor = coll.find(query).sort({ startedAt: -1 });
    if (filter?.offset) cursor = cursor.skip(filter.offset);
    if (filter?.limit) cursor = cursor.limit(filter.limit);

    const docs = await cursor.toArray();
    return docs.map((d) => this.mapExecution(d));
  }

  async updateExecution(id: string, updates: UpdateAutomationExecutionInput): Promise<AutomationExecutionEntity | null> {
    const coll = await this.getExecutionColl();
    const setFields: Record<string, unknown> = {};
    if (updates.status !== undefined) setFields.status = updates.status;
    if (updates.finishedAt !== undefined) {
      setFields.finishedAt = updates.finishedAt ? new Date(updates.finishedAt) : null;
    }
    if (updates.durationMs !== undefined) setFields.durationMs = updates.durationMs;
    if (updates.outputResult !== undefined) setFields.outputResult = updates.outputResult;
    if (updates.errorLog !== undefined) setFields.errorLog = updates.errorLog;

    const res = await coll.findOneAndUpdate(
      { id },
      { $set: setFields },
      { returnDocument: "after" }
    );
    return res ? this.mapExecution(res) : null;
  }

  async deleteExecutionsByWorkflow(workflowId: string): Promise<number> {
    const coll = await this.getExecutionColl();
    const res = await coll.deleteMany({ workflowId });
    return res.deletedCount ?? 0;
  }

  // ============================================================================
  // DurableJob Operations & Concurrency
  // ============================================================================

  async createDurableJob(input: CreateDurableJobInput): Promise<DurableJobEntity> {
    const coll = await this.getDurableJobColl();
    const id = input.id || randomUUID();
    const now = new Date();
    const nextRetryAt = input.nextRetryAt ? new Date(input.nextRetryAt) : now;

    const doc: MongoDurableJobDoc = {
      id,
      websiteId: input.websiteId ?? null,
      jobType: input.jobType,
      idempotencyKey: input.idempotencyKey,
      status: input.status || "QUEUED",
      priority: input.priority ?? 10,
      payload: input.payload ?? {},
      result: input.result ?? null,
      errorLog: input.errorLog ?? null,
      attempts: input.attempts ?? 0,
      maxAttempts: input.maxAttempts ?? 3,
      nextRetryAt,
      lockedBy: input.lockedBy ?? null,
      lockedUntil: input.lockedUntil ? new Date(input.lockedUntil) : null,
      startedAt: input.startedAt ? new Date(input.startedAt) : null,
      completedAt: input.completedAt ? new Date(input.completedAt) : null,
      createdAt: now,
      updatedAt: now
    };

    await coll.insertOne(doc);
    return this.mapDurableJob(doc);
  }

  async findDurableJobById(id: string): Promise<DurableJobEntity | null> {
    const coll = await this.getDurableJobColl();
    const doc = await coll.findOne({ id });
    return doc ? this.mapDurableJob(doc) : null;
  }

  async findDurableJobByIdempotencyKey(idempotencyKey: string): Promise<DurableJobEntity | null> {
    const coll = await this.getDurableJobColl();
    const doc = await coll.findOne({ idempotencyKey });
    return doc ? this.mapDurableJob(doc) : null;
  }

  async findDurableJobs(filter?: { websiteId?: string | null; status?: string; limit?: number; offset?: number }): Promise<DurableJobEntity[]> {
    const coll = await this.getDurableJobColl();
    const query: Record<string, unknown> = {};
    if (filter?.websiteId !== undefined) query.websiteId = filter.websiteId;
    if (filter?.status) query.status = filter.status;

    let cursor = coll.find(query).sort({ createdAt: -1 });
    if (filter?.offset) cursor = cursor.skip(filter.offset);
    if (filter?.limit) cursor = cursor.limit(filter.limit);

    const docs = await cursor.toArray();
    return docs.map((d) => this.mapDurableJob(d));
  }

  async updateDurableJob(id: string, updates: UpdateDurableJobInput): Promise<DurableJobEntity | null> {
    const coll = await this.getDurableJobColl();
    const now = new Date();

    const setFields: Record<string, unknown> = { updatedAt: now };
    if (updates.status !== undefined) setFields.status = updates.status;
    if (updates.priority !== undefined) setFields.priority = updates.priority;
    if (updates.payload !== undefined) setFields.payload = updates.payload;
    if (updates.result !== undefined) setFields.result = updates.result;
    if (updates.errorLog !== undefined) setFields.errorLog = updates.errorLog;
    if (updates.attempts !== undefined) setFields.attempts = updates.attempts;
    if (updates.maxAttempts !== undefined) setFields.maxAttempts = updates.maxAttempts;
    if (updates.nextRetryAt !== undefined) {
      setFields.nextRetryAt = new Date(updates.nextRetryAt);
    }
    if (updates.lockedBy !== undefined) setFields.lockedBy = updates.lockedBy;
    if (updates.lockedUntil !== undefined) {
      setFields.lockedUntil = updates.lockedUntil ? new Date(updates.lockedUntil) : null;
    }
    if (updates.startedAt !== undefined) {
      setFields.startedAt = updates.startedAt ? new Date(updates.startedAt) : null;
    }
    if (updates.completedAt !== undefined) {
      setFields.completedAt = updates.completedAt ? new Date(updates.completedAt) : null;
    }

    const res = await coll.findOneAndUpdate(
      { id },
      { $set: setFields },
      { returnDocument: "after" }
    );
    return res ? this.mapDurableJob(res) : null;
  }

  async countDurableJobs(filter?: { websiteId?: string | null; status?: string }): Promise<number> {
    const coll = await this.getDurableJobColl();
    const query: Record<string, unknown> = {};
    if (filter?.websiteId !== undefined) query.websiteId = filter.websiteId;
    if (filter?.status) query.status = filter.status;
    return coll.countDocuments(query);
  }

  async getDurableJobStatusCounts(websiteId?: string | null): Promise<Record<string, number>> {
    const coll = await this.getDurableJobColl();
    const match: Record<string, unknown> = {};
    if (websiteId) match.websiteId = websiteId;

    const pipeline = [
      { $match: match },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ];

    const results = await coll.aggregate<{ _id: string; count: number }>(pipeline).toArray();
    const counts: Record<string, number> = {
      QUEUED: 0,
      RUNNING: 0,
      COMPLETED: 0,
      RETRY_SCHEDULED: 0,
      DEAD_LETTER: 0
    };

    for (const r of results) {
      if (r._id) counts[r._id] = r.count;
    }
    return counts;
  }

  async recoverStalledDurableJobs(now: Date): Promise<number> {
    const coll = await this.getDurableJobColl();
    const res = await coll.updateMany(
      {
        status: "RUNNING",
        lockedUntil: { $lt: now }
      },
      {
        $set: {
          status: "QUEUED",
          lockedBy: null,
          lockedUntil: null,
          updatedAt: now
        }
      }
    );
    return res.modifiedCount ?? 0;
  }

  async claimNextDurableJob(workerId: string, lockDurationMs: number): Promise<DurableJobEntity | null> {
    const coll = await this.getDurableJobColl();
    const now = new Date();
    const lockedUntil = new Date(now.getTime() + lockDurationMs);

    const res = await coll.findOneAndUpdate(
      {
        $or: [
          { status: "QUEUED", nextRetryAt: { $lte: now } },
          { status: "RETRY_SCHEDULED", nextRetryAt: { $lte: now } },
          { status: "RUNNING", lockedUntil: { $lt: now } }
        ]
      },
      {
        $set: {
          status: "RUNNING",
          lockedBy: workerId,
          lockedUntil,
          startedAt: now,
          updatedAt: now
        },
        $inc: { attempts: 1 }
      },
      {
        sort: { priority: -1, nextRetryAt: 1 },
        returnDocument: "after"
      }
    );

    return res ? this.mapDurableJob(res) : null;
  }

  async completeDurableJob(id: string, result: unknown): Promise<DurableJobEntity | null> {
    const coll = await this.getDurableJobColl();
    const now = new Date();

    const res = await coll.findOneAndUpdate(
      { id, status: "RUNNING" },
      {
        $set: {
          status: "COMPLETED",
          result: result ?? {},
          completedAt: now,
          lockedBy: null,
          lockedUntil: null,
          updatedAt: now
        }
      },
      { returnDocument: "after" }
    );
    return res ? this.mapDurableJob(res) : null;
  }

  async failDurableJob(id: string, errorLog: string, retryDelayMs?: number): Promise<DurableJobEntity | null> {
    const coll = await this.getDurableJobColl();
    const now = new Date();

    const current = await coll.findOne({ id });
    if (!current) return null;

    const willRetry = current.attempts < current.maxAttempts && Boolean(retryDelayMs);
    const nextStatus = willRetry ? "RETRY_SCHEDULED" : "DEAD_LETTER";
    const nextRetryAt = willRetry
      ? new Date(now.getTime() + (retryDelayMs || 60000))
      : current.nextRetryAt;

    const res = await coll.findOneAndUpdate(
      { id },
      {
        $set: {
          status: nextStatus,
          nextRetryAt,
          errorLog,
          lockedBy: null,
          lockedUntil: null,
          updatedAt: now
        }
      },
      { returnDocument: "after" }
    );
    return res ? this.mapDurableJob(res) : null;
  }

  // ============================================================================
  // JobSchedule Operations
  // ============================================================================

  async createSchedule(input: CreateJobScheduleInput): Promise<JobScheduleEntity> {
    const coll = await this.getScheduleColl();
    const id = input.id || randomUUID();
    const now = new Date();
    const nextRunAt = input.nextRunAt ? new Date(input.nextRunAt) : now;

    const doc: MongoJobScheduleDoc = {
      id,
      key: input.key,
      jobType: input.jobType,
      websiteId: input.websiteId ?? null,
      intervalMinutes: input.intervalMinutes,
      priority: input.priority ?? 20,
      payload: input.payload ?? {},
      isEnabled: input.isEnabled ?? true,
      nextRunAt,
      lastRunAt: input.lastRunAt ? new Date(input.lastRunAt) : null,
      lastJobCount: input.lastJobCount ?? 0,
      createdAt: now,
      updatedAt: now
    };

    await coll.insertOne(doc);
    return this.mapSchedule(doc);
  }

  async findScheduleById(id: string): Promise<JobScheduleEntity | null> {
    const coll = await this.getScheduleColl();
    const doc = await coll.findOne({ id });
    return doc ? this.mapSchedule(doc) : null;
  }

  async findScheduleByKey(key: string): Promise<JobScheduleEntity | null> {
    const coll = await this.getScheduleColl();
    const doc = await coll.findOne({ key });
    return doc ? this.mapSchedule(doc) : null;
  }

  async findDueSchedules(now: Date): Promise<JobScheduleEntity[]> {
    const coll = await this.getScheduleColl();
    const docs = await coll
      .find({ isEnabled: true, nextRunAt: { $lte: now } })
      .sort({ priority: -1, nextRunAt: 1 })
      .toArray();
    return docs.map((d) => this.mapSchedule(d));
  }

  async findAllSchedules(websiteId?: string | null): Promise<JobScheduleEntity[]> {
    const coll = await this.getScheduleColl();
    const query: Record<string, unknown> = {};
    if (websiteId) query.websiteId = websiteId;

    const docs = await coll.find(query).sort({ websiteId: 1, priority: 1 }).toArray();
    return docs.map((d) => this.mapSchedule(d));
  }

  async updateSchedule(id: string, updates: UpdateJobScheduleInput): Promise<JobScheduleEntity | null> {
    const coll = await this.getScheduleColl();
    const now = new Date();

    const setFields: Record<string, unknown> = { updatedAt: now };
    if (updates.jobType !== undefined) setFields.jobType = updates.jobType;
    if (updates.websiteId !== undefined) setFields.websiteId = updates.websiteId;
    if (updates.intervalMinutes !== undefined) setFields.intervalMinutes = updates.intervalMinutes;
    if (updates.priority !== undefined) setFields.priority = updates.priority;
    if (updates.payload !== undefined) setFields.payload = updates.payload;
    if (updates.isEnabled !== undefined) setFields.isEnabled = updates.isEnabled;
    if (updates.nextRunAt !== undefined) setFields.nextRunAt = new Date(updates.nextRunAt);
    if (updates.lastRunAt !== undefined) {
      setFields.lastRunAt = updates.lastRunAt ? new Date(updates.lastRunAt) : null;
    }
    if (updates.lastJobCount !== undefined) setFields.lastJobCount = updates.lastJobCount;

    const res = await coll.findOneAndUpdate(
      { id },
      { $set: setFields },
      { returnDocument: "after" }
    );
    return res ? this.mapSchedule(res) : null;
  }

  async upsertSchedule(input: CreateJobScheduleInput): Promise<JobScheduleEntity> {
    const coll = await this.getScheduleColl();
    const existing = await coll.findOne({ key: input.key });
    if (existing) {
      const updated = await this.updateSchedule(existing.id, {
        jobType: input.jobType,
        websiteId: input.websiteId,
        intervalMinutes: input.intervalMinutes,
        priority: input.priority,
        payload: input.payload,
        isEnabled: input.isEnabled,
        nextRunAt: input.nextRunAt,
        lastRunAt: input.lastRunAt,
        lastJobCount: input.lastJobCount
      });
      return updated!;
    }
    return this.createSchedule(input);
  }

  async claimScheduleSlot(key: string, expectedNextRunAt: Date, newNextRunAt: Date): Promise<boolean> {
    const coll = await this.getScheduleColl();
    const now = new Date();

    const res = await coll.updateOne(
      {
        key,
        nextRunAt: expectedNextRunAt
      },
      {
        $set: {
          nextRunAt: newNextRunAt,
          lastRunAt: now,
          updatedAt: now
        }
      }
    );

    return (res.modifiedCount ?? 0) > 0;
  }

  // ============================================================================
  // SchedulerRun Operations
  // ============================================================================

  async createSchedulerRun(input: CreateSchedulerRunInput): Promise<SchedulerRunEntity> {
    const coll = await this.getSchedulerRunColl();
    const id = input.id || randomUUID();
    const now = new Date();
    const startedAt = input.startedAt ? new Date(input.startedAt) : now;

    const doc: MongoSchedulerRunDoc = {
      id,
      triggeredBy: input.triggeredBy,
      status: input.status || "RUNNING",
      recoveredLocks: input.recoveredLocks ?? 0,
      dueSchedules: input.dueSchedules ?? 0,
      enqueuedCount: input.enqueuedCount ?? 0,
      deduplicatedCount: input.deduplicatedCount ?? 0,
      processedCount: input.processedCount ?? 0,
      errorLog: input.errorLog ?? null,
      startedAt,
      finishedAt: input.finishedAt ? new Date(input.finishedAt) : null
    };

    await coll.insertOne(doc);
    return this.mapSchedulerRun(doc);
  }

  async findSchedulerRuns(limit = 20): Promise<SchedulerRunEntity[]> {
    const coll = await this.getSchedulerRunColl();
    const docs = await coll.find({}).sort({ startedAt: -1 }).limit(limit).toArray();
    return docs.map((d) => this.mapSchedulerRun(d));
  }

  async updateSchedulerRun(id: string, updates: UpdateSchedulerRunInput): Promise<SchedulerRunEntity | null> {
    const coll = await this.getSchedulerRunColl();

    const setFields: Record<string, unknown> = {};
    if (updates.status !== undefined) setFields.status = updates.status;
    if (updates.recoveredLocks !== undefined) setFields.recoveredLocks = updates.recoveredLocks;
    if (updates.dueSchedules !== undefined) setFields.dueSchedules = updates.dueSchedules;
    if (updates.enqueuedCount !== undefined) setFields.enqueuedCount = updates.enqueuedCount;
    if (updates.deduplicatedCount !== undefined) setFields.deduplicatedCount = updates.deduplicatedCount;
    if (updates.processedCount !== undefined) setFields.processedCount = updates.processedCount;
    if (updates.errorLog !== undefined) setFields.errorLog = updates.errorLog;
    if (updates.finishedAt !== undefined) {
      setFields.finishedAt = updates.finishedAt ? new Date(updates.finishedAt) : null;
    }

    const res = await coll.findOneAndUpdate(
      { id },
      { $set: setFields },
      { returnDocument: "after" }
    );
    return res ? this.mapSchedulerRun(res) : null;
  }
}
