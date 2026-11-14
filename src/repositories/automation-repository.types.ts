import { z } from "zod";

// ============================================================================
// 1. AutomationWorkflow Schemas & Types
// ============================================================================

export const AutomationWorkflowEntitySchema = z.object({
  id: z.string(),
  websiteId: z.string().nullable().optional(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable().optional(),
  workflowType: z.string().default("N8N_WEBHOOK"),
  n8nWorkflowId: z.string().nullable().optional(),
  webhookUrl: z.string().nullable().optional(),
  scheduleCron: z.string().nullable().optional(),
  isEnabled: z.boolean().default(true),
  status: z.string().default("IDLE"),
  maxRetries: z.number().int().default(3),
  retryBackoffMs: z.number().int().default(5000),
  config: z.unknown().default({}),
  lastRunAt: z.date().or(z.string()).nullable().optional(),
  nextRunAt: z.date().or(z.string()).nullable().optional(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});
export type AutomationWorkflowEntity = z.infer<typeof AutomationWorkflowEntitySchema>;

export interface CreateAutomationWorkflowInput {
  id?: string;
  websiteId?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  workflowType?: string;
  n8nWorkflowId?: string | null;
  webhookUrl?: string | null;
  scheduleCron?: string | null;
  isEnabled?: boolean;
  status?: string;
  maxRetries?: number;
  retryBackoffMs?: number;
  config?: Record<string, unknown> | unknown;
  lastRunAt?: Date | string | null;
  nextRunAt?: Date | string | null;
}

export interface UpdateAutomationWorkflowInput {
  websiteId?: string | null;
  name?: string;
  slug?: string;
  description?: string | null;
  workflowType?: string;
  n8nWorkflowId?: string | null;
  webhookUrl?: string | null;
  scheduleCron?: string | null;
  isEnabled?: boolean;
  status?: string;
  maxRetries?: number;
  retryBackoffMs?: number;
  config?: Record<string, unknown> | unknown;
  lastRunAt?: Date | string | null;
  nextRunAt?: Date | string | null;
}

// ============================================================================
// 2. AutomationExecution Schemas & Types
// ============================================================================

export const AutomationExecutionEntitySchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  status: z.string().default("RUNNING"),
  triggerSource: z.string().default("MANUAL"),
  attemptNumber: z.number().int().default(1),
  startedAt: z.date().or(z.string()),
  finishedAt: z.date().or(z.string()).nullable().optional(),
  durationMs: z.number().int().nullable().optional(),
  inputPayload: z.unknown().default({}),
  outputResult: z.unknown().default({}),
  errorLog: z.string().nullable().optional(),
  createdAt: z.date().or(z.string())
});
export type AutomationExecutionEntity = z.infer<typeof AutomationExecutionEntitySchema>;

export interface CreateAutomationExecutionInput {
  id?: string;
  workflowId: string;
  status?: string;
  triggerSource?: string;
  attemptNumber?: number;
  startedAt?: Date | string;
  finishedAt?: Date | string | null;
  durationMs?: number | null;
  inputPayload?: Record<string, unknown> | unknown;
  outputResult?: Record<string, unknown> | unknown;
  errorLog?: string | null;
}

export interface UpdateAutomationExecutionInput {
  status?: string;
  finishedAt?: Date | string | null;
  durationMs?: number | null;
  outputResult?: Record<string, unknown> | unknown;
  errorLog?: string | null;
}

// ============================================================================
// 3. DurableJob Schemas & Types
// ============================================================================

export const DurableJobStatusEnum = z.enum([
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "RETRY_SCHEDULED",
  "DEAD_LETTER"
]);
export type DurableJobStatusType = z.infer<typeof DurableJobStatusEnum>;

export const DurableJobEntitySchema = z.object({
  id: z.string(),
  websiteId: z.string().nullable().optional(),
  jobType: z.string(),
  idempotencyKey: z.string().min(1),
  status: z.string().default("QUEUED"),
  priority: z.number().int().default(10),
  payload: z.unknown().default({}),
  result: z.unknown().nullable().optional(),
  errorLog: z.string().nullable().optional(),
  attempts: z.number().int().default(0),
  maxAttempts: z.number().int().default(3),
  nextRetryAt: z.date().or(z.string()),
  lockedBy: z.string().nullable().optional(),
  lockedUntil: z.date().or(z.string()).nullable().optional(),
  startedAt: z.date().or(z.string()).nullable().optional(),
  completedAt: z.date().or(z.string()).nullable().optional(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});
export type DurableJobEntity = z.infer<typeof DurableJobEntitySchema>;

export interface CreateDurableJobInput {
  id?: string;
  websiteId?: string | null;
  jobType: string;
  idempotencyKey: string;
  status?: string;
  priority?: number;
  payload?: Record<string, unknown> | unknown;
  result?: Record<string, unknown> | unknown | null;
  errorLog?: string | null;
  attempts?: number;
  maxAttempts?: number;
  nextRetryAt?: Date | string;
  lockedBy?: string | null;
  lockedUntil?: Date | string | null;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
}

export interface UpdateDurableJobInput {
  status?: string;
  priority?: number;
  payload?: Record<string, unknown> | unknown;
  result?: Record<string, unknown> | unknown | null;
  errorLog?: string | null;
  attempts?: number;
  maxAttempts?: number;
  nextRetryAt?: Date | string;
  lockedBy?: string | null;
  lockedUntil?: Date | string | null;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
}

// ============================================================================
// 4. JobSchedule Schemas & Types
// ============================================================================

export const JobScheduleEntitySchema = z.object({
  id: z.string(),
  key: z.string().min(1),
  jobType: z.string(),
  websiteId: z.string().nullable().optional(),
  intervalMinutes: z.number().int(),
  priority: z.number().int().default(20),
  payload: z.unknown().default({}),
  isEnabled: z.boolean().default(true),
  nextRunAt: z.date().or(z.string()),
  lastRunAt: z.date().or(z.string()).nullable().optional(),
  lastJobCount: z.number().int().default(0),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});
export type JobScheduleEntity = z.infer<typeof JobScheduleEntitySchema>;

export interface CreateJobScheduleInput {
  id?: string;
  key: string;
  jobType: string;
  websiteId?: string | null;
  intervalMinutes: number;
  priority?: number;
  payload?: Record<string, unknown> | unknown;
  isEnabled?: boolean;
  nextRunAt?: Date | string;
  lastRunAt?: Date | string | null;
  lastJobCount?: number;
}

export interface UpdateJobScheduleInput {
  jobType?: string;
  websiteId?: string | null;
  intervalMinutes?: number;
  priority?: number;
  payload?: Record<string, unknown> | unknown;
  isEnabled?: boolean;
  nextRunAt?: Date | string;
  lastRunAt?: Date | string | null;
  lastJobCount?: number;
}

// ============================================================================
// 5. SchedulerRun Schemas & Types
// ============================================================================

export const SchedulerRunEntitySchema = z.object({
  id: z.string(),
  triggeredBy: z.string(),
  status: z.string().default("RUNNING"),
  recoveredLocks: z.number().int().default(0),
  dueSchedules: z.number().int().default(0),
  enqueuedCount: z.number().int().default(0),
  deduplicatedCount: z.number().int().default(0),
  processedCount: z.number().int().default(0),
  errorLog: z.string().nullable().optional(),
  startedAt: z.date().or(z.string()),
  finishedAt: z.date().or(z.string()).nullable().optional()
});
export type SchedulerRunEntity = z.infer<typeof SchedulerRunEntitySchema>;

export interface CreateSchedulerRunInput {
  id?: string;
  triggeredBy: string;
  status?: string;
  recoveredLocks?: number;
  dueSchedules?: number;
  enqueuedCount?: number;
  deduplicatedCount?: number;
  processedCount?: number;
  errorLog?: string | null;
  startedAt?: Date | string;
  finishedAt?: Date | string | null;
}

export interface UpdateSchedulerRunInput {
  status?: string;
  recoveredLocks?: number;
  dueSchedules?: number;
  enqueuedCount?: number;
  deduplicatedCount?: number;
  processedCount?: number;
  errorLog?: string | null;
  finishedAt?: Date | string | null;
}

// ============================================================================
// 6. Automation Repository Interface
// ============================================================================

export interface IAutomationRepository {
  initIndexes(): Promise<void>;

  // AutomationWorkflow
  createWorkflow(input: CreateAutomationWorkflowInput): Promise<AutomationWorkflowEntity>;
  findWorkflowById(id: string): Promise<AutomationWorkflowEntity | null>;
  findWorkflowBySlug(slug: string): Promise<AutomationWorkflowEntity | null>;
  findWorkflowsByWebsite(websiteId?: string | null): Promise<AutomationWorkflowEntity[]>;
  updateWorkflow(id: string, updates: UpdateAutomationWorkflowInput): Promise<AutomationWorkflowEntity | null>;
  upsertWorkflow(input: CreateAutomationWorkflowInput): Promise<AutomationWorkflowEntity>;
  deleteWorkflow(id: string): Promise<boolean>;
  countWorkflows(filter?: { websiteId?: string | null; isEnabled?: boolean }): Promise<number>;

  // AutomationExecution
  createExecution(input: CreateAutomationExecutionInput): Promise<AutomationExecutionEntity>;
  findExecutionById(id: string): Promise<AutomationExecutionEntity | null>;
  findExecutions(filter?: { workflowId?: string; limit?: number; offset?: number }): Promise<AutomationExecutionEntity[]>;
  updateExecution(id: string, updates: UpdateAutomationExecutionInput): Promise<AutomationExecutionEntity | null>;
  deleteExecutionsByWorkflow(workflowId: string): Promise<number>;

  // DurableJob
  createDurableJob(input: CreateDurableJobInput): Promise<DurableJobEntity>;
  findDurableJobById(id: string): Promise<DurableJobEntity | null>;
  findDurableJobByIdempotencyKey(idempotencyKey: string): Promise<DurableJobEntity | null>;
  findDurableJobs(filter?: { websiteId?: string | null; status?: string; limit?: number; offset?: number }): Promise<DurableJobEntity[]>;
  updateDurableJob(id: string, updates: UpdateDurableJobInput): Promise<DurableJobEntity | null>;
  countDurableJobs(filter?: { websiteId?: string | null; status?: string }): Promise<number>;
  getDurableJobStatusCounts(websiteId?: string | null): Promise<Record<string, number>>;
  
  // DurableJob Concurrency & Locking
  recoverStalledDurableJobs(now: Date): Promise<number>;
  claimNextDurableJob(workerId: string, lockDurationMs: number): Promise<DurableJobEntity | null>;
  completeDurableJob(id: string, result: unknown): Promise<DurableJobEntity | null>;
  failDurableJob(id: string, errorLog: string, retryDelayMs?: number): Promise<DurableJobEntity | null>;

  // JobSchedule
  createSchedule(input: CreateJobScheduleInput): Promise<JobScheduleEntity>;
  findScheduleById(id: string): Promise<JobScheduleEntity | null>;
  findScheduleByKey(key: string): Promise<JobScheduleEntity | null>;
  findDueSchedules(now: Date): Promise<JobScheduleEntity[]>;
  findAllSchedules(websiteId?: string | null): Promise<JobScheduleEntity[]>;
  updateSchedule(id: string, updates: UpdateJobScheduleInput): Promise<JobScheduleEntity | null>;
  upsertSchedule(input: CreateJobScheduleInput): Promise<JobScheduleEntity>;
  claimScheduleSlot(key: string, expectedNextRunAt: Date, newNextRunAt: Date): Promise<boolean>;

  // SchedulerRun
  createSchedulerRun(input: CreateSchedulerRunInput): Promise<SchedulerRunEntity>;
  findSchedulerRuns(limit?: number): Promise<SchedulerRunEntity[]>;
  updateSchedulerRun(id: string, updates: UpdateSchedulerRunInput): Promise<SchedulerRunEntity | null>;
}
