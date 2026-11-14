# PHASE E — KEYWORDS, TOPIC CLUSTERS & CATEGORY MIGRATION DISCOVERY

**Project:** Apex SEO Engine  
**Date:** 2026-11-14  
**Target Database:** MongoDB Atlas (`apex_seo`)  
**Scope:** `Category`, `KeywordCluster`, and `Keyword` models only. (`ContentBrief` deferred to Phase F).  

---

## 1. Prisma Schema Definitions

### Category
```prisma
model Category {
  id          String     @id @default(uuid())
  websiteId   String
  website     Website    @relation(fields: [websiteId], references: [id], onDelete: Cascade)
  name        String
  slug        String
  description String?
  parentId    String?
  parent      Category?  @relation("CategoryHierarchy", fields: [parentId], references: [id], onDelete: SetNull)
  children    Category[] @relation("CategoryHierarchy")
  articles    Article[]

  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@unique([websiteId, slug])
  @@index([websiteId])
}
```

### KeywordCluster
```prisma
model KeywordCluster {
  id            String         @id @default(uuid())
  websiteId     String
  website       Website        @relation(fields: [websiteId], references: [id], onDelete: Cascade)
  name          String
  pillarKeyword String
  intent        String         @default("INFORMATIONAL")
  status        String         @default("PLANNED")
  keywords      Keyword[]
  contentBriefs ContentBrief[]

  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  @@index([websiteId])
  @@index([status])
}
```

### Keyword
```prisma
model Keyword {
  id                 String              @id @default(uuid())
  websiteId          String
  website            Website             @relation(fields: [websiteId], references: [id], onDelete: Cascade)
  clusterId          String?
  cluster            KeywordCluster?     @relation(fields: [clusterId], references: [id], onDelete: SetNull)
  term               String
  searchIntent       String              @default("INFORMATIONAL")
  searchVolume       Int                 @default(0)
  difficulty         Float               @default(0)
  cpc                Float               @default(0)
  currentPosition    Float?
  status             String              @default("TRACKED")
  contentBriefs      ContentBrief[]
  searchPerformances SearchPerformance[]

  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  @@unique([websiteId, term])
  @@index([websiteId])
  @@index([clusterId])
  @@index([status])
}
```

---

## 2. Relationships & Constraints

1. **Category**:
   - Belongs to `Website` (`websiteId`).
   - Self-referencing tree hierarchy via `parentId` (`parent` and `children`).
   - Compound unique index: `@@unique([websiteId, slug])`.
   - Has many `Article` records (Article belongs to Phase G).
2. **KeywordCluster**:
   - Belongs to `Website` (`websiteId`).
   - Has many `Keyword` records (`clusterId` on Keyword).
   - Index on `websiteId`, index on `status`.
   - Referenced by `ContentBrief` (Phase F).
3. **Keyword**:
   - Belongs to `Website` (`websiteId`).
   - Optionally belongs to `KeywordCluster` (`clusterId`).
   - Compound unique index: `@@unique([websiteId, term])`.
   - Index on `websiteId`, `clusterId`, `status`.
   - Referenced by `ContentBrief` (Phase F) and `SearchPerformance` (Phase J).

---

## 3. Direct Prisma References in Application Code

| File Path | Usages & Queries |
| :--- | :--- |
| `src/app/api/v1/content/route.ts` | `db.category.findMany({ where: { websiteId }, select: { id, name, slug } })` |
| `src/app/api/v1/content/topic-outline/route.ts` | `db.keywordCluster.create({ data: { websiteId, name, pillarKeyword, intent, status } })`<br>`db.keyword.upsert({ where: { websiteId_term: { websiteId, term } }, update: { clusterId }, create: { websiteId, clusterId, term, searchIntent, searchVolume, difficulty } })` |
| `src/app/api/v1/dashboard/route.ts` | `db.keyword.count()` (reported as `totalKeywords`)<br>`db.keywordCluster.count()` (reported as `totalKeywordClusters`) |
| `src/lib/seed-service.ts` | `db.category.create(...)`<br>`db.keywordCluster.create(...)`<br>`db.keyword.create(...)`<br>`db.category.upsert(...)` (seeds Default Categories, Pillars & Clusters) |
| `src/services/automation/durable-job-queue.ts` | `db.keyword.upsert(...)` inside `KEYWORD_RESEARCH` task handler |

---

## 4. MongoDB Collection & Architecture Design

### Collections
1. `categories`
   - Indexes:
     - `uniq_category_id`: `{ id: 1 }` (unique)
     - `uniq_category_website_slug`: `{ websiteId: 1, slug: 1 }` (compound unique)
     - `idx_category_websiteId`: `{ websiteId: 1 }`
     - `idx_category_parentId`: `{ parentId: 1 }`
2. `keyword_clusters`
   - Indexes:
     - `uniq_keyword_cluster_id`: `{ id: 1 }` (unique)
     - `idx_keyword_cluster_websiteId`: `{ websiteId: 1 }`
     - `idx_keyword_cluster_status`: `{ status: 1 }`
     - `idx_keyword_cluster_website_name`: `{ websiteId: 1, name: 1 }`
3. `keywords`
   - Indexes:
     - `uniq_keyword_id`: `{ id: 1 }` (unique)
     - `uniq_keyword_website_term`: `{ websiteId: 1, term: 1 }` (compound unique)
     - `idx_keyword_websiteId`: `{ websiteId: 1 }`
     - `idx_keyword_clusterId`: `{ clusterId: 1 }`
     - `idx_keyword_status`: `{ status: 1 }`
