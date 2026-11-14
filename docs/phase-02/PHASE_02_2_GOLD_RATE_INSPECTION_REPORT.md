# APEX SEO ENGINE — PHASE 02.2 INSPECTION REPORT
## Pakistan Gold Rate Dashboard Integration

- **Timestamp**: 2026-11-14T11:42:00+05:00
- **Phase**: 02.2 (Financial Market Dashboard Integration — Pakistan Gold Rate Widget)
- **Status**: INSPECTION COMPLETED — READY FOR APPROVAL
- **Provider Examined**: Sarafa.pk Developer API (`https://api.sarafa.pk`)
- **Zero Paid API Policy**: 100% adhered to (Free Tier verified, no subscription purchase needed)

---

## 1. Provider Documentation Inspection (Sarafa.pk)

In accordance with Step 1 instructions, we inspected the official Sarafa.pk documentation and developer access details:
- **Pricing & Developer Portal**: `https://www.sarafa.pk/en/pricing`, `https://www.sarafa.pk/en/developers/api-access`
- **Base API URL**: `https://api.sarafa.pk`

### 1.1 Free Plan Availability & Quota Limits
- **Daily Quota**: **100 requests per day** on the Free Tier (forever free, no credit card required).
- **Rate-Limit Tracking**: Response headers return remaining daily request count and reset window (`X-RateLimit-Limit`, `X-RateLimit-Remaining`).
- **Features Included on Free Tier**:
  - Single-city Gold rate endpoints.
  - Pathoor (local raw 24K) rates (opt-in).
  - 1 API Key per account (`X-API-Key`).
  - Community support.
  - *(Excluded from Free Tier: Fuel APIs, bulk multi-city endpoints, and high-frequency rate streaming).*

### 1.2 Authentication & Security Requirements
- **Authentication Header**: `X-API-Key: <SARAFA_API_KEY>`
- **Client Platform Header**: `X-Client-Platform: server`
- **Domain Whitelisting**: For browser access, Sarafa requires dashboard domain origins, but for **server-side proxy routes** (which our architecture requires for secret protection), requests originate from Next.js server runtime without exposing API keys to the browser.
- **Environment Variable**: `SARAFA_API_KEY` (configured on server in `.env`, never prefixed with `NEXT_PUBLIC_`).

### 1.3 Supported Gold Rate Endpoints
- **Endpoint**: `GET /api/v1/public-rates/gold/cities/{location_slug}`
- **City Slugs Verified**:
  - `islamabad` (Preferred default)
  - `rawalpindi`
  - `karachi`
  - `lahore`
  - `peshawar`
  - `faisalabad`
  - `multan`
  - `quetta`
- **Purities Supported**:
  - `24K`, `22K`, `21K`, `18K` (and extended 16K, 14K, 12K, plus local Pathoor 24K).
- **Weight Units Provided**:
  - `per tola` (1 tola = 11.6638 grams)
  - `per 10 grams`
  - `per 1 gram` (calculated using official 10g / 10 exact ratio or provider gram field).
- **Currency**: `PKR` (Pakistani Rupee).

### 1.4 Cache Policy & Quota Safety Analysis
- **Daily Quota**: 100 requests / 24 hours.
- If un-cached, 100 dashboard visits would consume the entire daily allowance in minutes.
- **Mandatory Server Cache**:
  - Minimum cache duration: **15 minutes** (900 seconds) in-memory TTL.
  - Maximum possible external requests per 24 hours per city: `24 hours * 4 requests/hour = 96 requests/day`.
  - For active cities (e.g. Islamabad default), a 15-minute server cache guarantees total calls remain strictly under the 100 requests/day limit.
  - When rate-limit headers report remaining quota < 5, service automatically serves cached stale data with an explicit `isStale: true` warning banner.

---

## 2. Architecture & Codebase Inspection

### 2.1 Dashboard Layout & Component Integration
- **`DashboardShell.tsx`**:
  - Navigation: `activeNav === "overview"` renders the top executive control plane, 6 executive KPI cards, and performance overview grids.
  - Layout: Right under the 6 KPI cards (lines 960–1032) or inside an analytics grid is the ideal modular slot for `<PakistanGoldRateWidget />`.
  - Dark Theme styling: Utilizes Tailwind `apex-card`, slate borders (`border-slate-800`), font styling (`font-extrabold`, `text-slate-100`, `text-slate-400`), and Lucide icons (`Coins`, `TrendingUp`, `RefreshCw`, `Clock`, `MapPin`, `AlertCircle`).

### 2.2 Server-Side Service Design (`src/services/finance/pakistan-gold-rate-service.ts`)
- Pure server-side fetcher utilizing Node.js `fetch` with `AbortSignal.timeout(6000)`.
- Server-side in-memory cache map keyed by `citySlug`, storing:
  - `data`: Validated gold rates.
  - `cachedAt`: Timestamp.
  - `expiresAt`: `cachedAt + 15 minutes`.
- Graceful Fallback Mode: If `SARAFA_API_KEY` is not yet configured by the user, the service returns a structured, non-breaking `"API_KEY_REQUIRED"` or offline benchmark demonstration mode clearly marked as unauthenticated rather than throwing a 500 fatal crash.

### 2.3 API Route Architecture (`src/app/api/v1/finance/pakistan-gold-rates/route.ts`)
- Authenticated via existing `requireApiAuth(req)`.
- Input validation using Zod: `citySlug` constrained to supported Sarafa cities enum (`islamabad`, `rawalpindi`, `karachi`, `lahore`, `peshawar`, `faisalabad`, `multan`, `quetta`).
- Rate-limited via existing `checkRateLimit(user.id, 30, 60_000)` to prevent internal abuse.
- Returns normalized payload conforming to `PakistanGoldRateResponseSchema`.

---

## 3. Supported Data Matrix & Conversions

| Purity | Per Tola (PKR) | Per 10 Grams (PKR) | Per Gram (PKR) | Source & Notes |
| :--- | :---: | :---: | :---: | :--- |
| **24K** | Direct from API | Direct from API | 10g Price / 10 | Benchmark Pure Gold |
| **22K** | Direct from API | Direct from API | 10g Price / 10 | Standard Jewelry Gold |
| **21K** | Direct from API | Direct from API | 10g Price / 10 | Traditional Market Gold |
| **18K** | Direct from API | Direct from API | 10g Price / 10 | Standard 75% Gold |

*Conversion Assumption*: 1 tola = 11.6638 grams; 10 grams = 10 × 1 gram. The provider delivers both `tola` and `10 grams` directly. Per gram is deterministically derived as `price_10g / 10`.

---

## 4. Proposed Implementation Plan

1. **Step 2 — Gold Rate Service (`src/services/finance/pakistan-gold-rate-service.ts`)**:
   - Zod schemas for Sarafa.pk raw responses and normalized domain outputs.
   - 15-minute server in-memory TTL caching.
   - SSRF and credential safety checks.
2. **Step 3 & 4 — City & Purity Normalizer**:
   - Supported cities: `islamabad` (default), `rawalpindi`, `karachi`, `lahore`, `peshawar`, `faisalabad`, `multan`, `quetta`.
3. **Step 5 — Dashboard Widget (`src/components/dashboard/PakistanGoldRateWidget.tsx`)**:
   - Dark theme styling with responsive grid, city selector, 24K highlight, 22K/21K/18K breakdown, unit tabs (Tola / 10g / 1g), last updated timestamp, stale warning badge, and Sarafa.pk attribution.
4. **Step 6 — Authenticated API Route (`src/app/api/v1/finance/pakistan-gold-rates/route.ts`)**:
   - Query parameter `?city=islamabad`, RBAC check, secret redaction, audit logging.
5. **Step 7 — Unit & API Testing**:
   - `tests/pakistan-gold-rates.test.ts`: Cache expiry, rate normalization, missing credentials handling, city validation, and rate limit defense.
6. **Step 8 — Verification & Documentation**:
   - Full regression suite run, build verification, and implementation log.

---

**STOP & APPROVAL REQUEST**:
Step 1 inspection is complete. We halt here and request your approval to proceed to **Step 2 through Step 8**.
