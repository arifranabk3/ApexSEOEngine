# Phase F2 — Article Content Engine Migration to MongoDB
## Implementation and Verification Report

**Project**: Apex SEO Engine  
**Local Path**: `D:\BloggingNew`  
**GitHub**: `https://github.com/arifranabk3/ApexSEOEngine`  
**Branch**: `main`  
**Production**: `https://apexseoengine.vercel.app/`  
**Target Database**: MongoDB Atlas (`apex_seo`)

---

## 1. Executive Summary

Phase F2 of the Apex SEO Engine database migration has migrated the three core Article Content Engine models from PostgreSQL/Prisma to native MongoDB Atlas:
1. `Article`
2. `ArticleVersion`
3. `ArticleImage`

With Phase F2 complete:
- Total migrated models: **14 of 24** (**58.3%** of application schema).
- Direct Prisma queries for `Article`, `ArticleVersion`, and `ArticleImage`: **0**.
- Architecture isolation: Strict separation of concerns via singleton repository pattern (`getArticleRepository()`).
- High-risk operational guardrails: Zero paid services used; no global removal of Prisma/PostgreSQL; VPS infrastructure work remains deferred as instructed.

---

## 2. Inventory of Changes

### 2.1 MongoDB Collections & Schemas
Defined in `src/repositories/article-repository.types.ts` and `src/repositories/mongo-article-repository.ts`:

- **Collection `articles`**:
  - `id`: Unique string (UUID)
  - `websiteId`: Tenant website identifier
  - `categoryId`: Optional category identifier (Phase E)
  - `briefId`: Optional content brief identifier (Phase F1)
  - `authorId`: User UUID
  - `title`, `slug`, `excerpt`, `content`
  - `status`: Lifecycle enum (`DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED`)
  - `focusKeyword`, `metaTitle`, `metaDescription`, `canonicalUrl`
  - `seoScore`, `wordCount`, `externalPostId`, `publishedUrl`, `publishedAt`
  - `createdAt`, `updatedAt`
  - **Indexes**:
    - `uniq_article_id`: `{ id: 1 }` (unique)
    - `uniq_article_website_slug`: `{ websiteId: 1, slug: 1 }` (unique)
    - `idx_article_website_status`: `{ websiteId: 1, status: 1 }`
    - `idx_article_categoryId`: `{ categoryId: 1 }`
    - `idx_article_briefId`: `{ briefId: 1 }`
    - `idx_article_publishedAt`: `{ publishedAt: -1 }`

- **Collection `article_versions`**:
  - `id`: Version UUID
  - `articleId`: Reference to parent article
  - `versionNumber`: Incremental integer sequence
  - `title`, `content`, `metaTitle`, `metaDesc`, `changeSummary`, `createdBy`, `createdAt`
  - **Indexes**:
    - `uniq_article_version_id`: `{ id: 1 }` (unique)
    - `uniq_article_version_number`: `{ articleId: 1, versionNumber: 1 }` (unique)
    - `idx_article_version_articleId`: `{ articleId: 1 }`

- **Collection `article_images`**:
  - `id`: Image UUID
  - `articleId`: Reference to parent article
  - `url`: Image URL or sanitized Data URI
  - `altText`, `caption`, `prompt`, `provider`, `isFeatured`, `width`, `height`
  - `createdAt`, `updatedAt`
  - **Indexes**:
    - `uniq_article_image_id`: `{ id: 1 }` (unique)
    - `idx_article_image_articleId`: `{ articleId: 1 }`
    - `idx_article_image_isFeatured`: `{ articleId: 1, isFeatured: 1 }`

### 2.2 Repositories & Migration Engine
- `src/repositories/article-repository.types.ts`: Zod validation schemas and contract interface `IArticleRepository`.
- `src/repositories/mongo-article-repository.ts`: Full native MongoDB driver implementation supporting CRUD, versioning, image attachment, featured toggles, cascade deletion, and multi-field counts.
- `src/repositories/article-repository.factory.ts`: Singleton accessor `getArticleRepository()`.
- `src/services/migration/article-migration-engine.ts`: Idempotent data migration script copying legacy PostgreSQL records to MongoDB collections with dry-run support.

### 2.3 Refactored Application Consumers
All consumer routes and services previously relying on direct Prisma queries for `Article`, `ArticleVersion`, and `ArticleImage` were decoupled to use `getArticleRepository()`:
1. `src/app/api/v1/content/route.ts`:
   - `GET`: Returns enriched articles with version history, category, and website metadata.
   - `POST`: Creates draft/published articles with automatic version #1 and audit logging.
   - `PATCH`: Updates article content and appends version revisions incrementally.
2. `src/app/api/v1/content/topic-outline/route.ts`:
   - Generates initial draft articles linked to ContentBriefs with slug deduplication and version #1 creation.
3. `src/app/api/v1/content/generate-modular/route.ts`:
   - Queries target article and ContentBrief via repositories.
   - Assembles modular sections, preserves version history, and updates SEO scores.
4. `src/app/api/v1/content/generate-svg/route.ts`:
   - Validates tenant website ownership via `getWebsiteRepository()`.
   - Attaches sanitized SVG data URIs via `articleRepo.addImage()`.
5. `src/app/api/v1/content/factual-review/route.ts`:
   - Resolves target article via `articleRepo.findArticleById()` and validates tenant permissions.
6. `src/app/api/v1/compliance/route.ts`:
   - Performs publishing gate transition checks and updates article publication status/URLs.
7. `src/app/api/v1/dashboard/route.ts`:
   - Aggregates article counts (`totalArticles`, `publishedArticles`, `draftArticles`, `pendingApprovals`) via `articleRepo.countArticles()`.
8. `src/app/p/[websiteId]/[slug]/page.tsx`:
   - Public rendering route resolves published articles and related articles via `findArticleBySlug` and `findArticlesByWebsite`.
9. `src/lib/seed-service.ts`:
   - Seeds showcase published articles and blueprint drafts using `articleRepo.upsertArticle()`.
10. `src/services/automation/durable-job-queue.ts`:
    - Generates AI draft articles, persists image assets, and executes automated publishing lifecycle updates.
11. `src/services/automation/job-scheduler.ts`:
    - Enqueues automated publishing jobs for `APPROVED` articles using `findArticlesByWebsite()`.

---

## 3. Verification & Quality Gates

| Verification Gate | Result | Notes |
| :--- | :--- | :--- |
| **Direct Prisma Queries Check** | **PASSED** (0 direct queries) | `git grep` confirmed no `db.article`, `db.articleVersion`, or `db.articleImage` calls remain. |
| **Prisma Schema Validation** | **PASSED** | `npx prisma validate` exited code 0. |
| **Next.js Production Build** | **PASSED** | `npm run build` compiled 28/28 routes with zero type errors. |
| **Secret Scan** | **PASSED** | No credentials, passwords, or connection strings in code or git diff. |
| **Tenant Isolation** | **VERIFIED** | All routes enforce tenant website ownership before mutating article records. |

---

## 4. Current Migration Status

```
Phase A: Baseline Audit & In-Memory PGlite Integration (Complete)
Phase B: Native MongoDB Infrastructure & Auth Migration (Complete)
Phase C: Website & WebsiteIntegration Migration (Complete)
Phase D: AI Provider & AI Model Migration (Complete)
Phase E: Category, KeywordCluster & Keyword Migration (Complete)
Phase F1: ContentBrief Migration (Complete)
Phase F2: Article, ArticleVersion & ArticleImage Migration (Complete)
Phase G: InternalLink, SearchPerformance & PublishingJob (Next)
```

---

*Phase F2 implementation successfully completed and verified.*
