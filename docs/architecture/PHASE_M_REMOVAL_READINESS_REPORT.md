# PHASE M — PRISMA / POSTGRESQL REMOVAL READINESS REPORT

**Audit Date**: November 14, 2026  
**Repository**: [https://github.com/arifranabk3/ApexSEOEngine](https://github.com/arifranabk3/ApexSEOEngine)  
**Branch**: `main`  
**Production URL**: [https://apexseoengine.vercel.app/](https://apexseoengine.vercel.app/)  
**Overall Readiness Status**: **NOT READY**

---

## 1. Executive Summary

This audit assesses the readiness of Apex SEO Engine to decommission and uninstall Prisma ORM (`@prisma/client`, `@prisma/adapter-pg`, `prisma`), PostgreSQL (`pg`), PGlite (`@electric-sql/pglite`, `@electric-sql/pglite-socket`), and the `prisma/` schema/migrations directory.

### Overall Finding: **NOT READY**
While **all 24 domain models** have native MongoDB repositories, types, and factories authored across Phases B through I, Prisma and PostgreSQL **cannot be safely removed today**.

### Primary Blockers:
1. **Active Core Production Consumers Still Bound to Prisma (`getDb()`)**:
   - `src/lib/seed-service.ts`: Directly executes `db.permission`, `db.role`, `db.user`, `db.website`, and `db.websiteIntegration` on server boot.
   - `src/app/api/v1/health/route.ts`: Queries `db.user.count()` and `db.website.count()` to assess health.
   - `src/app/p/[websiteId]/page.tsx`: Queries `db.website.findUnique` with relational includes for public publication listings.
   - `src/app/page.tsx`: Queries `db.website.findFirst` with relational includes for the front page.
   - `src/app/api/v1/auth/change-password/route.ts`: Directly queries `db.user.findUnique`.
   - `src/app/api/v1/compliance/route.ts`: Queries `db.website.findUnique` and `db.website.findFirst`.
   - `src/app/api/v1/content/topic-outline/route.ts`: Queries `db.website.findUnique`.
2. **Production Authentication Backend Dependency**:
   - `src/repositories/auth-repository.factory.ts` defaults to PostgreSQL fallback whenever `MONGODB_URI` is unverified or connection fails on Vercel.
3. **Data Reconciliation Unverified in Production**:
   - Zero proof of live production data records having been reconciled or migrated from PostgreSQL to MongoDB Atlas in production. Removing PostgreSQL now would result in total data loss for production websites, users, and credentials.
4. **Build & Deployment Configuration**:
   - `vercel.json` specifies `"buildCommand": "prisma generate && prisma migrate deploy && next build"`.
   - Removing Prisma without an coordinated production cutover will break Vercel deployments immediately.

---

## 2. Complete Inventory of Remaining Prisma & PostgreSQL Dependencies

### 2.1 Direct Application Consumers of `getDb()` / Prisma Client
| File | Models Directly Queried | Impact if Removed Today |
| :--- | :--- | :--- |
| `src/lib/seed-service.ts` | `Permission`, `Role`, `User`, `Website`, `WebsiteIntegration` | **FATAL**: Server startup crash; system seeding fails. |
| `src/app/api/v1/health/route.ts` | `User`, `Website` | **FATAL**: Healthcheck returns 500 error. |
| `src/app/p/[websiteId]/page.tsx` | `Website`, `Category`, `Article` | **FATAL**: Public publication pages throw 500 runtime errors. |
| `src/app/page.tsx` | `Website`, `Category`, `Article`, `User` | **FATAL**: Front page throws 500 runtime errors. |
| `src/app/api/v1/auth/change-password/route.ts` | `User` | **FATAL**: Password change API endpoint fails. |
| `src/app/api/v1/compliance/route.ts` | `Website`, `Article`, `Category` | **FATAL**: Compliance dashboard fails. |
| `src/app/api/v1/content/topic-outline/route.ts` | `Website` | **FATAL**: Topic outline generation fails. |
| `src/repositories/postgres-auth-repository.ts` | `User`, `Role`, `Permission`, `Session`, `VerificationToken` | **FATAL**: Disables fallback authentication. |

### 2.2 Migration Engines Querying PostgreSQL Source
All 9 migration engines rely on `getDb()` to extract source data:
- `src/services/migration/ai-config-migration-engine.ts`
- `src/services/migration/article-migration-engine.ts`
- `src/services/migration/auth-migration-engine.ts`
- `src/services/migration/automation-migration-engine.ts`
- `src/services/migration/content-brief-migration-engine.ts`
- `src/services/migration/keyword-migration-engine.ts`
- `src/services/migration/publishing-migration-engine.ts`
- `src/services/migration/system-migration-engine.ts`
- `src/services/migration/website-migration-engine.ts`

### 2.3 Package & Build Dependencies
- **`package.json`**:
  - Dependencies: `@prisma/client` (`^5.22.0`), `pg` (`^8.13.1`).
  - DevDependencies: `@electric-sql/pglite` (`0.3.1`), `@electric-sql/pglite-socket` (`0.0.4`), `@prisma/adapter-pg` (`^5.22.0`), `@types/pg` (`^8.11.10`), `prisma` (`^5.22.0`).
  - Scripts: `db:generate`, `db:migrate`, `db:migrate:dev`, `db:seed`.
- **`next.config.ts`**:
  - `serverExternalPackages`: includes `@electric-sql/pglite`, `@electric-sql/pglite-socket`, `@prisma/client`.
- **`vercel.json`**:
  - `"buildCommand": "prisma generate && prisma migrate deploy && next build"`.
- **`Dockerfile` & `services/automation-worker/Dockerfile`**:
  - `RUN npx prisma generate`
  - `COPY prisma ./prisma`

---

## 3. Authentication Dependency Analysis

- **Factory File**: `src/repositories/auth-repository.factory.ts`
- **Current Behavior**:
  ```ts
  const envBackend = process.env.AUTH_STORAGE_BACKEND?.toLowerCase();
  const backend = envBackend || (process.env.MONGODB_URI ? "mongodb" : "postgres");
  ```
- **Fallback Architecture**:
  - If `AUTH_STORAGE_BACKEND` is omitted and `MONGODB_URI` is missing or fails, the platform automatically instantiates `PostgresAuthRepository`.
  - In production (Vercel), `AUTH_STORAGE_BACKEND` is currently **unset**.
  - Deleting `PostgresAuthRepository` today would eliminate the resilience safety net that currently keeps production running if MongoDB Atlas connectivity drops or is firewalled.

---

## 4. Production Environment Readiness

1. **Vercel Production Verification**:
   - Production URL: `https://apexseoengine.vercel.app/api/v1/health` returns HTTP 200 `healthy`.
   - **Critical Warning**: The health endpoint currently queries PostgreSQL (`db.user.count()` and `db.website.count()`). A 200 response proves that **PostgreSQL is active in production**, NOT that MongoDB is working in production.
2. **Atlas TLS / Network Restriction**:
   - The workstation public IP (`154.192.120.3`) encounters `ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR (SSL alert number 80)` when connecting to Atlas directly.
   - If Vercel instances also lack guaranteed dynamic IP peering or open Atlas network access, removing PostgreSQL would immediately crash production.

---

## 5. 24-Model Migration & Data Reconciliation Matrix

| # | Model | Source Table | Target MongoDB Collection | Migration Engine | Production Data Reconciled? | Remaining Risk |
|---|---|---|---|---|---|---|
| 1 | **User** | `User` | `users` | `auth-migration-engine.ts` | **NO EVIDENCE** | Credentials locked in Postgres |
| 2 | **Role** | `Role` | `roles` | `auth-migration-engine.ts` | **NO EVIDENCE** | RBAC permissions unverified |
| 3 | **Permission** | `Permission` | `permissions` | `auth-migration-engine.ts` | **NO EVIDENCE** | Admin access failure |
| 4 | **Session** | `Session` | `sessions` | `auth-migration-engine.ts` | **NO EVIDENCE** | Active logins terminated |
| 5 | **VerificationToken**| `VerificationToken` | `verification_tokens` | `auth-migration-engine.ts` | **NO EVIDENCE** | Token validation failure |
| 6 | **Website** | `Website` | `websites` | `website-migration-engine.ts` | **NO EVIDENCE** | Sites missing from frontend |
| 7 | **WebsiteIntegration**| `WebsiteIntegration` | `website_integrations` | `website-migration-engine.ts` | **NO EVIDENCE** | CMS publishing keys lost |
| 8 | **Category** | `Category` | `categories` | `website-migration-engine.ts` | **NO EVIDENCE** | Article taxonomy broken |
| 9 | **AIProviderConfig** | `AIProviderConfig` | `ai_provider_configs` | `ai-config-migration-engine.ts` | **NO EVIDENCE** | AI generation disabled |
| 10 | **ModelConfiguration**| `ModelConfiguration`| `model_configurations`| `ai-config-migration-engine.ts` | **NO EVIDENCE** | Model parameters lost |
| 11 | **KeywordDomain** | `KeywordDomain` | `keyword_domains` | `keyword-migration-engine.ts` | **NO EVIDENCE** | Keyword tracking lost |
| 12 | **Keyword** | `Keyword` | `keywords` | `keyword-migration-engine.ts` | **NO EVIDENCE** | SERP analysis corrupted |
| 13 | **KeywordCluster** | `KeywordCluster` | `keyword_clusters` | `keyword-migration-engine.ts` | **NO EVIDENCE** | Content clustering erased |
| 14 | **ContentBrief** | `ContentBrief` | `content_briefs` | `content-brief-migration-engine.ts`| **NO EVIDENCE** | Planned briefs missing |
| 15 | **Article** | `Article` | `articles` | `article-migration-engine.ts` | **NO EVIDENCE** | **CRITICAL: Live articles lost** |
| 16 | **ArticleVersion** | `ArticleVersion` | `article_versions` | `article-migration-engine.ts` | **NO EVIDENCE** | Historical revisions lost |
| 17 | **ArticleImage** | `ArticleImage` | `article_images` | `article-migration-engine.ts` | **NO EVIDENCE** | Graphic links missing |
| 18 | **InternalLink** | `InternalLink` | `internal_links` | `publishing-migration-engine.ts`| **NO EVIDENCE** | Anchor link graph lost |
| 19 | **PublishingJob** | `PublishingJob` | `publishing_jobs` | `publishing-migration-engine.ts`| **NO EVIDENCE** | Scheduled jobs stalled |
| 20 | **AutomationWorkflow**| `AutomationWorkflow`| `automation_workflows`| `automation-migration-engine.ts`| **NO EVIDENCE** | Cron pipelines erased |
| 21 | **AutomationExecution**| `AutomationExecution`| `automation_executions`| `automation-migration-engine.ts`| **NO EVIDENCE** | Execution history lost |
| 22 | **DurableJob** | `DurableJob` | `durable_jobs` | `automation-migration-engine.ts`| **NO EVIDENCE** | Distributed tasks orphaned |
| 23 | **JobSchedule** | `JobSchedule` | `job_schedules` | `automation-migration-engine.ts`| **NO EVIDENCE** | Tick schedules lost |
| 24 | **SchedulerRun** | `SchedulerRun` | `scheduler_runs` | `automation-migration-engine.ts`| **NO EVIDENCE** | Scheduler logs lost |
| 25 | **SearchPerformance**| `SearchPerformance`| `search_performance` | `system-migration-engine.ts` | **NO EVIDENCE** | GSC search analytics lost |
| 26 | **SystemSetting** | `SystemSetting` | `system_settings` | `system-migration-engine.ts` | **NO EVIDENCE** | Gold rate cache & config lost |
| 27 | **AuditLog** | `AuditLog` | `audit_logs` | `system-migration-engine.ts` | **NO EVIDENCE** | Compliance logs lost |

---

## 6. Build and Test Audit

- **`npx prisma validate`**: Passed (Exit code 0).
- **`npx tsc --noEmit`**: Passed (Exit code 0).
- **`npm run build`**: Passed (Exit code 0, 24/24 routes generated).
- **Test Executions**:
  - `tests/pakistan-gold-rates.test.ts`: **PASSED** (7 tests passed).
  - `tests/mongodb-*.test.ts`: **BLOCKED** due to local Atlas TLS Handshake Alert 80 (`ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR`).

---

## 7. Recommended Removal Sequence (Future Roadmap)

To safely retire Prisma and PostgreSQL without causing production outages, the following phases must be executed sequentially:

```
Step 1: Decouple Remaining UI / App Consumers
        Convert seed-service.ts, health/route.ts, app/page.tsx,
        app/p/[websiteId]/page.tsx, compliance, and change-password
        from getDb() to native MongoDB repositories.
                              │
                              ▼
Step 2: Production Data Migration & Live Reconciliation
        Trigger all 9 migration engines in production against Atlas.
        Verify matching counts between PostgreSQL and MongoDB for all 24 models.
                              │
                              ▼
Step 3: Cutover Authentication & Monitor
        Set AUTH_STORAGE_BACKEND=mongodb in Vercel.
        Verify production user login, session validation, and health checks on MongoDB.
                              │
                              ▼
Step 4: Update Vercel Build Command
        Change vercel.json buildCommand from "prisma generate && prisma migrate deploy && next build"
        to "next build".
                              │
                              ▼
Step 5: Decommission Prisma & PostgreSQL Packages
        Uninstall @prisma/client, @prisma/adapter-pg, prisma, pg, @electric-sql/pglite.
        Delete src/lib/db.ts, src/repositories/postgres-auth-repository.ts,
        and the prisma/ folder.
```

---

## 8. Conclusion

**Overall Readiness Status**: **NOT READY**.  
Do **NOT** remove Prisma, PostgreSQL, or PGlite at this time.
