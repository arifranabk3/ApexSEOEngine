# APEX SEO ENGINE — PHASE B: AUTH & RBAC MODEL MAPPING SPECIFICATION (REVISED)

**Date:** 2026-11-14  
**Target Database:** MongoDB Atlas (`apex_seo`)  
**Status:** REVISED MAPPING SPECIFICATION  

---

## 1. Schema Mapping & Foreign Key Abstraction

Rather than changing the relational identifier format, all models in MongoDB preserve the application-level `id` (UUID string) alongside MongoDB's native `_id` (ObjectId). This guarantees seamless cross-collection references and full rollback compatibility with PostgreSQL.

### A. User Entity (`users` collection)

```typescript
import { z } from "zod";

export const UserEntitySchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  passwordHash: z.string().min(20),
  isActive: z.boolean().default(true),
  mustChangePassword: z.boolean().default(false),
  tokenVersion: z.number().int().default(0),
  roleId: z.string().uuid(),
  websiteIds: z.array(z.string().uuid()).default([]),
  lastLoginAt: z.date().nullable().optional(),
  passwordChangedAt: z.date().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});
export type UserEntity = z.infer<typeof UserEntitySchema>;
```

### B. Role Entity (`roles` collection)

```typescript
export const RoleEntitySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2),
  description: z.string().nullable().optional(),
  isSystem: z.boolean().default(false),
  permissionCodes: z.array(z.string()).default([]),
  version: z.number().int().default(1),
  createdAt: z.date(),
  updatedAt: z.date()
});
export type RoleEntity = z.infer<typeof RoleEntitySchema>;
```

### C. Permission Entity (`permissions` collection)

```typescript
export const PermissionEntitySchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(3),
  module: z.string().min(2),
  action: z.string().min(2),
  description: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});
export type PermissionEntity = z.infer<typeof PermissionEntitySchema>;
```

---

## 2. Dynamic Permission Resolution Contract

When resolving permissions for a session:
1. `User.roleId` is read from `users`.
2. The active `Role` document is retrieved by `id`.
3. `Role.permissionCodes` are returned along with `Role.version`.
4. If a user has `role.name === 'SUPER_ADMIN'`, `hasPermission` returns `true` automatically.
5. In JWT payloads, `roleVersion` is embedded. If the role's version in the database is greater than the JWT's embedded `roleVersion`, the session triggers an automatic permission refresh or requires re-authentication, preventing indefinitely trusted stale JWTs.
