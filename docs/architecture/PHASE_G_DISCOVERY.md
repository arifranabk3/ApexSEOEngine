# Phase G Discovery: InternalLink & PublishingJob Migration to MongoDB

**Project:** Apex SEO Engine  
**Local Workspace:** `D:\BloggingNew`  
**Target Database:** MongoDB Atlas (`sellzy-staging.tv1yvju.mongodb.net`, DB: `apex_seo`)  
**Audit Date:** 2026-11-14T17:42:00+05:00  

---

## 1. Executive Summary & Objective

In Phase G, exactly two models are being migrated from PostgreSQL/Prisma to native MongoDB Atlas:
1. `InternalLink`: Bidirectional links between source and target articles within an isolated website tenant, tracking anchor text, target URL, suggested/approved link status, and relevance score.
2. `PublishingJob`: State machine tracking remote CMS publication tasks, dispatch lifecycle (`QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`), scheduled publishing times, retry attempts, external post IDs, published URLs, and response logs.

No other models are migrated in this phase (e.g. `SearchPerformance`, `AutomationWorkflow`, and `DurableJob` remain in PostgreSQL).

---

## 2. Prisma Schema Deep-Dive

### 2.1 Model `InternalLink`

```prisma
model InternalLink {
  id              String   @id @default(uuid())
  websiteId       String
  website         Website  @relation(fields: [websiteId], references: [id], onDelete: Cascade)
  sourceArticleId String
  sourceArticle   Article  @relation("OutgoingArticleLinks", fields: [sourceArticleId], references: [id], onDelete: Cascade)
  targetArticleId String
  targetArticle   Article  @relation("IncomingArticleLinks", fields: [targetArticleId], references: [id], onDelete: Cascade)
  anchorText      String
  targetUrl       String
  status          String   @default("SUGGESTED")
  relevanceScore  Float    @default(0.8)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([websiteId])
  @@index([sourceArticleId])
  @@index([targetArticleId])
}
```

#### Field Specifications:
- `id`: String (UUIDv4) primary key.
- `websiteId`: Foreign key to `Website.id`. Must enforce tenant isolation.
- `sourceArticleId`: Foreign key to source `Article.id`.
- `targetArticleId`: Foreign key to destination `Article.id`.
- `anchorText`: String. Contextual keyword or descriptive anchor text for the link.
- `targetUrl`: String. Fully-qualified or relative canonical URL of the destination page.
- `status`: String lifecycle state (`SUGGESTED`, `APPROVED`, `INSERTED`, `REJECTED`, `BROKEN`). Default: `"SUGGESTED"`.
- `relevanceScore`: Float between 0.0 and 1.0 (default 0.8) computed by topic clustering or semantic relatedness.
- `createdAt`, `updatedAt`: Timestamps.

#### Relations & Cascading:
- Associated with `Website` (Cascade on website deletion).
- Associated with source `Article` and target `Article` (Cascade on either article deletion).

#### Target MongoDB Collection: `internal_links`
- Unique index on `id`: `{ id: 1 }` (unique).
- Compound unique index preventing duplicate link recommendations: `{ websiteId: 1, sourceArticleId: 1, targetArticleId: 1, anchorText: 1 }` (unique).
- Query indexes:
  - `{ websiteId: 1, status: 1 }`
  - `{ sourceArticleId: 1 }`
  - `{ targetArticleId: 1 }`

---

### 2.2 Model `PublishingJob`

```prisma
model PublishingJob {
  id           String    @id @default(uuid())
  websiteId    String
  website      Website   @relation(fields: [websiteId], references: [id], onDelete: Cascade)
  articleId    String
  article      Article   @relation(fields: [articleId], references: [id], onDelete: Cascade)
  cmsType      String
  status       String    @default("QUEUED")
  scheduledFor DateTime  @default(now())
  startedAt    DateTime?
  completedAt  DateTime?
  attempts     Int       @default(0)
  maxAttempts  Int       @default(3)
  remotePostId String?
  publishedUrl String?
  errorMessage String?
  responseLog  Json      @default("{}")

  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@index([websiteId, status])
  @@index([articleId])
  @@index([scheduledFor])
}
```

#### Field Specifications:
- `id`: String (UUIDv4) primary key.
- `websiteId`: Foreign key to `Website.id`.
- `articleId`: Foreign key to `Article.id`.
- `cmsType`: String (`WORDPRESS`, `GHOST`, `SHOPIFY`, `CUSTOM_WEBHOOK`, `INTERNAL_NEXTJS`).
- `status`: String state machine (`QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`). Default: `"QUEUED"`.
- `scheduledFor`: DateTime. Default `now()`.
- `startedAt`: Nullable DateTime set when a worker claims the job.
- `completedAt`: Nullable DateTime set upon successful remote dispatch.
- `attempts`: Int. Number of execution attempts (default: 0).
- `maxAttempts`: Int. Maximum permitted retries before failure (default: 3).
- `remotePostId`: Nullable String. External post ID returned by remote CMS API.
- `publishedUrl`: Nullable String. Final public URL of the published article.
- `errorMessage`: Nullable String. Error message recorded if an attempt fails.
- `responseLog`: JSON object or array. Audit and diagnostics payload.
- `createdAt`, `updatedAt`: Timestamps.

#### Relations & Cascading:
- Associated with `Website` (Cascade).
- Associated with `Article` (Cascade).

#### Target MongoDB Collection: `publishing_jobs`
- Unique index on `id`: `{ id: 1 }` (unique).
- Compound index for queue polling: `{ status: 1, scheduledFor: 1 }`.
- Compound index for tenant management: `{ websiteId: 1, status: 1 }`.
- Article reference index: `{ articleId: 1 }`.

---

## 3. Application References and Direct Prisma Query Inventory

A thorough codebase audit across `src/` revealed the following touchpoints:

1. **`src/services/automation/durable-job-queue.ts`**:
   - Line 557: `const pubJob = await db.publishingJob.create({ ... })`
   - Executed inside the `AUTOMATED_PUBLISHING` case handler when an article is published through durable queue workers.
2. **`tests/api-database.test.ts`**:
   - Lines 78-79: `await db.internalLink.count()` and `await db.publishingJob.count()`.
3. **Internal Link Logic in SEO & Outline Engines**:
   - `src/services/compliance/onpage-seo-engine.ts`: Evaluates internal anchor tags within HTML.
   - `src/services/compliance/publishing-gate-workflow.ts`: Enforces presence and validity of internal links prior to publication.
   - `src/services/ai/topic-outline-engine.ts` & `src/services/ai/modular-article-generator.ts`: Generate internal link anchor suggestions.

---

## 4. Architecture Plan for Phase G

1. **Type Definitions & Zod Schemas**:
   - Create `src/repositories/publishing-repository.types.ts`:
     - `InternalLinkEntitySchema` & `InternalLinkEntity`
     - `CreateInternalLinkInput` & `UpdateInternalLinkInput`
     - `PublishingJobEntitySchema` & `PublishingJobEntity`
     - `CreatePublishingJobInput` & `UpdatePublishingJobInput`
     - `IPublishingRepository` interface covering both models.
2. **MongoDB Repository Implementation**:
   - Create `src/repositories/mongo-publishing-repository.ts`:
     - Implements `IPublishingRepository`.
     - Handles atomic `claimJob`, `completeJob`, `failJob` with retry scheduling.
     - Handles `createLink`, `findLinksByArticle`, `findLinksByWebsite`, duplicate prevention, and cascade deletions when articles or websites are removed.
3. **Repository Factory**:
   - Create `src/repositories/publishing-repository.factory.ts`:
     - Exports singleton `getPublishingRepository()`.
4. **Data Migration Engine**:
   - Create `src/services/migration/publishing-migration-engine.ts`:
     - Idempotent migration copying legacy PostgreSQL `InternalLink` and `PublishingJob` records to MongoDB Atlas collections.
5. **Decouple Application Consumers**:
   - Replace `db.publishingJob.create` in `durable-job-queue.ts` with `getPublishingRepository().createJob(...)`.
6. **Integration Test Suite**:
   - Create `tests/mongodb-publishing.test.ts` verifying CRUD, atomic claiming, status transitions, retry backoff, and idempotent migrations.
