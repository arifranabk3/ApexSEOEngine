-- External scheduler (Vercel Hobby compatible): PostgreSQL-backed schedules + tick audit log
CREATE TABLE IF NOT EXISTS "JobSchedule" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "websiteId" TEXT,
    "intervalMinutes" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 20,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRunAt" TIMESTAMP(3),
    "lastJobCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobSchedule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "JobSchedule_key_key" ON "JobSchedule"("key");
CREATE INDEX IF NOT EXISTS "JobSchedule_isEnabled_nextRunAt_idx" ON "JobSchedule"("isEnabled", "nextRunAt");

CREATE TABLE IF NOT EXISTS "SchedulerRun" (
    "id" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "recoveredLocks" INTEGER NOT NULL DEFAULT 0,
    "dueSchedules" INTEGER NOT NULL DEFAULT 0,
    "enqueuedCount" INTEGER NOT NULL DEFAULT 0,
    "deduplicatedCount" INTEGER NOT NULL DEFAULT 0,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "errorLog" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "SchedulerRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SchedulerRun_startedAt_idx" ON "SchedulerRun"("startedAt");
