# PHASE J — GOLD RATE CACHE & PRODUCTION-SAFETY DISCOVERY

## 1. Context & Architecture

- **Project**: Apex SEO Engine
- **Target Component**: Pakistan Gold Rate Service (`src/services/finance/pakistan-gold-rate-service.ts`)
- **Underlying Repository**: SystemSetting (`src/repositories/mongo-system-repository.ts` via `src/repositories/system-repository.factory.ts`)
- **Collections**: `system_settings`
- **L1 Cache**: Process in-memory `Map<SupportedCitySlug, CacheEntry>`
- **L2 Cache**: Persistent MongoDB `system_settings` document with `key: "gold_rates_cache_${citySlug}"`, `category: "FINANCE_CACHE"`

## 2. Component Analysis

### 2.1 Cache Storage & Data Model
- **Key Schema**: `gold_rates_cache_${citySlug}` (Supported cities: `islamabad`, `rawalpindi`, `karachi`, `lahore`, `peshawar`, `faisalabad`, `multan`, `quetta`)
- **L2 Value Structure**:
  ```ts
  {
    data: PakistanGoldRatesResult,
    cachedAtMs: number,
    expiresAtMs: number
  }
  ```
- **TTL**: 15 minutes (`CACHE_TTL_MS = 15 * 60 * 1000`).

### 2.2 Concurrency & Locking Strategy
- **L1 In-Memory Flight Lock**:
  - Uses `inFlightRequests: Map<SupportedCitySlug, Promise<PakistanGoldRatesResult>>`.
  - When concurrent calls for the same city hit a single Node.js process, subsequent requests await the active promise instead of firing outbound HTTP calls.
  - *Multi-Instance Limitation*: L1 in-flight requests are process-local. Across multiple Vercel serverless instances or cluster workers, if L1 and L2 are expired or missing, multiple instances could simultaneously attempt an external API refresh.
  - *Recommended Enhancement*: Implement an atomic distributed lock in MongoDB via `system_settings` (e.g. `gold_rates_lock_${citySlug}`) with a safe TTL (e.g. 15-30s) so only one serverless instance refreshes from Sarafa.pk at a time, while others wait or serve stale cache.

### 2.3 External Provider & Quota Protection
- **Provider**: Sarafa.pk Developer API (`https://api.sarafa.pk/api/v1/public-rates/gold/cities/${citySlug}`)
- **Rate Limit Tracking**:
  - Reads response header `x-ratelimit-remaining`.
  - Quota Threshold: `MIN_SAFE_QUOTA_REMAINING = 5` (out of typical 100 req/day free tier).
  - When remaining quota is `<= 5` or on HTTP 429: Outbound calls are suspended, and valid L1/L2 cached data is returned with `isStale: true` and an explicit `staleReason`.
  - *Enhancement*: Quota remaining should also be persisted in MongoDB `system_settings` (`gold_rates_quota_state`) rather than stored exclusively in process memory (`lastKnownRemainingQuota`), ensuring quota exhaustion state is immediately known across all instances without requiring each instance to burn an API call to discover it.

### 2.4 Error Handling & Fallbacks
- Network failure, timeout (6s timeout via `AbortSignal.timeout(6000)`), or invalid JSON/schema:
  - Catches error and retrieves previous cache from L1 or L2.
  - If cached data exists, preserves it and returns it marked `isStale: true` with error context.
  - Does NOT overwrite or destroy valid cache.
- MongoDB Atlas Network / Handshake Failures:
  - In `getPersistentCache` and `setPersistentCache`, failures are caught gracefully so L1 process memory still serves existing data.
  - Explicit warning logging without credential exposure.

## 3. Findings from Regression Investigations
- **Workstation Public IP**: `154.192.120.3`
- **Atlas TLS Handshake Alert 80 (`ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR`)**:
  - Occurs during tests connecting from the local workstation directly to Atlas when the dynamic IP is blocked by the Atlas Network Access firewall whitelist.
  - In `system-migration-engine.ts`, when MongoDB fails to connect during live migration, `db.systemSetting.findMany()` (PostgreSQL) retrieves 10 seeded records, but `repo.upsertSetting` fails due to Atlas TLS failure, causing `summary.systemSettings.errors` to increment to 10.
  - This confirms that the test failure was purely an environmental connectivity blocker (Atlas TLS Handshake rejection from non-whitelisted IP) rather than a code defect.
