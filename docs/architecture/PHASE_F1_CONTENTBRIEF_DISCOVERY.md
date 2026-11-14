# PHASE F1 — CONTENTBRIEF MIGRATION DISCOVERY

**Project:** Apex SEO Engine  
**Date:** 2026-11-14  
**Target Database:** MongoDB Atlas (`apex_seo`)  
**Scope:** `ContentBrief` model only. (`Article`, `ArticleVersion`, `ArticleImage`, `InternalLink` deferred to Phase F2/G).  

---

## 1. Prisma Schema Definition

```prisma
model ContentBrief {
  id                String          @id @default(uuid())
  websiteId         String
  website           Website         @relation(fields: [websiteId], references: [id], onDelete: Cascade)
  keywordId         String?
  keyword           Keyword?        @relation(fields: [keywordId], references: [id], onDelete: SetNull)
  clusterId         String?
  cluster           KeywordCluster? @relation(fields: [clusterId], references: [id], onDelete: SetNull)
  title             String
  targetWordCount   Int             @default(1500)
  searchIntent      String          @default("INFORMATIONAL")
  outline           Json            @default("[]")
  secondaryKeywords Json            @default("[]")
  competitorNotes   String?
  status            String          @default("DRAFT")
  articles          Article[]

  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  @@index([websiteId])
  @@index([keywordId])
  @@index([status])
}
```

---

## 2. Relationships & Constraints

1. **Website**: Belongs to `Website` (`websiteId`). Cascade on website deletion.
2. **Keyword**: Optional link to `Keyword` (`keywordId`). Set null on keyword deletion.
3. **KeywordCluster**: Optional link to `KeywordCluster` (`clusterId`). Set null on cluster deletion.
4. **Article**: One-to-many relationship (`articles Article[]`). Referenced via `Article.briefId`.
5. **Indexes**:
   - `@@index([websiteId])`
   - `@@index([keywordId])`
   - `@@index([status])`

---

## 3. Direct Prisma References in Application Code

| File Path | Usages & Direct Queries |
| :--- | :--- |
| `src/app/api/v1/content/topic-outline/route.ts` | `db.contentBrief.create({ data: { websiteId, keywordId, clusterId, title, searchIntent, outline, secondaryKeywords, status: "APPROVED" } })` |
| `src/lib/seed-service.ts` | `db.contentBrief.create({ data: { websiteId, keywordId, clusterId, title, targetWordCount, searchIntent, outline, status: "APPROVED" } })` |
| `src/app/api/v1/content/generate-modular/route.ts` | Consumes `article.brief?.outline` through `db.article.findUnique({ include: { brief: true } })`. |

---

## 4. MongoDB Collection & Architecture Design

### Collection
- `content_briefs`

### Indexes
- `uniq_content_brief_id`: `{ id: 1 }` (unique)
- `idx_content_brief_websiteId`: `{ websiteId: 1 }`
- `idx_content_brief_keywordId`: `{ keywordId: 1 }`
- `idx_content_brief_clusterId`: `{ clusterId: 1 }`
- `idx_content_brief_status`: `{ status: 1 }`
- `idx_content_brief_createdAt`: `{ createdAt: -1 }`

### Operations to Implement
- `findById(id: string)`: Returns single brief.
- `findByWebsite(websiteId: string, filter?: { status?: string; limit?: number; offset?: number })`: Lists briefs with pagination.
- `createBrief(input: CreateContentBriefInput)`: Creates brief.
- `updateBrief(id: string, updates: UpdateContentBriefInput)`: Updates brief details, status, or outline.
- `upsertBrief(input: CreateContentBriefInput)`: Upserts brief based on ID or unique criteria.
- `deleteBrief(id: string)`: Deletes brief.
- `countBriefs(filter?: { websiteId?: string; status?: string })`: Counts briefs.
