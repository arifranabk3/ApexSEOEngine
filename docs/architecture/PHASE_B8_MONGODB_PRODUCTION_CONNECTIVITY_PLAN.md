# APEX SEO ENGINE — PHASE B.8: MONGODB PRODUCTION CONNECTIVITY & SAFE CUTOVER PLAN

**Date:** 2026-11-14  
**Cluster:** MongoDB Atlas (`sellzy-staging.tv1yvju.mongodb.net`)  
**Database:** `apex_seo`  
**Target:** Vercel Production Environment (`https://apexseoengine.vercel.app/`)  
**Status:** SPECIFICATION & EXECUTION BLUEPRINT (PLANNING ONLY)  

---

## 1. Executive Summary & Objective

The objective of Phase B.8 is to establish secure, verified production connectivity between Vercel Serverless Functions and MongoDB Atlas, enabling MongoDB to become the active production primary authentication database without disrupting existing application services or exposing PostgreSQL data.

---

## 2. Vercel Configuration & Networking Analysis

### A. Vercel Deployment Footprint:
- **Project Name:** `apexseoengine`
- **Plan:** Vercel Hobby (Zero-Cost Policy)
- **Deployment Regions:** Vercel serverless functions are deployed globally with primary execution in `iad1` (Washington, D.C., USA) and edge routing in `sin1` (Singapore), as evidenced by production headers `x-vercel-id: sin1::iad1::...`.
- **Runtime:** Node.js 20+ runtime within AWS Lambda infrastructure.

### B. Outbound Networking Options & Trade-Offs:

| Networking Approach | Security Level | Cost Impact | Compatibility with Vercel Hobby & Atlas M0/Shared | Recommendation |
|---|---|---|---|---|
| **1. Dedicated Static Egress IP** | Highest | **$1,000+/mo** (Requires Vercel Enterprise & Secure Compute) | Incompatible with Zero-Cost Policy | **REJECTED (Paid)** |
| **2. AWS VPC Peering / PrivateLink** | Enterprise | **$50+/mo** (Requires Atlas Dedicated Tier M10+) | Incompatible with Atlas Free/Shared Tier | **REJECTED (Paid)** |
| **3. Regional AWS CIDR IP Whitelist** | High | **Zero-Cost ($0)** | Can be whitelisted in Atlas, but AWS periodically updates ranges | **Acceptable Fallback** |
| **4. Atlas Standard Cloud Gateway (`0.0.0.0/0`)** | Standard Cloud Security | **Zero-Cost ($0)** | 100% Compatible with Vercel Hobby & Atlas Shared | **RECOMMENDED FOR STAGING/HOBBY** |

### C. Security Hardening for Atlas Cloud Gateway (`0.0.0.0/0`):
When network ingress is set to `0.0.0.0/0` in Atlas Free/Shared environments:
1. **Network Layer:** Encrypted with TLS 1.2+ / TLS 1.3 only; unencrypted plaintext connections on port 27017 are rejected by Atlas.
2. **Authentication Layer:** SCRAM-SHA-256 with cryptographically strong passwords prevents brute-force.
3. **Database Authorization:** Database user is restricted strictly to database `apex_seo` with `readWrite` privileges only (no cluster administrative privileges).

---

## 3. Production Environment Configuration Plan

The following environment variables must be configured in the **Vercel Dashboard** under **Project Settings → Environment Variables**:

### Variable 1: `MONGODB_URI`
- **Value:** Complete Atlas connection string targeting `apex_seo` (e.g. `mongodb+srv://<user>:<password>@sellzy-staging.tv1yvju.mongodb.net/apex_seo?retryWrites=true&w=majority`).
- **Target Environments:** Production, Preview, Development.
- **Sensitive:** Checked (Encrypted secret in Vercel).

### Variable 2: `AUTH_STORAGE_BACKEND`
- **Value:** `mongodb` (Explicitly instructs `auth-repository.factory.ts` to instantiate `MongoAuthRepository`).
- **Target Environments:** Production, Preview, Development.

### Variable 3: `SARAFA_API_KEY`
- **Value:** Configured Sarafa.pk Developer API key for live gold rates.
- **Target Environments:** Production, Preview, Development.

---

## 4. Non-Destructive Production Authentication Verification Plan

Once environment variables are deployed on Vercel, the following verification suite must be executed:

### Step 1: Health & Connectivity Probe
- Execute `GET https://apexseoengine.vercel.app/api/v1/health`.
- Expected Response: HTTP 200 with active connectivity confirmation.

### Step 2: Unauthenticated Route Protection
- Execute `GET https://apexseoengine.vercel.app/api/v1/auth/me`.
- Expected Response: HTTP 401 with `code: "UNAUTHORIZED"`.

### Step 3: Verified Staging Login (Non-Destructive)
- POST to `/api/v1/auth/login` with dedicated test staging account (`admin@apexseo.local`).
- Verify:
  1. Response returns HTTP 200 with valid `SessionUser` (`roleName: "SUPER_ADMIN"`).
  2. Response sets `apexseo_session` cookie (`httpOnly: true`, `secure: true`, `sameSite: "lax"`).
  3. Audit log records `AUTH_LOGIN_SUCCESS`.

### Step 4: Live Session & RBAC Verification
- Make an authenticated request using the returned session cookie to `/api/v1/auth/me`.
- Verify payload decoded from JWT matches MongoDB user document.
- Verify `tokenVersion` matches database state.

---

## 5. Rollback Procedure & Emergency Fallback

If any connection timeout, `SSL alert 80`, or authentication failure is observed after enabling MongoDB:

### Emergency Rollback Action (Execution Time < 60 seconds):
1. In Vercel Project Settings → Environment Variables:
   - Change `AUTH_STORAGE_BACKEND` to `postgres`.
2. Redeploy the latest Vercel deployment.
3. **Outcome:** The application instantly and safely reverts to PostgreSQL/Prisma authentication without code changes, data loss, or user lockout.

---

## 6. Production Cutover Checklist

- [ ] MongoDB Atlas Network Access updated for Vercel outbound connectivity.
- [ ] Vercel Environment Variables (`MONGODB_URI`, `AUTH_STORAGE_BACKEND`, `SARAFA_API_KEY`) configured in dashboard.
- [ ] Vercel deployment redeployed to ingest new environment variables.
- [ ] Public `/login` endpoint loads without console errors.
- [ ] Staging account login verified with HTTP 200.
- [ ] Session cookie validated via `/api/v1/auth/me`.
- [ ] Rollback toggle verified and tested.
