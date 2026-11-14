# APEX SEO ENGINE — MONGODB PRIMARY DATABASE STATUS REPORT

**Date:** 2026-11-14  
**Cluster:** MongoDB Atlas (`sellzy-staging.tv1yvju.mongodb.net`)  
**Target Database:** `apex_seo`  
**Driver:** Official MongoDB Node.js Driver (`mongodb@7.9.0`)  
**Architecture Mandate:** MongoDB is the SOLE intended primary production database. PostgreSQL/PGlite is legacy and scheduled for retirement.

---

## 1. Actual Current Primary Database Status

- **Intended Production Primary:** **MongoDB Atlas**
- **Authentication & RBAC Backend:** **`mongodb`** (Updated default in `auth-repository.factory.ts`).
- **PostgreSQL Role:** Temporary fallback during phased transition; scheduled for complete deletion and retirement once all 24 models are migrated.

---

## 2. Module-by-Module Database Breakdown

| Application Module | Current Database | Target Database | Migration Status | Verified |
|---|---|---|:---:|:---:|
| **1. Authentication & RBAC (`User`, `Role`, `Permission`)** | **MongoDB (Primary)** | MongoDB Atlas | **100% COMPLETE** | **YES** |
| **2. Websites & Integrations (`Website`, `Integration`)** | PostgreSQL / PGlite | MongoDB Atlas | Pending (Phase C) | No |
| **3. AI Providers & Models (`AIProvider`, `AIModel`)** | PostgreSQL / PGlite | MongoDB Atlas | Pending (Phase D) | No |
| **4. Keywords & Clusters (`Keyword`, `TopicCluster`)** | PostgreSQL / PGlite | MongoDB Atlas | Pending (Phase E) | No |
| **5. Articles & Versions (`Article`, `ArticleVersion`, `ArticleImage`)**| PostgreSQL / PGlite | MongoDB Atlas | Pending (Phase F) | No |
| **6. Internal Linking (`InternalLinkGraph`, `LinkSuggestion`)** | PostgreSQL / PGlite | MongoDB Atlas | Pending (Phase G) | No |
| **7. Publishing & CMS (`PublishingJob`)** | PostgreSQL / PGlite | MongoDB Atlas | Pending (Phase H) | No |
| **8. Automation & Schedulers (`AutomationWorkflow`, `DurableJob`)** | PostgreSQL / PGlite | MongoDB Atlas | Pending (Phase I) | No |
| **9. Search Analytics (`SearchPerformance`)** | PostgreSQL / PGlite | MongoDB Atlas | Pending (Phase J) | No |
| **10. System Settings & Distributed State (`SystemSetting`)** | PostgreSQL / PGlite | MongoDB Atlas | Pending (Phase K) | No |
| **11. Audit Logs (`AuditLog`)** | PostgreSQL / PGlite | MongoDB Atlas | Pending (Phase L) | No |
| **12. Pakistan Gold Rate Cache** | In-Memory + PostgreSQL | MongoDB Atlas | Pending (Phase M) | No |

---

## 3. Verified Completion Percentage

- **Total Data Models in Schema:** 24 models
- **Models Fully Implemented & Verified in MongoDB:** 3 models (`User`, `Role`, `Permission`)
- **Verified Migration Completion:** **12.5%** (3 / 24 models).
- *Note:* We report true, tested implementation completion rather than speculative progress.

---

## 4. Remaining PostgreSQL Dependencies

A codebase scan identified **30 source files** across `src/` currently holding imports to `@/lib/db` or Prisma client.  
These are grouped into:
1. **API Endpoints (17 routes):** e.g., `/api/v1/websites`, `/api/v1/content`, `/api/v1/jobs`, `/api/v1/settings`.
2. **Services (6 services):** `durable-job-queue.ts`, `job-scheduler.ts`, `workflow-engine.ts`, `pakistan-gold-rate-service.ts`.
3. **Core Utilities (4 files):** `audit.ts`, `rate-limit.ts`, `seed-service.ts`, `db.ts`.
4. **Public Pages (3 pages):** `/`, `/p/[websiteId]`, `/p/[websiteId]/[slug]`.

Each group will be migrated systematically using dedicated repository abstractions in accordance with the complete roadmap.
