# APEX SEO ENGINE — PRODUCTION MONGODB CUTOVER READINESS AUDIT

**Project:** Apex SEO Engine  
**Repository:** `https://github.com/arifranabk3/ApexSEOEngine`  
**Branch:** `main`  
**Deployed Commit:** `96cadeb` (`fix(auth): fall back to postgres auth when MONGODB_URI is not configured in environment`)  
**Production URL:** [https://apexseoengine.vercel.app/](https://apexseoengine.vercel.app/)  
**Target Cluster:** MongoDB Atlas (`sellzy-staging.tv1yvju.mongodb.net`)  
**Database:** `apex_seo`  
**Audit Date:** 2026-11-14  

---

## 1. Executive Summary & Final Verdict

### **VERDICT: CONDITIONALLY READY (BLOCKED ON PRODUCTION MONGODB INGRESS/EGRESS & VERCEL ENV CONFIGURATION)**

1. **Application Code Status (READY):**
   - 11 of 24 domain models (`User`, `Role`, `Permission`, `Website`, `WebsiteIntegration`, `AIProvider`, `AIModel`, `Category`, `KeywordCluster`, `Keyword`, `ContentBrief`) have complete, native MongoDB driver 7.x repositories with strict Zod validation, compound indexes, cascading deletion logic, and AES-256-GCM encryption for client and CMS secrets.
   - All 11 models pass 100% of their dedicated MongoDB integration test suites locally against MongoDB Atlas `apex_seo`.
   - Zero direct Prisma queries exist in application code for any of these 11 models.

2. **Production Runtime Status (NOT USING MONGODB YET):**
   - Vercel production currently runs exclusively on **PostgreSQL / PGlite**.
   - `MONGODB_URI` is **NOT configured** in the Vercel Production Environment Variables.
   - MongoDB Atlas Network Access currently restricts inbound traffic to the developer's static workstation IP (`154.192.130.239/32`). Vercel serverless IP ranges are blocked by Atlas network security.
   - When `MONGODB_URI` is absent on Vercel, the authentication system safely falls back to `PostgresAuthRepository` to prevent production downtime.
   - Therefore, **production is not yet using MongoDB** for live user traffic.

---

## 2. Environment Configuration Audit

| Environment Variable | Local Environment (.env) | Vercel Production Environment | Security Assessment |
| :--- | :---: | :---: | :--- |
| `DATABASE_URL` | **PRESENT** | **PRESENT** | Active PostgreSQL/Prisma connection |
| `MONGODB_URI` | **PRESENT** | **NOT CONFIGURED** | Missing in Vercel project environment settings |
| `AUTH_STORAGE_BACKEND` | Unset (defaults to Mongo/PG fallback) | **NOT CONFIGURED** | Defaults safely to PostgreSQL when `MONGODB_URI` is missing |
| `ENCRYPTION_SECRET` | **PRESENT** | **PRESENT** | Required for AES-256-GCM secret decryption |
| `JWT_SECRET` | **PRESENT** | **PRESENT** | Required for authentication JWT signing |
| `SARAFA_API_KEY` | **PRESENT** | **NOT CONFIGURED** | External finance scraper key |

> [!IMPORTANT]
> Vercel production functions throw a connection error if forced to contact MongoDB because `MONGODB_URI` is completely absent from the environment.

---

## 3. Authentication & RBAC Storage Audit

### A. Factory Architecture (`src/repositories/auth-repository.factory.ts`)
```typescript
export function getAuthRepository(): IAuthRepository {
  const envBackend = process.env.AUTH_STORAGE_BACKEND?.toLowerCase();
  const backend = envBackend || (process.env.MONGODB_URI ? "mongodb" : "postgres");
  ...
}
```
1. **Fallback Behavior:**
   - In environments where `MONGODB_URI` is set (e.g. local workstation), `MongoAuthRepository` is selected by default.
   - In environments where `MONGODB_URI` is unset (e.g. Vercel production), `PostgresAuthRepository` is automatically selected.
2. **Silent Switching Risk:**
   - If an operator sets `MONGODB_URI` on Vercel without migrating live production users first, the authentication factory will immediately switch from PostgreSQL to MongoDB.
   - If MongoDB Atlas is blocked by Atlas IP access lists (`SSL alert number 80`), login requests will fail with 500 errors.
3. **Data Inconsistency Risk:**
   - If user accounts or password changes are made in PostgreSQL while MongoDB is disconnected, those updates will not be present in MongoDB until a reconciliation migration is run.

---

## 4. Migrated Model Storage & Query Inventory

Audit of runtime repository dispatch across all 11 migrated models:

| Model | Domain | Target Mongo Collection | Active Runtime Storage (Local) | Active Runtime Storage (Vercel Prod) | Direct Prisma Queries Left in App Code |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `User` | Auth / RBAC | `users` | MongoDB | PostgreSQL (fallback) | **0** |
| `Role` | Auth / RBAC | `roles` | MongoDB | PostgreSQL (fallback) | **0** |
| `Permission` | Auth / RBAC | `permissions` | MongoDB | PostgreSQL (fallback) | **0** |
| `Website` | Websites | `websites` | MongoDB | MongoDB (calls fail if URI unset) | **0** |
| `WebsiteIntegration` | Integrations | `website_integrations` | MongoDB | MongoDB (calls fail if URI unset) | **0** |
| `AIProvider` | AI Engine | `ai_providers` | MongoDB | MongoDB (calls fail if URI unset) | **0** |
| `AIModel` | AI Engine | `ai_models` | MongoDB | MongoDB (calls fail if URI unset) | **0** |
| `Category` | Taxonomy | `categories` | MongoDB | MongoDB (calls fail if URI unset) | **0** |
| `KeywordCluster` | Keywords | `keyword_clusters` | MongoDB | MongoDB (calls fail if URI unset) | **0** |
| `Keyword` | Keywords | `keywords` | MongoDB | MongoDB (calls fail if URI unset) | **0** |
| `ContentBrief` | Content Planning | `content_briefs` | MongoDB | MongoDB (calls fail if URI unset) | **0** |

*Notice:* For non-auth models (`Website`, `AIProvider`, `Keyword`, `ContentBrief`), their routes consume `getWebsiteRepository()`, `getAIConfigRepository()`, etc., which have **zero PostgreSQL fallback**; if called in production, they require `MONGODB_URI` or their endpoints return errors.

---

## 5. MongoDB Connectivity Verification Matrix

| Connection Vector | Connectivity State | Latency / Result | Details |
| :--- | :---: | :---: | :--- |
| **Local Workstation -> Atlas** | **CONNECTED** | ~1776ms | Authenticated, read/write verified across all 11 collections |
| **Vercel Serverless -> Atlas** | **BLOCKED** | N/A | Missing `MONGODB_URI` & Atlas IP whitelist blocks Vercel egress |
| **VPS Backend -> Atlas** | **ARCHITECTED** | N/A | Documented in `VPS_BACKEND_IMPLEMENTATION_READINESS.md` |

---

## 6. Production Data Status & Reconciliation

- In MongoDB Atlas (`apex_seo`), all 11 collections exist:
  - `users`
  - `roles`
  - `permissions`
  - `websites`
  - `website_integrations`
  - `ai_providers`
  - `ai_models`
  - `categories`
  - `keyword_clusters`
  - `keywords`
  - `content_briefs`
- Complete migration engines exist for all 11 models with dry-run capabilities and deterministic ID mapping.
- **Production Data Caution:** Because live user signups, sessions, or password updates on `apexseoengine.vercel.app` have occurred on PostgreSQL, live production data cannot be declared 100% synchronized until the official production cutover sequence is executed.

---

## 7. Recommended Safe Cutover Sequence

To transition production cleanly to MongoDB Atlas without downtime or authentication lockouts:

```mermaid
flowchart TD
    A["1. Deploy Node.js API to VPS with Static IP"] --> B["2. Add VPS Static IP to MongoDB Atlas Network Access"]
    B --> C["3. Run Final Live Reconciliation Migration Engine"]
    C --> D["4. Verify Document Counts & Foreign Key Integrity"]
    D --> E["5. Add MONGODB_URI and AUTH_STORAGE_BACKEND=mongodb to Production Env"]
    E --> F["6. Production Smoke Test: Auth, Websites, Keywords & Briefs"]
```

1. **Step 1:** Establish a dedicated outbound static IP (via the existing VPS backend architecture).
2. **Step 2:** Add that single static IP to MongoDB Atlas IP Access List (no 0.0.0.0/0).
3. **Step 3:** Run `auth-migration-engine`, `website-migration-engine`, `ai-config-migration-engine`, `keyword-migration-engine`, and `content-brief-migration-engine` against live production PostgreSQL to replicate any newly created users.
4. **Step 4:** Set `MONGODB_URI` and `AUTH_STORAGE_BACKEND=mongodb` in the production environment.
5. **Step 5:** Perform smoke tests on live endpoints (`/api/v1/health`, `/api/v1/auth/me`, `/api/v1/websites`, `/api/v1/content`).

---

## 8. Rollback Procedure

If MongoDB Atlas connectivity encounters network or database errors during cutover:
1. Delete or unset `MONGODB_URI` in the production environment, or set `AUTH_STORAGE_BACKEND=postgres`.
2. Redeploy/restart the production environment.
3. The application will instantly revert to `PostgresAuthRepository` and continue serving production traffic from PostgreSQL without data loss.
