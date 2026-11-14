# APEX SEO ENGINE — VPS BACKEND IMPLEMENTATION READINESS AUDIT

**Date:** 2026-11-14  
**Project Path:** `D:\BloggingNew`  
**Repository:** `https://github.com/arifranabk3/ApexSEOEngine`  
**Audit Purpose:** Independent validation of VPS backend hosting feasibility and MongoDB Atlas `/32` allowlist architecture.  
**Execution Type:** READ-ONLY AUDIT (INSPECTION ONLY)  

---

## 1. Executive Verdict: CONDITIONALLY READY

### Verdict Justification:
- **Why NOT Fully READY:**  
  While the application architecture cleanly supports a headless API backend, the specific physical/cloud VPS (IP address, root SSH access, available RAM/CPU, Nginx/PM2 installation status) is external to the git workspace and is currently **NOT VERIFIED**. Furthermore, only 3 of the 24 application models (`User`, `Role`, `Permission`) are migrated to MongoDB; 21 models still depend on PostgreSQL/PGlite.
- **Why NOT "NOT READY":**  
  The application is Next.js 15 with headless route handlers (`/api/v1/*`), stateless JWT sessions, decoupled repository interfaces (`IAuthRepository`), and zero file-system persistence dependencies (media is SVG or URL-based). It can be transitioned to run under Node.js on a VPS without re-architecting the frontend.

---

## 2. Evidence Table & Verification Status

| Investigation Item | Claim / Requirement | Source Evidence | Status |
|---|---|---|:---:|
| **VPS Provider & Spec** | Hardware specs (CPU, RAM, Disk) | Git workspace & `.env` inspection | **NOT VERIFIED** (External to repo) |
| **VPS Static IP** | Dedicated static IPv4 address | Workstation IP check (`api.ipify.org`) shows dynamic broadband | **NOT VERIFIED** (Awaiting user VPS IP) |
| **Web Server / Process Manager** | Nginx, PM2, Node.js installed | No SSH connection configured in repo | **NOT VERIFIED** |
| **API Route Decoupling** | 22 API endpoints in `src/app/api/v1` | AST file scan of `src/app/api/v1/**/route.ts` | **VERIFIED** |
| **MongoDB Atlas Target** | Host `sellzy-staging.tv1yvju.mongodb.net` | Live Vitest ping & SRV DNS resolution | **VERIFIED** |
| **PostgreSQL Independence** | Application runs 100% on MongoDB | Codebase scan shows 30 files importing `@/lib/db` | **FAILED** (21 models still use Postgres) |
| **Stateless Authentication** | JWT tokens with `jose` HS256 | `src/lib/auth.ts` implementation | **VERIFIED** |
| **Tenant Isolation** | Multi-tenant website boundaries | `verifyTenantAccess()` in repository layer | **VERIFIED** |
| **Zero-Cost Compliance** | No paid cloud add-ons required | Vercel Hobby + Atlas M0 + User's existing VPS | **VERIFIED** (Conditional on existing VPS) |

---

## 3. Investigation of Failed Prior Shell Commands

During the earlier turn, two PowerShell commands exited with code 1:
1. **n8n / Ollama Environment Scanner:**
   - *Cause:* PowerShell parser error (`Missing variable name after foreach`). In PowerShell, passing multiline strings with unescaped `$` variables (e.g. `$m in $matches`) caused the shell parser to treat `$m` as an empty variable, resulting in `foreach ( in )`.
   - *Resolution:* Fixed by executing node-based script inspectors. Verified that `.env` contains:
     - `DEFAULT_OLLAMA_BASE_URL=http://localhost:11434`
     - `N8N_BASE_URL=http://localhost:5678`
     - `N8N_WEBHOOK_BASE_URL=http://localhost:5678`
2. **API Route Listing:**
   - *Cause:* Same PowerShell string substitution bug in `foreach ($f in $files)`.
   - *Resolution:* Resolved cleanly via `inventory-api-routes.js`. Verified exact count: **22 API route handlers** under `src/app/api/v1/`.

---

## 4. Application Architecture & Migration Inventory

### A. Full Inventory of 22 API Routes:

| Route Path | Current Storage Backend | Target Storage Backend | Can Run on VPS? |
|---|:---:|:---:|:---:|
| `/api/v1/auth/login` | **MongoDB (Primary)** | MongoDB Atlas | Yes |
| `/api/v1/auth/logout` | Stateless (Cookie clear) | Stateless | Yes |
| `/api/v1/auth/me` | **MongoDB (Primary)** | MongoDB Atlas | Yes |
| `/api/v1/auth/change-password` | **MongoDB (Primary)** | MongoDB Atlas | Yes |
| `/api/v1/websites` & `/api/v1/websites/[id]` | PostgreSQL / Prisma | MongoDB Atlas (Phase C) | Yes |
| `/api/v1/integrations` | PostgreSQL / Prisma | MongoDB Atlas (Phase C) | Yes |
| `/api/v1/ai-providers` | PostgreSQL / Prisma | MongoDB Atlas (Phase D) | Yes |
| `/api/v1/content` (crud, search) | PostgreSQL / Prisma | MongoDB Atlas (Phase F) | Yes |
| `/api/v1/content/topic-outline` | Stateless AI Engine | Stateless AI Engine | Yes |
| `/api/v1/content/generate-modular` | Stateless AI Engine | Stateless AI Engine | Yes |
| `/api/v1/content/generate-svg` | Stateless SVG Engine | Stateless SVG Engine | Yes |
| `/api/v1/content/factual-review` | Stateless Perplexity/AI | Stateless Perplexity/AI | Yes |
| `/api/v1/cron/enqueue-schedules` | PostgreSQL / Prisma | MongoDB Atlas (Phase I) | Yes |
| `/api/v1/scheduler/tick` | PostgreSQL / Prisma | MongoDB Atlas (Phase I) | Yes |
| `/api/v1/jobs` | PostgreSQL / Prisma | MongoDB Atlas (Phase I) | Yes |
| `/api/v1/automations` | PostgreSQL / Prisma | MongoDB Atlas (Phase I) | Yes |
| `/api/v1/compliance` | PostgreSQL / Prisma | MongoDB Atlas (Phase J) | Yes |
| `/api/v1/dashboard` | PostgreSQL / Prisma | MongoDB Atlas (Phase K) | Yes |
| `/api/v1/settings` | PostgreSQL / Prisma | MongoDB Atlas (Phase K) | Yes |
| `/api/v1/finance/pakistan-gold-rates` | In-Memory + PostgreSQL | MongoDB Atlas (Phase L) | Yes |
| `/api/v1/health` | PostgreSQL / Prisma | MongoDB Atlas | Yes |

### B. What Must Remain on Vercel:
- Next.js Client App (React UI, Tailwind CSS, Hero Icons, Lucide).
- Static Asset Hosting (`public/*`).
- Public Reader Pages (`/p/[websiteId]`, `/p/[websiteId]/[slug]`) utilizing Vercel's global CDN and edge cache.

---

## 5. Security Architecture & Threat Model

```
[Vercel Frontend] 
     │ (HTTPS / TLS 1.3 - Authenticated via Bearer Token & Session Cookie)
     ▼
[VPS Ingress: Nginx Reverse Proxy (Port 443)]
     │ (Localhost loopback HTTP: port 4000)
     ▼
[Node.js Backend API (PM2 Cluster Mode)]
     │ (Egress from single Static IPv4: e.g. 195.x.x.x)
     ▼ (Port 27017 TLS 1.3)
[MongoDB Atlas: Network Access Allowlist restricted strictly to <VPS_IP>/32]
```

### Security Controls:
1. **Firewall (UFW on VPS):**
   - Open ports: `22` (SSH, key-based only), `80` (HTTP -> HTTPS redirect), `443` (HTTPS API).
   - Port `27017` blocked on inbound.
   - Internal app port `4000` blocked on external interface; accessible only via `127.0.0.1` reverse proxy.
2. **CORS Restrictions:**
   - `Access-Control-Allow-Origin: https://apexseoengine.vercel.app`
   - Disallow `*` wildcard origins on authenticated endpoints.
3. **Database Credentials:**
   - `MONGODB_URI` stored exclusively in the VPS environment (`/etc/environment` or `.env.production` readable only by `apex` system user).
   - Vercel frontend never holds or transmits database connection strings.

---

## 6. Performance & Reliability Testing Methodology

*Note: In accordance with audit rules, performance figures are treated as test hypotheses to be empirically measured, not assumed.*

### Metrics to be Measured During Pre-Cutover Staging:
1. **Network Latency (`curl -w "@curl-format.txt"`):**
   - Measure TCP handshake and Time to First Byte (TTFB) from Vercel edge to VPS API.
   - Target benchmark: `< 150 ms`.
2. **Database Query Latency:**
   - Measure execution time of `db.command({ ping: 1 })` and indexed document reads over warm connection pool.
   - Target benchmark: `< 30 ms`.
3. **Memory & CPU Footprint (`pm2 monit` / `top`):**
   - Measure idle RSS memory.
   - Measure peak memory under 20 concurrent bcrypt hash operations.
   - Target benchmark: `< 350 MB RAM`, `< 40% CPU peak`.

---

## 7. Cost Analysis Breakdown

- **Existing Infrastructure Cost:**
  - Vercel Hobby: **$0.00 / month** (Free tier).
  - MongoDB Atlas M0: **$0.00 / month** (Free tier).
  - Existing VPS: **$0.00 additional** (Already leased by user).
- **Mandatory Additional Costs:** **$0.00 / month**.
- **Optional Future Costs (Scale-Up Only):**
  - Paid domain name for API subdomain (e.g. `api.apexseo.com`): ~$10/year (Optional; free subdomains or duckdns/nip.io can be used).
- **Conclusion:** Solution complies 100% with the **Zero Additional Cost Policy**.

---

## 8. Prerequisites Before Implementation Begins

1. **User Input Required:**
   - User must supply the **Public Static IPv4 Address** of the existing VPS.
   - User must confirm the VPS OS distribution (e.g. Ubuntu 22.04 LTS) and available free RAM.
2. **Atlas Step:**
   - Add `<VPS_STATIC_IP>/32` to MongoDB Atlas Network Access list.
3. **Application Step:**
   - Complete Phase C (Websites & Integrations migration to MongoDB) so that multi-tenant data is natively accessible via MongoDB.

---

## 9. Explicit Compliance Confirmation
*As required by strict instructions, this task was an inspection only:*
- **Zero** code files modified.
- **Zero** packages installed.
- **Zero** database mutations executed.
- **Zero** network access changes made.
- **Zero** Git commits, pushes, or deployments performed.
