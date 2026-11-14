# Phase I Discovery: Final Three Models Migration to Native MongoDB

**Project:** Apex SEO Engine  
**Local Workspace:** `D:\BloggingNew`  
**Target Database:** MongoDB Atlas (`sellzy-staging.tv1yvju.mongodb.net`, DB: `apex_seo`)  
**Audit Date:** 2026-11-14T18:04:00+05:00  

---

## 1. Executive Summary & Objective

In Phase I, the final three Prisma/PostgreSQL models are migrated to native MongoDB Atlas:
1. `SearchPerformance`: Daily Google Search Console query metrics (clicks, impressions, ctr, position) partitioned by website and date.
2. `SystemSetting`: Persistent platform settings, cryptographic secret flags, and persistent L2 cache for Pakistan Gold Rates (`gold_rates_cache_*`).
3. `AuditLog`: Append-only, immutable audit trail for security events, authentication attempts, rate limiting, and administrative mutations.

With Phase I completed, **all 24 application domain models** (100%) will have complete native MongoDB repositories and zero direct Prisma dependencies.

---

## 2. Prisma Model Deep-Dive

### 2.1 Model `SearchPerformance`
```prisma
model SearchPerformance {
  id          String   @id @default(uuid())
  websiteId   String
  website     Website  @relation(fields: [websiteId], references: [id], onDelete: Cascade)
  articleId   String?
  article     Article? @relation(fields: [articleId], references: [id], onDelete: SetNull)
  keywordId   String?
  keyword     Keyword? @relation(fields: [keywordId], references: [id], onDelete: SetNull)
  pageUrl     String
  query       String
  date        DateTime
  clicks      Int      @default(0)
  impressions Int      @default(0)
  ctr         Float    @default(0)
  position    Float    @default(0)

  createdAt   DateTime @default(now())

  @@unique([websiteId, pageUrl, query, date])
  @@index([websiteId, date])
  @@index([articleId])
  @@index([keywordId])
}
```
- **MongoDB Collection:** `search_performance`
- **Unique Indexes:** `{ id: 1 }`, `{ websiteId: 1, pageUrl: 1, query: 1, date: 1 }`
- **Query Indexes:** `{ websiteId: 1, date: -1 }`, `{ articleId: 1 }`, `{ keywordId: 1 }`

---

### 2.2 Model `SystemSetting`
```prisma
model SystemSetting {
  id          String   @id @default(uuid())
  category    String
  key         String   @unique
  value       Json
  isSecret    Boolean  @default(false)
  description String?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([category])
}
```
- **MongoDB Collection:** `system_settings`
- **Unique Indexes:** `{ id: 1 }`, `{ key: 1 }`
- **Query Indexes:** `{ category: 1 }`
- **Critical Dependency:** `pakistan-gold-rate-service.ts` uses `SystemSetting` keys prefixed with `gold_rates_cache_${citySlug}` to store and invalidate persistent L2 rates cache across distributed instances.

---

### 2.3 Model `AuditLog`
```prisma
model AuditLog {
  id         String   @id @default(uuid())
  userId     String?
  user       User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  action     String
  module     String
  entityType String?
  entityId   String?
  ipAddress  String?
  userAgent  String?
  metadata   Json     @default("{}")

  createdAt  DateTime @default(now())

  @@index([userId])
  @@index([module, action])
  @@index([createdAt])
}
```
- **MongoDB Collection:** `audit_logs`
- **Unique Index:** `{ id: 1 }`
- **Query Indexes:** `{ userId: 1 }`, `{ module: 1, action: 1 }`, `{ createdAt: -1 }`, `{ ipAddress: 1, action: 1, createdAt: -1 }` (for brute-force rate limit lookups)

---

## 3. Direct Prisma Query Inventory & Consumers

1. **`src/app/api/v1/content/factual-review/route.ts`**:
   - Lines 86-94: `db.auditLog.findMany({ where: { action: "RECORD_CLAIM_DECISION", ... } })`
2. **`src/app/api/v1/dashboard/route.ts`**:
   - Lines 32-35: `db.searchPerformance.findMany({ take: 500, orderBy: { date: "desc" } })`
   - Lines 56-60: `db.auditLog.findMany({ take: 8, orderBy: { createdAt: "desc" } })`
3. **`src/app/api/v1/settings/route.ts`**:
   - Lines 32-34: `db.systemSetting.findMany({ orderBy: [{ category: "asc" }, { key: "asc" }] })`
   - Lines 68-80: `db.systemSetting.upsert({ where: { key: item.key }, ... })`
4. **`src/lib/audit.ts`**:
   - Lines 41-52: `db.auditLog.create({ data: { ... } })`
5. **`src/lib/rate-limit.ts`**:
   - Lines 75-81: `db.auditLog.count({ where: { action: "AUTH_LOGIN_FAILED", ipAddress, createdAt: { gte } } })`
6. **`src/lib/seed-service.ts`**:
   - Lines 536-541: `db.systemSetting.upsert({ where: { key: s.key }, ... })`
7. **`src/services/automation/durable-job-queue.ts`**:
   - Line 538: `db.searchPerformance.count({ where: { websiteId: targetWebsiteId } })`
8. **`src/services/finance/pakistan-gold-rate-service.ts`**:
   - Lines 120-122: `db.systemSetting.findUnique({ where: { key: settingKey } })`
   - Lines 149-160: `db.systemSetting.upsert({ where: { key: settingKey }, ... })`
   - Lines 375-377: `db.systemSetting.deleteMany({ where: { category: "FINANCE_CACHE" } })`
9. **`tests/api-database.test.ts` & `tests/security-hardening.test.ts`**:
   - Test count & mock log checks.

---

## 4. Architectural Implementation Strategy

1. **Contracts & Validation Types (`src/repositories/system-repository.types.ts`)**:
   - Define Zod schemas and inputs for `SearchPerformance`, `SystemSetting`, and `AuditLog`.
   - Define unified interface `ISystemRepository`.
2. **Native MongoDB Repository (`src/repositories/mongo-system-repository.ts`)**:
   - Implement collection operations with native MongoDB 7.x driver.
   - Enforce compound indexes and uniqueness constraints.
   - Concurrency protection for settings and cache updates.
3. **Repository Factory (`src/repositories/system-repository.factory.ts`)**:
   - Export singleton `getSystemRepository()`.
4. **Migration Engine (`src/services/migration/system-migration-engine.ts`)**:
   - Safe, idempotent migration with dry-run support, count reconciliation, and deterministic mapping.
5. **Decouple All Consumers**:
   - Replace every direct Prisma reference in routes, services, and libraries with `getSystemRepository()`.
6. **Tests & Quality Verification**:
   - Create `tests/mongodb-system.test.ts` covering CRUD, Gold Rate cache persistence and concurrent refreshes, search analytics, and audit logging.
