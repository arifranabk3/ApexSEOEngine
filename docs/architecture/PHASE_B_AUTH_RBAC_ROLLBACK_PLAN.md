# APEX SEO ENGINE — PHASE B: AUTH & RBAC ROLLBACK PLAN

**Date:** 2026-11-14  
**Target:** Safe Rollback Architecture for Phase B  
**Status:** SPECIFICATION & RECONCILIATION PROTOCOL  

---

## 1. Rollback Strategy & Architecture

Phase B implements a zero-risk rollback mechanism that guarantees PostgreSQL remains 100% operational as the fallback data store.

### Rollback Mechanism:
1. **Repository Factory Toggle (`AUTH_STORAGE_BACKEND`):**
   - In `src/repositories/auth-repository.factory.ts`, the repository is resolved via:
     ```typescript
     const backend = (process.env.AUTH_STORAGE_BACKEND || "postgres").toLowerCase();
     ```
   - When unset or set to `"postgres"`, the platform uses `PostgresAuthRepository`.
   - When set to `"mongodb"`, the platform uses `MongoAuthRepository`.
2. **PostgreSQL Preservation (No Dual-Write Chaos):**
   - During Phase B, PostgreSQL records were never purged or truncated.
   - User credentials, role associations, and password hashes remain fully synchronized in PostgreSQL.
3. **Emergency Rollback Action:**
   - If any anomaly is observed during testing or pre-cutover, setting:
     ```env
     AUTH_STORAGE_BACKEND="postgres"
     ```
     instantly and synchronously routes all logins, password changes, and session validations back to PostgreSQL/Prisma within 0 milliseconds, requiring zero database restoration.

---

## 2. Reconciliation & Data State

Before declaring rollback readiness, record counts and relationships must reconcile 1:1 between PostgreSQL and MongoDB:
- **Permissions:** 12 in PostgreSQL -> 12 in MongoDB.
- **Roles:** 3 in PostgreSQL -> 3 in MongoDB.
- **Users:** Synced with exact matching bcrypt password hashes, tokenVersions, and account statuses.
- **Verification:** Automated tests in `tests/mongodb-auth-rbac.test.ts` verify that user IDs and email addresses match identically across both engines.
