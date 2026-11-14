# APEX SEO ENGINE — MONGODB PHASE B CORRECTION REPORT

**Date:** 2026-11-14  
**Author:** AI Architecture & Database Engineer  
**Objective:** Rectify default source-of-truth definition and establish MongoDB as the unambiguous application primary database.

---

## 1. Context & Prior Misalignment

In the initial draft of the Phase B report, PostgreSQL was described as the active default authentication backend with MongoDB framed merely as an opt-in secondary target.  
**This was an architectural misalignment.**

The owner's decision is explicit:
> **MongoDB Atlas is the intended PRIMARY database for Apex SEO Engine.** PostgreSQL/PGlite is legacy architecture that will be completely eliminated.

---

## 2. Immediate Architecture Correction Executed

1. **Default Repository Factory Updated:**
   - Modified `src/repositories/auth-repository.factory.ts`:
     ```typescript
     // DEFAULT IS NOW MONGODB
     const backend = (process.env.AUTH_STORAGE_BACKEND || "mongodb").toLowerCase();
     ```
   - When running without overrides, all authentication lookups, token version checks, and login credential validations execute natively against **MongoDB Atlas (`apex_seo`)**.
2. **PostgreSQL Role Redefined:**
   - PostgreSQL is strictly retained as a temporary safety rollback layer during intermediate phase implementations.
   - It is slated for 100% removal in Phase M.
3. **Verification of MongoDB Auth Under Default Configuration:**
   - Ran `tests/mongodb-auth-rbac.test.ts` with default environment settings.
   - **Result:** **6/6 tests passed**.
   - Proved that MongoDB:
     - Handles login authentication.
     - Validates bcrypt factor-12 hashes.
     - Enforces unique email constraints.
     - Validates and revokes JWTs via `tokenVersion`.
     - Strictly enforces tenant boundary isolation.

---

## 3. Recommended Next Implementation Step

**Phase C — Multi-Tenant Root Migration (`Website` and `Integration` models):**
- Create `src/repositories/mongo-website-repository.ts`.
- Migrate website ownership, CMS configurations (WordPress credentials encrypted with AES-256-GCM), and GSC integrations to MongoDB.
- Switch `/api/v1/websites` routes to MongoDB.
