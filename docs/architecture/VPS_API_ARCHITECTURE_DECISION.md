# APEX SEO ENGINE — NEXT.JS API ARCHITECTURE DECISION REPORT

**Date:** 2026-11-14  
**Question:** Should the 22 existing Next.js API route handlers run on a VPS as a Next.js server instance or be refactored into an independent Node.js (Express/Fastify) API service?

---

## 1. Architectural Options Evaluated

### Option A: Next.js Standalone Server on VPS (Hybrid Vercel Frontend + VPS Next.js Backend)
- **Mechanism:**  
  Next.js natively supports `output: "standalone"` in `next.config.js`. This bundles only the required Node.js dependencies and API routes into a lightweight standalone HTTP server executable (`node server.js`).
- **How it Works:**  
  The exact same Next.js project is built on the VPS. The VPS runs `node server.js` on port `4000` managed by PM2 and fronted by Nginx with TLS. Vercel hosts the public client pages, proxying `/api/v1/*` to `https://api.yourdomain.com/api/v1/*` (or frontend calls the API directly with CORS).
- **Migration Effort:** **NEAR ZERO.**  
  100% of the existing 22 Next.js `route.ts` handlers (`NextRequest`, `NextResponse`, Zod schema validations, cookie handling) work out-of-the-box without rewriting a single line of API code.

### Option B: Separate Node.js API Service (Express / Fastify)
- **Mechanism:**  
  Extract all 22 Next.js route handlers into an independent Express.js or Fastify application.
- **Migration Effort:** **VERY HIGH.**  
  1. Next.js App Router relies on Web Standard API constructs (`Request`, `Response`, `NextRequest`, `NextResponse`, `headers()`, `cookies()`).
  2. Express uses Node HTTP stream wrappers (`req`, `res`, `res.json()`, `res.cookie()`).
  3. Every single route handler would require rewriting its request parsing, response formatting, cookie manipulation, and error middleware.
  4. Maintenance doubles: two separate repos or a complex monorepo with duplicate TypeScript models.

---

## 2. Detailed Trade-Off Comparison

| Evaluation Dimension | Option A: Next.js Standalone on VPS | Option B: Separate Express/Fastify API |
|---|:---:|:---:|
| **Code Rewriting Required** | **Zero (0 lines)** — Direct reuse | **Extensive (Rewrite all 22 routes)** |
| **Maintenance Burden** | **Single unified codebase** | Split codebase or monorepo overhead |
| **API Contract Risk** | **Zero risk** of breaking frontend contracts | High risk of subtle JSON/header mismatches |
| **Memory Footprint** | ~180MB RAM under PM2 | ~120MB RAM under PM2 |
| **Build & Deploy Complexity**| `git pull && npm run build && pm2 restart` | Dual deployment pipelines |
| **Durable Jobs & Workers** | Can execute directly inside the same process | Requires custom job queue bindings |
| **Zero-Cost Policy** | 100% Free ($0) | 100% Free ($0) |

---

## 3. Final Recommendation: **OPTION A (Next.js Standalone on VPS)**

### Decision:
**Deploy the backend using Next.js Standalone Mode on the VPS.**

### Strategic Benefits:
1. **Preserves 100% of Existing Code:** All 22 API route handlers, Zod schemas, crypto utilities, and service adapters run untouched.
2. **Eliminates Vercel Serverless Timeouts:** Heavy AI operations (e.g., modular article generation, outline clustering, batch SERP scraping) can run indefinitely without hitting Vercel's 10-second / 30-second execution cutoff.
3. **Dedicated Static IP to MongoDB Atlas:** The VPS Next.js process connects to MongoDB Atlas using its fixed static IPv4 (`<VPS_IP>/32`), satisfying all Atlas security requirements without `0.0.0.0/0`.
4. **Single Source of Truth:** One repository, one git main branch, zero code duplication.
