# PHASE F2 — ARTICLE CONTENT ENGINE MIGRATION DISCOVERY

**Project:** Apex SEO Engine  
**Date:** 2026-11-14  
**Target Database:** MongoDB Atlas (`apex_seo`)  
**Scope:** `Article`, `ArticleVersion`, and `ArticleImage` models only.  
*(Note: `InternalLink` and `PublishingJob` are preserved for subsequent phases).*  

---

## 1. Prisma Schema Definitions

### Article
```prisma
model Article {
  id                 String              @id @default(uuid())
  websiteId          String
  website            Website             @relation(fields: [websiteId], references: [id], onDelete: Cascade)
  categoryId         String?
  category           Category?           @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  briefId            String?
  brief              ContentBrief?       @relation(fields: [briefId], references: [id], onDelete: SetNull)
  authorId           String?
  author             User?               @relation("ArticleAuthor", fields: [authorId], references: [id], onDelete: SetNull)
  title              String
  slug               String
  excerpt            String?
  content            String
  status             String              @default("DRAFT")
  focusKeyword       String?
  metaTitle          String?
  metaDescription    String?
  canonicalUrl       String?
  seoScore           Int                 @default(0)
  wordCount          Int                 @default(0)
  externalPostId     String?
  publishedUrl       String?
  publishedAt        DateTime?

  versions           ArticleVersion[]
  images             ArticleImage[]
  outgoingLinks      InternalLink[]      @relation("OutgoingArticleLinks")
  incomingLinks      InternalLink[]      @relation("IncomingArticleLinks")
  publishingJobs     PublishingJob[]
  searchPerformances SearchPerformance[]

  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  @@unique([websiteId, slug])
  @@index([websiteId, status])
  @@index([categoryId])
  @@index([briefId])
}
```

### ArticleVersion
```prisma
model ArticleVersion {
  id            String   @id @default(uuid())
  articleId     String
  article       Article  @relation(fields: [articleId], references: [id], onDelete: Cascade)
  versionNumber Int
  title         String
  content       String
  metaTitle     String?
  metaDesc      String?
  changeSummary String?
  createdBy     String?

  createdAt     DateTime @default(now())

  @@unique([articleId, versionNumber])
  @@index([articleId])
}
```

### ArticleImage
```prisma
model ArticleImage {
  id         String   @id @default(uuid())
  articleId  String
  article    Article  @relation(fields: [articleId], references: [id], onDelete: Cascade)
  url        String
  altText    String
  caption    String?
  prompt     String?
  provider   String   @default("LOCAL_GENERATOR")
  isFeatured Boolean  @default(false)
  width      Int      @default(1200)
  height     Int      @default(630)

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([articleId])
}
```

---

## 2. Relationships & Constraints

1. **Article -> Website**: Foreign key `websiteId`. Cascading delete when website is removed.
2. **Article -> Category**: Foreign key `categoryId` (optional). Set null on category deletion.
3. **Article -> ContentBrief**: Foreign key `briefId` (optional). Set null on brief deletion.
4. **Article -> User (Author)**: Foreign key `authorId` (optional). Set null on user deletion.
5. **Article -> ArticleVersion**: One-to-many relationship. Compound unique constraint `[articleId, versionNumber]`. Cascade delete when parent article is removed.
6. **Article -> ArticleImage**: One-to-many relationship. Cascade delete when parent article is removed.
7. **Article Uniqueness**: Compound unique constraint `[websiteId, slug]`.
8. **Article Statuses**: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED`.

---

## 3. Direct Prisma References in Application Code

| File Path | Usages & Queries |
| :--- | :--- |
| `src/app/api/v1/content/route.ts` | `db.article.findMany(...)`, `db.article.create(...)`, `db.article.findUnique(...)`, `db.article.update(...)` |
| `src/app/api/v1/content/topic-outline/route.ts` | `db.article.findUnique({ where: { websiteId_slug } })`, `db.article.create(...)` with nested version |
| `src/app/api/v1/content/generate-modular/route.ts` | `db.article.findUnique(...)` with brief/versions, `db.article.update(...)` with new version |
| `src/app/api/v1/content/generate-svg/route.ts` | `db.article.findUnique(...)`, `db.articleImage.updateMany(...)`, `db.articleImage.create(...)` |
| `src/app/api/v1/content/factual-review/route.ts` | `db.article.findUnique(...)` (fetch article content for claims review) |
| `src/app/api/v1/compliance/route.ts` | `db.article.findFirst(...)`, `db.article.update(...)` (update compliance status / seoScore) |
| `src/app/api/v1/dashboard/route.ts` | `db.article.count()`, `count({ where: { status: 'PUBLISHED' } })`, `count({ where: { status: 'DRAFT' } })`, `count({ where: { status: 'PENDING_APPROVAL' } })` |
| `src/app/p/[websiteId]/[slug]/page.tsx` | `db.article.findFirst({ where: { websiteId, slug, status: 'PUBLISHED' } })`, `db.article.findMany(...)` (related articles) |
| `src/lib/seed-service.ts` | `db.article.create(...)`, `db.articleVersion.create(...)`, `db.article.upsert(...)` (showcase articles) |
| `src/services/automation/durable-job-queue.ts` | `db.article.findUnique(...)`, `db.article.create(...)`, `db.articleImage.create(...)`, `db.article.update(...)` |
| `src/services/automation/job-scheduler.ts` | `db.article.findMany({ where: { status: 'APPROVED' } })` |

---

## 4. MongoDB Collection & Architecture Design

### Collections
1. `articles`
   - Indexes:
     - `uniq_article_id`: `{ id: 1 }` (unique)
     - `uniq_article_website_slug`: `{ websiteId: 1, slug: 1 }` (compound unique)
     - `idx_article_websiteId`: `{ websiteId: 1 }`
     - `idx_article_website_status`: `{ websiteId: 1, status: 1 }`
     - `idx_article_categoryId`: `{ categoryId: 1 }`
     - `idx_article_briefId`: `{ briefId: 1 }`
     - `idx_article_publishedAt`: `{ publishedAt: -1 }`
2. `article_versions`
   - Indexes:
     - `uniq_article_version_id`: `{ id: 1 }` (unique)
     - `uniq_article_version_number`: `{ articleId: 1, versionNumber: 1 }` (compound unique)
     - `idx_article_version_articleId`: `{ articleId: 1 }`
3. `article_images`
   - Indexes:
     - `uniq_article_image_id`: `{ id: 1 }` (unique)
     - `idx_article_image_articleId`: `{ articleId: 1 }`
     - `idx_article_image_isFeatured`: `{ articleId: 1, isFeatured: 1 }`

### Operations to Implement
- `findArticlesByWebsite`: List articles with category, author, status filters, and pagination.
- `findArticleById`: Lookup by ID with optional versions and images.
- `findArticleBySlug`: Lookup by `websiteId` + `slug`.
- `createArticle`: Creates article entity, initializes version 1.
- `updateArticle`: Updates content, SEO score, status, or metadata.
- `deleteArticle`: Cascades deletion to `article_versions` and `article_images`.
- `countArticles`: Total count with filter (e.g., status).
- `createVersion`: Appends a new revision to an article.
- `getVersions`: Retrieves revision history in descending version order.
- `addImage`: Saves image reference/metadata (sets `isFeatured` rules).
- `getImages`: Retrieves all images for an article.
- `deleteImage`: Removes specific image reference.
