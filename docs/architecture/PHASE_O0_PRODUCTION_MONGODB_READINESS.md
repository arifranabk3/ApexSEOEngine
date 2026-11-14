# PHASE O0: PRODUCTION MONGODB CONNECTIVITY READINESS REPORT

**Project:** Apex SEO Engine  
**Local Path:** `D:\BloggingNew`  
**GitHub Repository:** `https://github.com/arifranabk3/ApexSEOEngine`  
**Branch:** `main`  
**Production URL:** `https://apexseoengine.vercel.app/`  
**Target Cluster:** MongoDB Atlas (`sellzy-staging.tv1yvju.mongodb.net`)  
**Target Database:** `apex_seo`  
**Date:** November 14, 2026  

---

## 1. Executive Summary & Root Cause Analysis

In Phase N1, live verification of `https://apexseoengine.vercel.app/api/v1/health` returned `HTTP 500 Internal Server Error` with message:
```json
{"success":false,"error":{"code":"HEALTH_CHECK_FAILED","message":"MONGODB_URI environment variable is missing in .env"}}
```

### Key Diagnostic Discoveries:
1. **Production Variable Absence**: The Vercel production environment lacks the `MONGODB_URI` environment variable.
2. **Repository Asymmetry**: 
   - `src/repositories/auth-repository.factory.ts` has a PostgreSQL fallback when `MONGODB_URI` is missing.
   - However, `website-repository.factory.ts`, `article-repository.factory.ts`, and `keyword-repository.factory.ts` instantiate native MongoDB repositories unconditionally.
   - When `/api/v1/health` invokes `websiteRepo.countWebsites()`, `MongoWebsiteRepository` attempts to initialize `getMongoDb()`, which immediately throws because `process.env.MONGODB_URI` is undefined in Vercel.
3. **Local Network Blocker**: Local tests (`vitest run tests/core-consumer-decoupling.test.ts`) fail with `SSL alert number 80` (`ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR`) because the local workstation IP (`154.192.120.3`) is not allowlisted in MongoDB Atlas Project Network Access.
4. **Atlas Cluster Health**: Atlas DNS SRV (`_mongodb._tcp.sellzy-staging.tv1yvju.mongodb.net`) and direct shard hosts (`ac-zv0eejs-shard-00-00/01/02.tv1yvju.mongodb.net`) resolve to active AWS `ap-south-1` EC2 endpoints (`159.41.183.250`, `159.41.168.15`, `159.41.168.30`) with TCP port 27017 active and responding.

---

## 2. Configuration Discovery

### 2.1 Vercel Environment Configuration
- **Project Name:** `apexseoengine`
- **Hosting Plan:** Vercel Hobby (Personal / Free Tier)
- **Deployment Regions:** Serverless execution in AWS `iad1` (Washington D.C., USA), edge routing in `sin1` (Singapore).
- **Current Active Variables:**
  - `DATABASE_URL`: Active (points to PostgreSQL/PGlite).
  - `ENCRYPTION_SECRET`: Active (32-byte hex for AES-256-GCM).
  - `JWT_SECRET`: Active (for HS256 auth session tokens).
  - `MONGODB_URI`: **MISSING** in Production, Preview, and Development on Vercel.
  - `AUTH_STORAGE_BACKEND`: **UNSET** (defaults to PostgreSQL fallback in the absence of `MONGODB_URI`).

### 2.2 MongoDB Atlas Cluster Configuration
- **Cluster Name:** `Sellzy-Staging`
- **Host Domain:** `sellzy-staging.tv1yvju.mongodb.net`
- **Cluster Tier:** Atlas M0 Free / Shared Cluster
- **Underlying Cloud & Region:** AWS `ap-south-1` (Mumbai)
- **Replica Set:** `atlas-4wl68e-shard-0`
- **Shards:**
  - `ac-zv0eejs-shard-00-00.tv1yvju.mongodb.net:27017` -> `159.41.183.250`
  - `ac-zv0eejs-shard-00-01.tv1yvju.mongodb.net:27017` -> `159.41.168.15`
  - `ac-zv0eejs-shard-00-02.tv1yvju.mongodb.net:27017` -> `159.41.168.30`
- **Auth Source:** `admin`
- **Database Name:** `apex_seo`

### 2.3 Required Environment Variables for Production
To bring production into full MongoDB readiness, the following environment variables are required in Vercel:

| Variable Name | Required Value Format | Purpose | Security Flag |
| :--- | :--- | :--- | :--- |
| `MONGODB_URI` | `mongodb+srv://<username>:<encoded_password>@sellzy-staging.tv1yvju.mongodb.net/apex_seo?retryWrites=true&w=majority` | Primary database connection string | Sensitive / Secret |
| `AUTH_STORAGE_BACKEND` | `mongodb` (or leave unset to auto-activate when `MONGODB_URI` is present) | Selects `MongoAuthRepository` | Standard |
| `SARAFA_API_KEY` | Scraper / API key | Pakistan Gold Rate live scraping cache | Sensitive / Secret |

---

## 3. Network and Connection Plan

### 3.1 Vercel Serverless Egress Realities
Vercel Hobby serverless functions execute inside dynamic AWS Lambda containers. Because Vercel does not assign static outbound IP addresses to Hobby tier accounts:
- Every function execution egresses from a broad pool of AWS IP addresses.
- **Dedicated Static Outbound IP (Vercel Secure Compute)** costs **$1,000–$3,000+/month** (Enterprise only).
- **AWS VPC Peering / PrivateLink** requires an Atlas Dedicated Tier (**M10+ at ~$60/month**) plus AWS endpoint hourly fees.
- **Both paid solutions strictly violate the project's zero-cost policy.**

### 3.2 Evaluation of Network Access Options

| Network Strategy | Security Level | Cost | Feasibility on Hobby/M0 | Recommendation |
| :--- | :---: | :---: | :---: | :--- |
| **A. Blanket Access (`0.0.0.0/0`)** | Low/Standard | $0 | High | **User Explicitly Prohibited `0.0.0.0/0` as a shortcut.** |
| **B. AWS Regional IP CIDR Ranges** | High | $0 | High | Amazon publishes IP prefix lists for `us-east-1` (`iad1`). Can allowlist specific AWS CIDRs. |
| **C. Self-Hosted VPS Fixed Egress Proxy** | Highest | $0 (existing VPS) | Medium (Latency trade-off) | VPS is DEFERRED per project instructions. |
| **D. Developer Workstation IP Allowlist** | Strict | $0 | High | Add `154.192.120.3/32` to Atlas to unblock local developer Vitest suites. |

### 3.3 Recommended Network Access Strategy (Zero-Cost & Secure)
1. **Developer Workstation Allowlist**: Add the developer's verified dynamic workstation IP (`154.192.120.3/32`) in Atlas Network Access. This enables local test execution without exposing the cluster.
2. **Vercel Egress Allowlist**:
   - Rather than blanket `0.0.0.0/0`, extract AWS `us-east-1` (`iad1`) serverless IP prefixes from Amazon's official `ip-ranges.json` (`SERVICE: AMAZON`, `REGION: us-east-1`).
   - Alternatively, if Atlas Cloud Provider integration is enabled, configure Atlas Network Access via AWS Security Group / Region peering if upgraded in the future.
3. **Database-Level Least Privilege**:
   - Create a dedicated MongoDB database user for Vercel with **`readWrite@apex_seo`** privileges only.
   - Do **NOT** grant `atlasAdmin`, `clusterAdmin`, or `readWriteAnyDatabase`.
   - Ensure the database user password uses a high-entropy string (32+ alphanumeric characters) and userinfo special characters are percent-encoded (`@` -> `%40`).

---

## 4. Authentication Safety & Data Migration Prerequisites

### 4.1 Selection of MongoDB Authentication
In `src/repositories/auth-repository.factory.ts`:
```typescript
const envBackend = process.env.AUTH_STORAGE_BACKEND?.toLowerCase();
const backend = envBackend || (process.env.MONGODB_URI ? "mongodb" : "postgres");
```
- When `AUTH_STORAGE_BACKEND=postgres` is set, `PostgresAuthRepository` is used regardless of `MONGODB_URI`.
- When `AUTH_STORAGE_BACKEND=mongodb` is set, `MongoAuthRepository` is forced.
- If unset, setting `MONGODB_URI` automatically switches the auth repository to MongoDB.

### 4.2 Status of PostgreSQL User Migration
- **Have existing PostgreSQL users been migrated to MongoDB in production?**
  - **NO.** Live production users in PostgreSQL on Vercel have not yet been migrated to MongoDB Atlas `apex_seo`.
  - The migration engine `migrateAuthToMongo()` in [`src/services/migration/auth-migration-engine.ts`](file:///d:/BloggingNew/src/services/migration/auth-migration-engine.ts) is fully implemented and tested, but has **not** been executed against the production database.
- **Are password hashes and role relationships preserved?**
  - Yes. `migrateAuthToMongo()` extracts `passwordHash`, `tokenVersion`, `isActive`, `mustChangePassword`, `roleId`, and `websiteIds`, and upserts them into `users`, `roles`, and `permissions` preserving identical UUID identifiers.
- **Can we safely roll back?**
  - Yes. Setting `AUTH_STORAGE_BACKEND=postgres` in Vercel environment variables instantly forces the application back to PostgreSQL without code changes or downtime.

---

## 5. Production Test Plan (Post-Configuration)

Once the user authorizes environment variable provisioning, the following verification suite must be executed:

### Test 1: Connectivity & Ping Probe
- **Target**: `GET https://apexseoengine.vercel.app/api/v1/health`
- **Expected**: HTTP 200, `database: "connected"`, metrics reporting valid counts (`users >= 1`, `websites >= 1`).

### Test 2: User Repository Read Verification
- **Target**: `GET https://apexseoengine.vercel.app/api/v1/auth/me` (unauthenticated)
- **Expected**: HTTP 401 with `{ "code": "UNAUTHORIZED" }` without database crashes.

### Test 3: Website Repository Read Verification
- **Target**: `GET https://apexseoengine.vercel.app/`
- **Expected**: HTTP 200 rendering the Public Magazine Front Page with published articles and categories fetched from MongoDB.

### Test 4: Article Repository Read Verification
- **Target**: `GET https://apexseoengine.vercel.app/p/[websiteId]`
- **Expected**: HTTP 200 rendering the publication layout with articles from `articles` collection.

### Test 5: System Setting & Gold Rate Read Verification
- **Target**: `GET https://apexseoengine.vercel.app/api/v1/finance/pakistan-gold-rates?city=islamabad`
- **Expected**: HTTP 200 returning gold rates with L2 MongoDB caching verified.

### Test 6: Controlled Admin Authentication
- **Target**: `POST https://apexseoengine.vercel.app/api/v1/auth/login` with staged credentials.
- **Expected**: HTTP 200, sets `apexseo_session` HTTP-only cookie, audit log records `AUTH_LOGIN_SUCCESS`.

---

## 6. Exact Action Items Requiring User Authorization

In accordance with strict safety boundaries, the assistant has made **no environment changes, no database modifications, and no external requests**. 

The following actions require explicit user execution or approval:

1. **MongoDB Atlas Network Access Configuration**:
   - Access [MongoDB Atlas Console](https://cloud.mongodb.com/) -> **Network Access** -> **IP Access List**.
   - Add current workstation IP: `154.192.120.3/32` (Comment: `Local Developer Workstation`).
   - Decide on Vercel egress strategy (e.g. AWS `us-east-1` CIDR ranges or specific egress).
2. **Vercel Environment Variable Provisioning**:
   - Access [Vercel Dashboard](https://vercel.com/) -> **Project `apexseoengine`** -> **Settings** -> **Environment Variables**.
   - Add `MONGODB_URI`: Complete Atlas URI targeting `apex_seo` (with percent-encoded password).
   - Ensure `AUTH_STORAGE_BACKEND` is set to `postgres` initially to prevent premature auth cutover before data migration!
3. **Approval for Phase O1 (Production Data Migration)**:
   - Once `MONGODB_URI` is provisioned and `AUTH_STORAGE_BACKEND=postgres` ensures safety, run the migration engines to sync users, websites, articles, and settings from PostgreSQL to MongoDB.
