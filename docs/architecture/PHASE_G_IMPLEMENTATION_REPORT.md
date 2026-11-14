# Phase G: InternalLink & PublishingJob Migration to MongoDB
## Implementation and Verification Report

**Project:** Apex SEO Engine  
**Local Workspace:** `D:\BloggingNew`  
**GitHub Repository:** `https://github.com/arifranabk3/ApexSEOEngine`  
**Branch:** `main`  
**Production URL:** [https://apexseoengine.vercel.app/](https://apexseoengine.vercel.app/)  
**Target Cluster:** MongoDB Atlas (`sellzy-staging.tv1yvju.mongodb.net`, DB: `apex_seo`)  
**Audit Date:** 2026-11-14T17:46:00+05:00  

---

## 1. Executive Summary

Phase G has migrated exactly two models from PostgreSQL/Prisma to native MongoDB Atlas:
1. `InternalLink`
2. `PublishingJob`

### Progression Across Database Phases:
- Total domain models migrated to native MongoDB: **16 of 24** (**66.7%** of application schema).
- Direct Prisma queries for `InternalLink` and `PublishingJob` in application code: **0**.
- Architecture: Zero paid services used, strict singleton factory isolation (`getPublishingRepository()`), atomic MongoDB operations for worker claiming and status state machines, and no removal of PostgreSQL/Prisma globally.

---

## 2. Inventory of Created & Modified Artifacts

### 2.1 Domain Contracts & Zod Schemas
- **`src/repositories/publishing-repository.types.ts`**:
  - `InternalLinkEntitySchema` & `InternalLinkEntity`: Validates `id`, `websiteId`, `sourceArticleId`, `targetArticleId`, `anchorText`, `targetUrl`, `status` (`SUGGESTED`, `APPROVED`, `INSERTED`, `REJECTED`, `BROKEN`), `relevanceScore`, and timestamps.
  - `PublishingJobEntitySchema` & `PublishingJobEntity`: Validates `id`, `websiteId`, `articleId`, `cmsType`, `status` (`QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`), `scheduledFor`, `startedAt`, `completedAt`, `attempts`, `maxAttempts`, `remotePostId`, `publishedUrl`, `errorMessage`, `responseLog`, and timestamps.
  - `IPublishingRepository`: Contract declaring CRUD, query filtering, atomic worker claiming (`claimNextDueJob`), atomic completion (`completeJob`), and atomic retry/backoff failure handling (`failJob`).

### 2.2 Native MongoDB Repository
- **`src/repositories/mongo-publishing-repository.ts`**:
  - Collections:
    - `internal_links`
    - `publishing_jobs`
  - Indexes:
    - `uniq_internal_link_id`: `{ id: 1 }` (unique)
    - `uniq_internal_link_tuple`: `{ websiteId: 1, sourceArticleId: 1, targetArticleId: 1, anchorText: 1 }` (unique constraint preventing duplicate recommendations)
    - `idx_internal_link_website_status`: `{ websiteId: 1, status: 1 }`
    - `idx_internal_link_source`: `{ sourceArticleId: 1 }`
    - `idx_internal_link_target`: `{ targetArticleId: 1 }`
    - `uniq_publishing_job_id`: `{ id: 1 }` (unique)
    - `idx_publishing_job_website_status`: `{ websiteId: 1, status: 1 }`
    - `idx_publishing_job_article`: `{ articleId: 1 }`
    - `idx_publishing_job_queue`: `{ status: 1, scheduledFor: 1 }`
  - Atomic Operations:
    - `claimNextDueJob`: Atomically locks queued jobs due for publishing using `findOneAndUpdate`, advancing status to `PROCESSING` and incrementing attempts.
    - `completeJob`: Atomically advances status to `COMPLETED` with remote post ID and response audit log.
    - `failJob`: Atomically sets `FAILED` or schedules retry if `attempts < maxAttempts`.

### 2.3 Repository Factory
- **`src/repositories/publishing-repository.factory.ts`**:
  - Provides `getPublishingRepository()` singleton accessor.

### 2.4 Idempotent Migration Engine
- **`src/services/migration/publishing-migration-engine.ts`**:
  - Supports `dryRun: true` and live migration.
  - Safely copies existing PostgreSQL `internalLink` and `publishingJob` records into MongoDB Atlas without mutating or deleting PostgreSQL data.

### 2.5 Refactored Application Consumers
- **`src/services/automation/durable-job-queue.ts`**:
  - Replaced direct `db.publishingJob.create(...)` in `AUTOMATED_PUBLISHING` handler with `publishingRepo.createPublishingJob(...)`.

### 2.6 Test Suite
- **`tests/mongodb-publishing.test.ts`**:
  - Tests `InternalLink` CRUD, bidirectional querying, duplicate prevention, and cascade cleanup.
  - Tests `PublishingJob` creation, atomic queue claiming, failure with backoff retry, and final completion.
  - Tests migration engine dry-run and live idempotency.

---

## 3. Verification & Quality Gates

| Verification Check | Result | Evidence |
| :--- | :---: | :--- |
| **Prisma Direct Query Check** | **PASSED** (0 direct queries) | `git grep -in "db\.internalLink\b\|db\.publishingJob\b\|prisma\.internalLink\b\|prisma\.publishingJob\b" src/` returned 0 matches. |
| **Prisma Schema Validation** | **PASSED** | `npx prisma validate` exited code 0. |
| **TypeScript Typecheck** | **PASSED** | `npx tsc --noEmit` exited code 0 without any errors. |
| **Next.js Production Build** | **PASSED** | `npm run build` compiled 28/28 routes successfully in 6.4s. |
| **Secret Scanning** | **PASSED** | Git diff verified clean; zero credentials or tokens in commit. |
| **Production Health Check** | **PASSED** | `https://apexseoengine.vercel.app/api/v1/health` responded HTTP 200 `healthy`. |

---

## 4. Production Runtime Status & Rollback Procedure

- **Production Health**: `https://apexseoengine.vercel.app/api/v1/health` remains healthy (HTTP 200).
- **Backend Clarification**: As established in Phase F2, production Vercel functions currently run on PostgreSQL / PGlite because `MONGODB_URI` has not yet been set in Vercel environment variables (to protect against dynamic IP egress blocks by Atlas).
- **Rollback Procedure**: In the event of unexpected behavior, revert commit `feat(phase-g): migrate internal links and publishing jobs to mongodb` or rollback through GitHub main.

---

*Phase G completed and ready for release.*
