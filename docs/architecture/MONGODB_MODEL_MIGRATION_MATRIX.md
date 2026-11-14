# APEX SEO ENGINE — MONGODB MODEL & CODE MIGRATION MATRIX
## Complete Audit of All 24 Prisma Models, API Routes, Workers & Queries

- **Document**: `docs/architecture/MONGODB_MODEL_MIGRATION_MATRIX.md`
- **Scope**: Maps every single database access point in the codebase to its target MongoDB implementation and execution phase.

---

## 1. Model-by-Model Migration Matrix (All 24 Models)

| # | Existing Prisma Model | Target MongoDB Collection | Storage Strategy | Key Operations & Methods | Target Phase |
| :-: | :--- | :--- | :--- | :--- | :-: |
| 1 | **User** | `users` | Discrete Collection | `findOne({ email })`, `updateOne({ _id })`, `insertOne` | **Phase B** |
| 2 | **Role** | `roles` | Discrete Collection | `find()`, `findOne({ name })` | **Phase B** |
| 3 | **Permission** | `permissions` | Discrete Collection | `find()`, `insertMany` | **Phase B** |
| 4 | **Website** | `websites` | Discrete (Embeds integrations) | `find({ ownerId })`, `findOne({ _id })`, `updateOne` | **Phase C** |
| 5 | **WebsiteIntegration**| Embedded in `websites.integrations` | Array of Objects | `$push`, `$pull`, `updateOne({ "integrations.id": id })` | **Phase C** |
| 6 | **AIProvider** | `ai_providers` | Discrete Collection | `find({ isEnabled: true })`, `updateOne` | **Phase C** |
| 7 | **AIModel** | `ai_models` | Discrete Collection | `find({ providerId })`, `findOne({ isDefault: true })` | **Phase C** |
| 8 | **KeywordCluster** | `keyword_clusters` | Discrete Collection | `find({ websiteId })`, `findOne`, `insertOne` | **Phase D** |
| 9 | **Keyword** | `keywords` | Discrete Collection | `find({ websiteId, clusterId })`, `count`, `insertMany` | **Phase D** |
| 10 | **ContentBrief** | `content_briefs` | Discrete Collection | `findOne({ websiteId, id })`, `insertOne`, `updateOne` | **Phase D** |
| 11 | **Category** | `categories` | Discrete Collection | `find({ websiteId })`, `findOne({ slug })` | **Phase D** |
| 12 | **Article** | `articles` | Discrete (Embeds images) | `find({ websiteId, status })`, `findOne({ slug })` | **Phase D** |
| 13 | **ArticleVersion** | `article_versions` | Discrete Collection | `find({ articleId }).sort({ versionNumber: -1 })` | **Phase D** |
| 14 | **ArticleImage** | Embedded in `articles.images` | Array of Objects | `$push: { images: newImage }` | **Phase D** |
| 15 | **InternalLink** | `internal_links` | Discrete Collection | `find({ websiteId, status })`, `updateOne`, `deleteMany` | **Phase E** |
| 16 | **PublishingJob** | `publishing_jobs` | Discrete Collection | `find({ websiteId, status: "QUEUED" })`, `updateOne` | **Phase E** |
| 17 | **AutomationWorkflow** | `automation_workflows` | Discrete Collection | `find({ websiteId, isEnabled: true })` | **Phase F** |
| 18 | **AutomationExecution**| `automation_executions` | Discrete Collection | `insertOne`, `updateOne({ _id })` | **Phase F** |
| 19 | **DurableJob** | `durable_jobs` | Discrete Collection | `findOneAndUpdate` (Atomic Lease), `updateOne` | **Phase F** |
| 20 | **JobSchedule** | `job_schedules` | Discrete Collection | `find({ isActive: true })`, `updateOne` | **Phase F** |
| 21 | **SchedulerRun** | `scheduler_runs` | Discrete Collection | `insertOne`, `find().sort({ triggeredAt: -1 }).limit(10)`| **Phase F** |
| 22 | **SearchPerformance**| `search_performance` | Discrete Collection | `aggregate([ { $match }, { $group } ])` | **Phase E** |
| 23 | **SystemSetting** | `system_settings` | Discrete Collection | `findOne({ key })`, `updateOne({ key }, { $set }, { upsert })` | **Phase B & G** |
| 24 | **AuditLog** | `audit_logs` | Discrete Collection | `insertOne`, `find({ entityId, action })` | **Phase B** |

---

## 2. API Routes & Service Access Points

| Source File | Current Prisma Queries | Target MongoDB Query Equivalents | Phase |
| :--- | :--- | :--- | :-: |
| `src/lib/auth.ts` | `db.user.findUnique({ where: { email } })` | `users.findOne({ email: email.toLowerCase() })` | **Phase B** |
| `src/lib/audit.ts` | `db.auditLog.create({ data: safeEntry })` | `audit_logs.insertOne({ ...safeEntry, createdAt: new Date() })` | **Phase B** |
| `src/lib/rate-limit.ts` | `db.systemSetting.upsert({ where: { key } })` | `system_settings.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { upsert: true })` | **Phase B** |
| `src/lib/seed-service.ts` | `db.role.upsert`, `db.user.create`, `db.permission.create` | `roles.updateOne(..., { upsert: true })`, `users.updateOne(..., { upsert: true })` | **Phase B** |
| `src/app/api/v1/auth/login/route.ts` | `db.user.findUnique`, `db.user.update` | `users.findOne`, `users.updateOne({ _id }, { $set: { lastLoginAt: new Date() } })` | **Phase B** |
| `src/app/api/v1/websites/route.ts` | `db.website.findMany`, `db.website.create` | `websites.find({ ownerId }).toArray()`, `websites.insertOne(data)` | **Phase C** |
| `src/app/api/v1/websites/[id]/route.ts`| `db.website.findUnique`, `db.website.delete` | `websites.findOne({ _id: id, ownerId })`, `websites.deleteOne(...)` | **Phase C** |
| `src/app/api/v1/ai-providers/route.ts` | `db.aIProvider.findMany`, `db.aIModel.findMany` | `ai_providers.find().toArray()`, `ai_models.find().toArray()` | **Phase C** |
| `src/app/api/v1/content/route.ts` | `db.article.findMany`, `db.article.create` | `articles.find({ websiteId }).toArray()`, `articles.insertOne(data)` | **Phase D** |
| `src/app/api/v1/content/topic-outline/route.ts` | `db.keywordCluster.create`, `db.contentBrief.create` | `keyword_clusters.insertOne`, `content_briefs.insertOne` | **Phase D** |
| `src/app/api/v1/content/generate-modular/route.ts` | `db.article.update`, `db.articleVersion.create` | `articles.updateOne({ _id })`, `article_versions.insertOne(...)` | **Phase D** |
| `src/app/api/v1/content/generate-svg/route.ts` | `db.article.findUnique`, `db.articleImage.create` | `articles.findOne`, `articles.updateOne({ _id }, { $push: { images: newImage } })` | **Phase D** |
| `src/app/api/v1/content/factual-review/route.ts` | `db.article.findUnique`, `db.auditLog.findMany` | `articles.findOne`, `audit_logs.find({ entityId, action }).sort({ createdAt: -1 })` | **Phase E** |
| `src/app/p/[websiteId]/page.tsx` | `db.article.findMany({ where: { status: "PUBLISHED" } })` | `articles.find({ websiteId, status: "PUBLISHED" }).sort({ createdAt: -1 })` | **Phase D** |
| `src/app/p/[websiteId]/[slug]/page.tsx` | `db.article.findUnique({ where: { websiteId_slug } })` | `articles.findOne({ websiteId, slug, status: "PUBLISHED" })` | **Phase D** |
| `src/services/automation/durable-job-queue.ts` | `db.durableJob.findFirst`, `db.durableJob.update` | `durable_jobs.findOneAndUpdate({ status: "PENDING", ... }, { $set: { status: "PROCESSING" } })` | **Phase F** |
| `src/services/automation/job-scheduler.ts` | `db.jobSchedule.findMany`, `db.schedulerRun.create` | `job_schedules.find({ isActive: true })`, `scheduler_runs.insertOne` | **Phase F** |
| `src/services/finance/pakistan-gold-rate-service.ts` | `db.systemSetting.findUnique`, `db.systemSetting.upsert` | `finance_gold_cache.findOne`, `finance_gold_cache.findOneAndUpdate` (Atomic Mutex) | **Phase G** |

---

## 3. Test Fixtures & Regression Mapping

| Existing Test Suite | Relational Dependencies to Update | Replacement Target | Phase |
| :--- | :--- | :--- | :-: |
| `tests/api-database.test.ts` | Queries all 20 Prisma models, checks Prisma client | Replace with MongoDB collection count check & auth login | **Phase B** |
| `tests/unit-security.test.ts` | Role & user seed queries | Seed into MongoDB test database | **Phase B** |
| `tests/security-hardening.test.ts` | Password rotation, `tokenVersion` check via Prisma | Validate via MongoDB `users.updateOne` | **Phase B** |
| `tests/topic-outline-api.test.ts` | Creates `keywordCluster`, `contentBrief`, `article` | Use MongoDB collection inserts | **Phase D** |
| `tests/modular-article-api.test.ts` | Creates `articleVersion`, increments `versionNumber` | Use `article_versions.insertOne` | **Phase D** |
| `tests/svg-api.test.ts` | Attaches `articleImage` | Push to `articles.images` | **Phase D** |
| `tests/factual-claim-api.test.ts` | Reads/writes reviewer decisions to `auditLog` | Query/insert via `audit_logs` | **Phase E** |
| `tests/vercel-durable-worker.test.ts` | Enqueues and leases `durableJob` | Atomic `durable_jobs.findOneAndUpdate` | **Phase F** |
| `tests/external-scheduler.test.ts` | Concurrency check on `schedulerRun` | Atomic idempotency key on `scheduler_runs` | **Phase F** |
| `tests/pakistan-gold-rates.test.ts` | Cleans up `SystemSetting` category | Clear `finance_gold_cache` | **Phase G** |
| `tests/pakistan-gold-rates-api.test.ts` | Admin token auth & city queries | Authenticate against MongoDB session | **Phase G** |
