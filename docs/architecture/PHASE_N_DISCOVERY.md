# PHASE N — REMAINING CORE PRISMA CONSUMERS DECOUPLING DISCOVERY

**Date**: November 14, 2026  
**Repository**: [https://github.com/arifranabk3/ApexSEOEngine](https://github.com/arifranabk3/ApexSEOEngine)  
**Branch**: `main`  
**Production URL**: [https://apexseoengine.vercel.app/](https://apexseoengine.vercel.app/)  

---

## 1. Objective & Scope

This discovery document details the decoupling plan for the remaining 7 active core application consumers identified in Phase M:
1. `src/lib/seed-service.ts`
2. `src/app/api/v1/health/route.ts`
3. `src/app/page.tsx`
4. `src/app/p/[websiteId]/page.tsx`
5. `src/app/api/v1/auth/change-password/route.ts`
6. `src/app/api/v1/compliance/route.ts`
7. `src/app/api/v1/content/topic-outline/route.ts`

And checks for any other lingering active consumer files across `src/app/` and `src/lib/`.
*(Note: `src/app/api/v1/jobs/route.ts` only imported `isExternalManagedDatabase()` which checks `DATABASE_URL` string presence, not direct queries; it will be preserved for backward compatibility).*

---

## 2. Inventory of Target Files & Decoupling Strategy

### 2.1 `src/lib/seed-service.ts`
- **Current Prisma Operations**:
  - `db.permission.upsert`: 12 default permissions.
  - `db.role.upsert`: `SUPER_ADMIN`, `EDITOR`, `VIEWER`.
  - `db.user.findUnique`, `db.user.create`, `db.user.update`: Default admin `admin@apexseo.local`.
  - `db.website.count`, `db.website.create`: Default primary website `Apex Tech Journal`.
  - `db.websiteIntegration.createMany`: WordPress, GSC, n8n integrations.
  - `db.website.findFirst`: Used to locate primary site for showcase articles.
- **Target Native Repositories**:
  - `IAuthRepository`:
    - Add `upsertPermission(input: CreatePermissionInput): Promise<PermissionEntity>`
    - Add `upsertRole(input: CreateRoleInput): Promise<RoleEntity>`
    - Add `updateUser(id: string, updates: UpdateUserInput): Promise<UserEntity | null>`
    - Add `countUsers(): Promise<number>`
  - `IWebsiteRepository`:
    - Use `listWebsites()` / `findWebsiteByUrl()` / `createWebsite()` / `upsertIntegration()`
    - Add `countWebsites(): Promise<number>`
  - `IKywordDomainRepository`:
    - Use `upsertCategory()`, `createCluster()`, `upsertKeyword()` (already available).
  - `IArticleRepository`:
    - Use `findArticleBySlug()`, `createArticle()` (already available).

### 2.2 `src/app/api/v1/health/route.ts`
- **Current Prisma Operations**:
  - `await db.user.count()`
  - `await db.website.count()`
- **Target Native Repositories**:
  - Check real MongoDB connectivity via `checkMongoHealth()` in `src/lib/mongodb.ts`.
  - If connected, query counts from `authRepo.countUsers()` and `websiteRepo.countWebsites()`.
  - Report genuine `database: "connected"` or `database: "disconnected"` with status 200 vs 503.

### 2.3 `src/app/page.tsx`
- **Current Prisma Operations**:
  - Queries `db.website.findFirst({ orderBy: { createdAt: "asc" }, include: { categories: true, articles: { where: { status: "PUBLISHED" }, include: { category: true, author: true } } } })`.
- **Target Native Repositories**:
  - Use `websiteRepo.listWebsites()` to find first website.
  - Use `keywordRepo.findCategoriesByWebsite(website.id)` to load categories.
  - Use `articleRepo.findArticlesByWebsite(website.id, { status: "PUBLISHED", orderBy: "publishedAt", orderDir: "desc" })` to load published articles.
  - Join author details and category names in memory (zero N+1 queries).

### 2.4 `src/app/p/[websiteId]/page.tsx`
- **Current Prisma Operations**:
  - Queries `db.website.findUnique({ where: { id: websiteId }, include: { categories: true, articles: { where: { status: "PUBLISHED" }, include: { category: true, author: true } } } })`.
- **Target Native Repositories**:
  - Use `websiteRepo.findWebsiteById(websiteId)` (or `findWebsiteByUrl` if custom domain).
  - Use `keywordRepo.findCategoriesByWebsite(website.id)`.
  - Use `articleRepo.findArticlesByWebsite(website.id, { status: "PUBLISHED" })`.
  - In-memory join for author & category.
  - Handle not-found cleanly with `notFound()`.

### 2.5 `src/app/api/v1/auth/change-password/route.ts`
- **Current Prisma Operations**:
  - Queries `db.user.findUnique({ where: { id: user.id }, include: { role: { include: { permissions: true } } } })`.
- **Target Native Repositories**:
  - Use `authRepo.findUserById(user.id)` which returns `{ user, role, permissions }`.
  - Verify password hash using `verifyPassword`.
  - Update password hash using `authRepo.updatePassword(user.id, newHash, nextVersion)`.

### 2.6 `src/app/api/v1/compliance/route.ts`
- **Current Prisma Operations**:
  - Queries `db.website.findUnique` or `db.website.findFirst` with `articles` and `categories` relational includes.
- **Target Native Repositories**:
  - Use `websiteRepo.findWebsiteById(requestedSiteId)` or `websiteRepo.listWebsites()`.
  - Use `articleRepo.findArticlesByWebsite(website.id)` and `keywordRepo.findCategoriesByWebsite(website.id)`.

### 2.7 `src/app/api/v1/content/topic-outline/route.ts`
- **Current Prisma Operations**:
  - Queries `db.website.findUnique({ where: { id: targetWebsiteId } })`.
- **Target Native Repositories**:
  - Use `websiteRepo.findWebsiteById(targetWebsiteId)`.
  - Preserve tenant authorization check: `isSuperAdmin || website.ownerId === user.id`.

---

## 3. Repositories to Enhance with Clean Methods

1. **`IAuthRepository` (`src/repositories/auth-repository.types.ts`)**:
   - `countUsers(): Promise<number>;`
   - `upsertPermission(input: { code: string; module: string; action: string; description?: string }): Promise<PermissionEntity>;`
   - `upsertRole(input: { name: string; description?: string; isSystem?: boolean; permissionCodes: string[] }): Promise<RoleWithPermissions>;`
   - `updateUser(id: string, updates: Partial<{ mustChangePassword: boolean }>): Promise<UserEntity | null>;`

2. **`IWebsiteRepository` (`src/repositories/website-repository.types.ts`)**:
   - `countWebsites(ownerId?: string): Promise<number>;`

3. **Implementations**:
   - Implement these methods on `MongoAuthRepository` and `MongoWebsiteRepository`.
   - Implement matching fallback/stubs on `PostgresAuthRepository` where applicable so interface contracts remain satisfied.
