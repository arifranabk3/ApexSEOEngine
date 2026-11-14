# APEX SEO ENGINE — PHASE C–M FULL MONGODB MIGRATION MASTER PLAN

**Date:** 2026-11-14  
**Project:** Apex SEO Engine (`D:\BloggingNew`)  
**Target Database:** MongoDB Atlas (`apex_seo`)  
**Execution Blueprint:** Phased transition of the remaining 21 PostgreSQL/Prisma models into native MongoDB with zero downtime and final PostgreSQL retirement.

---

## 1. Master Plan Executive Overview

Apex SEO Engine is transitioning from its legacy PostgreSQL/PGlite architecture to native MongoDB Atlas (`apex_seo`).  
- **Phase A & B:** Connection abstraction, native driver (`mongodb@7.9.0`), and User/Role/Permission authentication are **VERIFIED & COMPLETE**.
- **Phases C through L:** Migrate the remaining 21 models domain-by-domain in strict topological order.
- **Phase M:** Remove `@prisma/client`, `@electric-sql/pglite`, and delete `prisma/` folder.

---

## 2. Phased Milestone Execution Framework

### Milestone Phase C: Multi-Tenant Root & Integrations
- **Models:** `Website`, `WebsiteIntegration`
- **Deliverables:**
  - `src/repositories/mongo-website-repository.ts`
  - Encrypted CMS credentials migration (AES-256-GCM preserved)
  - `/api/v1/websites` and `/api/v1/integrations` switched to MongoDB repository
  - `tests/mongodb-website.test.ts`

### Milestone Phase D: AI Infrastructure
- **Models:** `AIProvider`, `AIModel`
- **Deliverables:**
  - `src/repositories/mongo-ai-repository.ts`
  - Seed default local Ollama provider and models in MongoDB
  - `/api/v1/ai-providers` switched to MongoDB repository
  - `tests/mongodb-ai-providers.test.ts`

### Milestone Phase E: Keywords, Clusters & Categories
- **Models:** `Category`, `KeywordCluster`, `Keyword`
- **Deliverables:**
  - `src/repositories/mongo-keyword-repository.ts`
  - Compound unique indexes on `{ websiteId, slug }` and `{ websiteId, term }`
  - Keyword clustering service switched to MongoDB
  - `tests/mongodb-keywords.test.ts`

### Milestone Phase F: Content Core & Versioning
- **Models:** `ContentBrief`, `Article`, `ArticleVersion`, `ArticleImage`
- **Deliverables:**
  - `src/repositories/mongo-article-repository.ts`
  - Keep `article_versions` in a separate collection to prevent BSON 16MB boundary overflow
  - `/api/v1/content` endpoints switched to MongoDB
  - `tests/mongodb-articles.test.ts`

### Milestone Phase G: Internal Linking & Publishing Pipeline
- **Models:** `InternalLink`, `PublishingJob`
- **Deliverables:**
  - `src/repositories/mongo-publishing-repository.ts`
  - Internal link graph traversal via MongoDB aggregation pipelines
  - `/api/v1/jobs` switched to MongoDB
  - `tests/mongodb-publishing.test.ts`

### Milestone Phase H: Automation Workflows & Durable Queue
- **Models:** `AutomationWorkflow`, `AutomationExecution`, `DurableJob`, `JobSchedule`, `SchedulerRun`
- **Deliverables:**
  - Atomic queue locking (`findOneAndUpdate` with `$set: { lockedUntil, lockedBy }`) in `src/services/automation/durable-job-queue.ts`
  - Scheduler cron runner switched to MongoDB
  - `tests/mongodb-durable-queue.test.ts`

### Milestone Phase I: Analytics, Settings & Audit Logs
- **Models:** `SearchPerformance`, `SystemSetting`, `AuditLog`
- **Deliverables:**
  - `src/lib/audit.ts` and `src/lib/rate-limit.ts` switched to MongoDB collections
  - TTL index on `audit_logs` (90 days auto-expiry)
  - `/api/v1/settings` switched to MongoDB
  - `tests/mongodb-audit-settings.test.ts`

### Milestone Phase J: Pakistan Gold Rate Dedicated Shared Cache
- **Deliverables:**
  - Replace PostgreSQL `SystemSetting` L2 cache in `pakistan-gold-rate-service.ts` with dedicated `gold_rate_cache` collection
  - Atomic distributed lock with lease expiry
  - `tests/pakistan-gold-rates.test.ts` re-verified against MongoDB cache

### Milestone Phase K: Full Regression & Staging Cutover
- **Deliverables:**
  - Full suite execution (`npx vitest run`) covering all 24 models
  - Production dry-run reconciliation report (0 count discrepancies)
  - Staging live verification on VPS backend

### Milestone Phase M: Complete PostgreSQL & Prisma Retirement
- **Deliverables:**
  - Uninstall `@prisma/client`, `@electric-sql/pglite`
  - Remove `prisma/schema.prisma` and `prisma/migrations`
  - Delete `src/lib/db.ts`
  - Update `package.json` build scripts (`next build` without `prisma generate`)

---

## 3. Strict Safety & Data Integrity Protocols

1. **Additive Migration Only:**
   - Every phase imports data from PostgreSQL into MongoDB using idempotent `$set` operations matching on UUID `id`.
   - Source PostgreSQL tables are NEVER dropped or cleared until Phase M.
2. **Referential Integrity Validation:**
   - Pre-flight foreign key checks confirm that parent records exist before inserting child documents (e.g. `websiteId` must exist before creating `articles`).
3. **Rollback Guarantee:**
   - Each repository maintains an active fallback interface to PostgreSQL during the transition.
   - If an issue arises in any phase, switching that domain's repository toggle instantly restores PostgreSQL without downtime.

---

## 4. Immediate Next Action
Phase C (Multi-Tenant Root & Integrations) is the next sequential milestone. No application code has been modified during this planning turn.
