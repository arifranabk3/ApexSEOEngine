# APEX SEO ENGINE — PHASE B: AUTHENTICATION & RBAC MIGRATION PLAN (REVISED)

**Date:** 2026-11-14  
**Target Database:** MongoDB Atlas (`apex_seo`)  
**Status:** ARCHITECTURAL SPECIFICATION & REVISED MIGRATION PLAN  

---

## 1. Architectural Weaknesses in Prior Draft & Mandatory Corrections

### Correction 1: Elimination of Static Denormalized Permission Snapshots
- **Prior Flaw:** The draft suggested embedding a static `permissions: string[]` inside `users` and bulk-updating all users when a role changes.
- **Architectural Risk:** 
  1. Race conditions during bulk writes across distributed workers.
  2. Stale JWT tokens trusting outdated permission arrays until expiration.
  3. Desynchronization between `roles` and `users`.
- **Adopted Correction:** 
  - `users` only references `roleId`.
  - Introduce **Role Versioning (`roleVersion: number`)** and **Permission Versioning (`permissionVersion: number`)**.
  - During session verification, cached permission lookups resolve permissions centrally via role definition and verify against `roleVersion`. Any role mutation increments `roleVersion`, immediately invalidating stale permissions without requiring full document rewrites across all users.

### Correction 2: Clean Repository Pattern (Zero Duplication of Business Logic)
- **Design:** Define an abstract interface `IAuthRepository`:
  - `findUserByEmail(email: string): Promise<UserEntity | null>`
  - `findUserById(id: string): Promise<UserEntity | null>`
  - `createUser(user: CreateUserInput): Promise<UserEntity>`
  - `updatePassword(id: string, hash: string, nextVersion: number): Promise<void>`
  - `updateLastLogin(id: string, date: Date): Promise<void>`
  - `getRoleWithPermissions(roleId: string): Promise<RoleWithPermissions | null>`
  - `verifyTenantAccess(userId: string, websiteId: string): Promise<boolean>`
- **Implementations:**
  - `PostgresAuthRepository` (wraps Prisma/PGlite)
  - `MongoAuthRepository` (official MongoDB driver 7.x with Zod validation)
- **Business Logic Layer:** `src/lib/auth.ts` uses dependency injection or dynamic repository resolution based on `AUTH_STORAGE_BACKEND`, ensuring password hashing, JWT signing, and RBAC rules remain 100% unified.

---

## 2. Collection Architecture & Versioned RBAC

### Collections:
1. **`users`**:
   - `_id`: ObjectId
   - `id`: string (UUID)
   - `email`: string (Unique index)
   - `name`: string
   - `passwordHash`: string
   - `isActive`: boolean
   - `mustChangePassword`: boolean
   - `tokenVersion`: number (Session invalidation counter)
   - `roleId`: string (References `roles.id`)
   - `websiteIds`: string[] (Tenant website ownership references)
   - `lastLoginAt`?: Date
   - `passwordChangedAt`?: Date
   - `createdAt`: Date
   - `updatedAt`: Date

2. **`roles`**:
   - `_id`: ObjectId
   - `id`: string (UUID)
   - `name`: string (Unique index, e.g. "SUPER_ADMIN", "EDITOR", "VIEWER")
   - `description`?: string
   - `isSystem`: boolean
   - `permissionCodes`: string[]
   - `version`: number (Incremented on permission changes for immediate invalidation)
   - `createdAt`: Date
   - `updatedAt`: Date

3. **`permissions`**:
   - `_id`: ObjectId
   - `id`: string (UUID)
   - `code`: string (Unique index, e.g. `websites:read`, `content:write`)
   - `module`: string
   - `action`: string
   - `description`?: string
   - `createdAt`: Date
   - `updatedAt`: Date

---

## 3. Implementation Sequence & Execution Gates

| Milestone | Scope | Deliverables & Verification |
|---|---|---|
| **B.2** | Foundations & Contracts | `IAuthRepository`, `PostgresAuthRepository`, `MongoAuthRepository`, Zod schemas |
| **B.3** | JWT & Auth Integration | Updated `auth.ts`, unified credential & session validation |
| **B.4** | Idempotent Migration Tool | `scripts/migrate-auth-to-mongo.ts` with dry-run, checkpoint, and referential validation |
| **B.5** | Test Suite Execution | `tests/mongodb-auth-rbac.test.ts`, regression verification of existing tests |
| **B.6** | Reconciliation & Rollback | `docs/architecture/PHASE_B_AUTH_RBAC_ROLLBACK_PLAN.md` & `PHASE_B_AUTH_RBAC_SECURITY_REVIEW.md` |
| **B.7** | Readiness Assessment | Complete report for owner approval (NO production cutover) |
