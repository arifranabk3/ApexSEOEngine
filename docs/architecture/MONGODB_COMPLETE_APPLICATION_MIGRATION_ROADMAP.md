# APEX SEO ENGINE — COMPLETE APPLICATION MIGRATION ROADMAP (TO MONGODB)

**Date:** 2026-11-14  
**Target Database:** MongoDB Atlas (`apex_seo`)  
**Objective:** Complete phased transition of all 24 models and final retirement of PostgreSQL/PGlite.

---

## 1. Migration Model Registry (24 Models)

| Phase | Module | Models Covered | Target Collection | Primary Key / Index |
|---|---|---|---|---|
| **Phase B** | Authentication & RBAC | `User`, `Role`, `Permission` | `users`, `roles`, `permissions` | `id` (UUID) + `_id` (ObjectId) |
| **Phase C** | Multi-Tenant Root | `Website`, `Integration` | `websites`, `integrations` | `id` (UUID), `url` (Unique), `userId` |
| **Phase D** | AI Infrastructure | `AIProvider`, `AIModel` | `ai_providers`, `ai_models` | `id`, `providerId`, `name` |
| **Phase E** | Keyword Research | `Keyword`, `TopicCluster` | `keywords`, `topic_clusters` | `id`, compound `{ websiteId, term }` |
| **Phase F** | Content Core | `ContentBrief`, `Article`, `ArticleVersion`, `ArticleImage` | `content_briefs`, `articles`, `article_versions`, `article_images` | `id`, `slug`, `articleId` |
| **Phase G** | SEO Graph | `InternalLinkGraph`, `LinkSuggestion` | `internal_link_graphs`, `link_suggestions` | `id`, `websiteId`, source/target URLs |
| **Phase H** | Publishing | `PublishingJob` | `publishing_jobs` | `id`, `status`, `articleId` |
| **Phase I** | Automation & Queue | `AutomationWorkflow`, `WorkflowExecution`, `DurableJob` | `automation_workflows`, `workflow_executions`, `durable_jobs` | `id`, compound `{ status, runAt }` |
| **Phase J** | Search Analytics | `SearchPerformance` | `search_performance` | `id`, compound `{ websiteId, date }` |
| **Phase K** | System & Audit | `SystemSetting`, `AuditLog` | `system_settings`, `audit_logs` | `key` (Unique), `createdAt` TTL index |
| **Phase L** | Live Finance Cache | Pakistan Gold Rate | `gold_rate_cache`, `distributed_locks` | `citySlug` (Unique), atomic lock lease |
| **Phase M** | Final PostgreSQL Retirement | All legacy code | Complete removal of `@prisma/client`, `@electric-sql/pglite`, `prisma/` | Zero PostgreSQL remnants |

---

## 2. Standard Pattern for Each Module Migration

For every milestone C through L, the following strict cycle must be executed:
1. **Schema & Zod Contract:** Define MongoDB document interfaces and Zod schemas in `src/repositories/*.types.ts`.
2. **Repository Implementation:** Create `src/repositories/mongo-*-repository.ts` using native driver commands (`insertOne`, `updateOne`, `find`, atomic `$set`/`$inc`).
3. **Idempotent Migration Engine:** Implement an idempotent data pump copying legacy data from PostgreSQL into MongoDB Atlas.
4. **Service & API Switch:** Refactor service calls and Next.js route handlers to consume the repository.
5. **Integration & Regression Tests:** Write dedicated Vitest suites verifying query performance, unique constraints, and tenant isolation.
6. **Owner Gate:** Validate milestone with owner before proceeding.

---

## 3. Final Retirement Criteria (Phase M)

PostgreSQL, PGlite, and Prisma will ONLY be uninstalled when:
1. All 24 models are migrated and operating in production on MongoDB.
2. Background workers and schedulers run entirely against MongoDB durable jobs.
3. Zero references to `@/lib/db` or `prisma` remain across `src/`.
4. Production cutover has run cleanly for a minimum of 48 hours without rollbacks.
