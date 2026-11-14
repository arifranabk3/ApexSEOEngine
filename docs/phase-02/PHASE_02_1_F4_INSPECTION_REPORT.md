# APEX SEO ENGINE — PHASE 02.1-F4 ARCHITECTURE INSPECTION REPORT
## Internal Linking & Topical Authority Engine

- **Timestamp**: 2026-11-14T11:33:00+05:00
- **Milestone**: Phase 02.1-F4.1 (Architecture & Data Model Inspection)
- **Status**: COMPLETE & READY FOR APPROVAL
- **Database Migrations Required**: 0 (zero new tables, zero schema modifications)
- **Zero Paid API Policy**: 100% adhered to (deterministic graph algorithms + existing models)

---

## 1. Inspection of Existing Database Models & Relationships

### 1.1 `InternalLink` Model (Prisma Schema Lines 346–365)
The platform already possesses a normalized `InternalLink` PostgreSQL model:
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

#### Status Lifecycle Semantics:
- `"SUGGESTED"`: Generated candidate recommendation awaiting editorial review.
- `"APPROVED"`: Human editor has approved the recommendation for insertion.
- `"REJECTED"`: Human editor has dismissed the recommendation.
- `"INSERTED"`: Link is confirmed present in the source article markdown/HTML.
- `"REMOVED"`: Link was previously inserted but has been decommissioned.

### 1.2 `Article` & `ArticleVersion` Models
- **`Article`**: Contains `id`, `websiteId`, `title`, `slug`, `content` (Markdown), `focusKeyword`, `seoScore`, `briefId`, `categoryId`, and bidirectional link relations:
  - `outgoingLinks`: `InternalLink[] @relation("OutgoingArticleLinks")`
  - `incomingLinks`: `InternalLink[] @relation("IncomingArticleLinks")`
- **`ArticleVersion`**: Historical revisions tracking `versionNumber`, `content`, `changeSummary`. Ensures that if links are inserted, version history is retained without destructive overwrites.

### 1.3 `KeywordCluster`, `Keyword`, and `ContentBrief` Models
- **`KeywordCluster`**: Contains `id`, `websiteId`, `name`, `pillarKeyword`, `intent`, and relations to `Keyword[]` and `ContentBrief[]`.
- **`ContentBrief`**: Maps `keywordId`, `clusterId`, `outline` (JSON), `secondaryKeywords` (JSON), and `articles Article[]`.
- **Topical Hierarchy**: A pillar article is directly identified by matching `cluster.pillarKeyword === article.focusKeyword` or `brief.cluster.pillarKeyword`. Supporting cluster articles share the same `clusterId` but focus on secondary subtopics.

---

## 2. Capability Gap Analysis

| Requirement | Existing Codebase State | Gap to Bridge in F4 |
| :--- | :--- | :--- |
| **Data Schema** | `InternalLink` table exists in PostgreSQL schema with `sourceArticleId`, `targetArticleId`, `anchorText`, `targetUrl`, `status`, `relevanceScore`. | **None**. Schema is 100% complete and valid. |
| **Link Discovery Engine** | No automated discovery engine exists. Dashboard currently shows placeholder text under `activeNav === "internal-linking"`. | Create `src/services/seo/internal-linking-engine.ts` to compute lexical/topical similarity, keyword intersections, and anchor phrase suggestions. |
| **Topical Hierarchy Graph** | Topic clusters exist in DB (`KeywordCluster`), but no graph traversal maps pillar-to-cluster or cluster-to-pillar links. | Implement deterministic graph analyzer computing inbound/outbound edge counts and topological cluster mapping. |
| **Orphan Page Detection** | `IncomingArticleLinks` exists as relation, but no service queries 0-indegree or 0-outdegree articles. | Implement orphan detection filtering articles with 0 incoming or 0 outgoing internal links within the tenant website. |
| **Link Health & Broken Link Auditing** | No service verifies if `targetUrl` resolves to an active article slug within the same website. | Implement broken internal link detector checking if `targetArticleId` or `targetUrl` no longer exists or is non-published. |
| **API Endpoints** | No dedicated `/api/v1/content/internal-links` endpoint. | Implement route supporting discovery generation, listing recommendations, approving/rejecting, and updating link status with audit logs. |
| **Dashboard UI** | `DashboardShell.tsx` renders a static `renderPlaceholderModule` for `activeNav === "internal-linking"`. | Implement interactive `InternalLinkingPanel.tsx` with tabs for Overview, Recommendations, Orphan Pages, Pillar/Cluster Graph, and Link Health. |

---

## 3. Strict Safety, Security & Performance Boundaries

### 3.1 Tenant & Website Isolation
- Every query must strictly filter by `websiteId`.
- Recommendations across different `websiteId`s or different owner accounts are strictly disallowed.
- URLs must be relative or match the website domain (`/${targetArticle.slug}` or `${website.url}/${targetArticle.slug}`).

### 3.2 Non-Destructive Editorial Policy
- A recommendation (`status = "SUGGESTED"`) must **never** be treated as inserted.
- The system must **never** rewrite or mutate article markdown content automatically.
- Human editors approve or reject recommendations, preserving full editorial control.

### 3.3 Query Performance & Memory Efficiency
- Avoid unbounded full-text memory loads. For discovery, select only required fields (`id`, `title`, `slug`, `focusKeyword`, `briefId`, `categoryId`, `outgoingLinks`, `incomingLinks`).
- Use batching/pagination for websites with large article collections.
- Cache cluster relationships deterministically rather than invoking AI on every request.

---

## 4. Verification Gate & Recommendation

- **Prisma Schema**: Verified. No migrations needed.
- **Next Steps**:
  - Phase F4.2: Implement `src/services/seo/internal-linking-engine.ts` (lexical overlap, BM25-style keyword matching, anchor text extraction).
  - Phase F4.3: Implement Topical Cluster & Pillar Graph builder.
  - Phase F4.4: Implement Orphan Page and Broken Link Health auditing.
  - Phase F4.5: Implement `/api/v1/content/internal-links` route with RBAC and AuditLog tracking.
  - Phase F4.6: Implement `InternalLinkingPanel.tsx` in the dashboard.
  - Phase F4.7: Implement comprehensive test suite and verify production build.

---

**STOP & APPROVAL REQUEST**:
Architecture inspection is complete. No schema changes are required. We halt here and request owner approval of **Gate F4.1** before proceeding to **Phase F4.2**.
