# Phase H Discovery: Automation Engine & Scheduler Migration to MongoDB

**Project:** Apex SEO Engine  
**Local Workspace:** `D:\BloggingNew`  
**Target Database:** MongoDB Atlas (`sellzy-staging.tv1yvju.mongodb.net`, DB: `apex_seo`)  
**Audit Date:** 2026-11-14T17:49:00+05:00  

---

## 1. Executive Summary & Objective

In Phase H, exactly five models are being migrated from PostgreSQL/Prisma to native MongoDB Atlas:
1. `AutomationWorkflow`: Declarative automation configurations, n8n webhook pipelines, schedules, active states, and retry policies.
2. `AutomationExecution`: Complete historical runtime audit trails of workflow executions, inputs, outputs, duration, and error logs.
3. `DurableJob`: Distributed, queue-backed jobs with idempotency keys, priority, payload, lock leases (`lockedBy`, `lockedUntil`), attempts, and atomic state transitions.
4. `JobSchedule`: Recurring schedule definitions driving sub-daily automation intervals (replaces sub-daily Vercel Cron on Hobby).
5. `SchedulerRun`: Execution history and metrics of scheduler ticks (recovered locks, due schedules, enqueued counts, and errors).

No other models are migrated in this phase (e.g. `SearchPerformance`, `SystemSetting`, and `AuditLog` remain in PostgreSQL until Phase I).

---

## 2. Prisma Model Deep-Dive

### 2.1 Model `AutomationWorkflow`
```prisma
model AutomationWorkflow {
  id             String    @id @default(uuid())
  websiteId      String?
  website        Website?  @relation(fields: [websiteId], references: [id], onDelete: SetNull)
  name           String
  slug           String    @unique
  description    String?
  workflowType   String    @default("N8N_WEBHOOK")
  n8nWorkflowId  String?
  webhookUrl     String?
  scheduleCron   String?
  isEnabled      Boolean   @default(true)
  status         String    @default("IDLE")
  maxRetries     Int       @default(3)
  retryBackoffMs Int       @default(5000)
  config         Json      @default("{}")
  lastRunAt      DateTime?
  nextRunAt      DateTime?

  executions     AutomationExecution[]
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([websiteId])
  @@index([status])
  @@index([isEnabled])
}
```
- **MongoDB Collection:** `automation_workflows`
- **Unique Indexes:** `{ id: 1 }`, `{ slug: 1 }`
- **Query Indexes:** `{ websiteId: 1 }`, `{ status: 1 }`, `{ isEnabled: 1 }`

---

### 2.2 Model `AutomationExecution`
```prisma
model AutomationExecution {
  id            String             @id @default(uuid())
  workflowId    String
  workflow      AutomationWorkflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  status        String             @default("RUNNING")
  triggerSource String             @default("MANUAL")
  attemptNumber Int                @default(1)
  startedAt     DateTime           @default(now())
  finishedAt    DateTime?
  durationMs    Int?
  inputPayload  Json               @default("{}")
  outputResult  Json               @default("{}")
  errorLog      String?
  createdAt     DateTime           @default(now())

  @@index([workflowId, status])
  @@index([startedAt])
}
```
- **MongoDB Collection:** `automation_executions`
- **Unique Index:** `{ id: 1 }`
- **Query Indexes:** `{ workflowId: 1, status: 1 }`, `{ startedAt: -1 }`

---

### 2.3 Model `DurableJob`
```prisma
model DurableJob {
  id             String    @id @default(uuid())
  websiteId      String?
  website        Website?  @relation(fields: [websiteId], references: [id], onDelete: Cascade)
  jobType        String
  idempotencyKey String    @unique
  status         String    @default("QUEUED")
  priority       Int       @default(10)
  payload        Json      @default("{}")
  result         Json?
  errorLog       String?
  attempts       Int       @default(0)
  maxAttempts    Int       @default(3)
  nextRetryAt    DateTime  @default(now())
  lockedBy       String?
  lockedUntil    DateTime?
  startedAt      DateTime?
  completedAt    DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([status, nextRetryAt, priority])
  @@index([websiteId, jobType])
  @@index([lockedUntil])
}
```
- **MongoDB Collection:** `durable_jobs`
- **Unique Indexes:** `{ id: 1 }`, `{ idempotencyKey: 1 }`
- **Query Indexes:** `{ status: 1, nextRetryAt: 1, priority: -1 }`, `{ websiteId: 1, jobType: 1 }`, `{ lockedUntil: 1 }`
- **Concurrency & Locking Requirements:**
  - `claimJob(workerId, lockDurationMs)`: Atomic `findOneAndUpdate` finding next `QUEUED` or retryable job (`nextRetryAt <= now`) or abandoned job (`status == 'RUNNING' && lockedUntil < now`).

---

### 2.4 Model `JobSchedule`
```prisma
model JobSchedule {
  id              String    @id @default(uuid())
  key             String    @unique
  jobType         String
  websiteId       String?
  intervalMinutes Int
  priority        Int       @default(20)
  payload         Json      @default("{}")
  isEnabled       Boolean   @default(true)
  nextRunAt       DateTime  @default(now())
  lastRunAt       DateTime?
  lastJobCount    Int       @default(0)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([isEnabled, nextRunAt])
}
```
- **MongoDB Collection:** `job_schedules`
- **Unique Indexes:** `{ id: 1 }`, `{ key: 1 }`
- **Query Indexes:** `{ isEnabled: 1, nextRunAt: 1 }`, `{ websiteId: 1 }`
- **Concurrency:** Optimistic locking during ticks using `{ key: schedule.key, nextRunAt: schedule.nextRunAt }`.

---

### 2.5 Model `SchedulerRun`
```prisma
model SchedulerRun {
  id                String    @id @default(uuid())
  triggeredBy       String
  status            String    @default("RUNNING")
  recoveredLocks    Int       @default(0)
  dueSchedules      Int       @default(0)
  enqueuedCount     Int       @default(0)
  deduplicatedCount Int       @default(0)
  processedCount    Int       @default(0)
  errorLog          String?
  startedAt         DateTime  @default(now())
  finishedAt        DateTime?

  @@index([startedAt])
}
```
- **MongoDB Collection:** `scheduler_runs`
- **Unique Index:** `{ id: 1 }`
- **Query Index:** `{ startedAt: -1 }`

---

## 3. Direct Prisma Query Inventory

| File | Queries | Operations |
| :--- | :--- | :--- |
| `src/app/api/v1/automations/route.ts` | `db.automationWorkflow` | `findMany`, `findUnique`, `create` |
| `src/app/api/v1/dashboard/route.ts` | `db.automationWorkflow`, `db.automationExecution` | `count` (active workflows), `findMany` (recent executions) |
| `src/app/api/v1/jobs/route.ts` | `db.durableJob` | `findMany`, `count` across status buckets (`QUEUED`, `RUNNING`, `COMPLETED`, `RETRY_SCHEDULED`, `DEAD_LETTER`) |
| `src/app/api/v1/scheduler/tick/route.ts` | `db.jobSchedule`, `db.schedulerRun`, `db.durableJob` | `findMany`, `groupBy` status counts |
| `src/lib/seed-service.ts` | `db.automationWorkflow` | `upsert` ("gsc-daily-query-sync", "wp-auto-content-publisher") |
| `src/services/automation/durable-job-queue.ts` | `db.durableJob` | `findUnique`, `create`, `findMany` (stalled), `update` (recover), `findFirst` (claim candidate), `update` (claim lock), `update` (completed/failed) |
| `src/services/automation/job-scheduler.ts` | `db.jobSchedule`, `db.schedulerRun` | `findUnique`, `create`, `findMany` (due), `updateMany` (claim slot), `update` (reschedule nextRunAt), `create` & `update` (run audit) |
| `src/services/automation/workflow-engine.ts` | `db.automationWorkflow`, `db.automationExecution` | `findUnique` (workflow), `create` (execution), `update` (execution result), `update` (workflow state & lastRunAt) |

---

## 4. Architectural Implementation Strategy

1. **`src/repositories/automation-repository.types.ts`**:
   - Zod schemas & TypeScript types for all 5 entities.
   - Comprehensive repository interface `IAutomationRepository`.
2. **`src/repositories/mongo-automation-repository.ts`**:
   - Atomic concurrency with MongoDB's `findOneAndUpdate`.
   - Index initialization ensuring unique constraints.
   - Cascade logic (e.g. deleting workflow cleans up executions).
3. **`src/repositories/automation-repository.factory.ts`**:
   - `getAutomationRepository()` singleton pattern.
4. **`src/services/migration/automation-migration-engine.ts`**:
   - Idempotent migration copying all 5 models from PostgreSQL to MongoDB with dry-run support.
5. **Decouple Consumers**:
   - Migrate `automations/route.ts`, `dashboard/route.ts`, `jobs/route.ts`, `scheduler/tick/route.ts`, `seed-service.ts`, `durable-job-queue.ts`, `job-scheduler.ts`, and `workflow-engine.ts`.
6. **Tests**:
   - Implement `tests/mongodb-automation.test.ts`.
