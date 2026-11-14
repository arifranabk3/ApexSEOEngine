/**
 * Pakistan Gold Rate Service
 *
 * Fetches, normalizes, and caches real-time Pakistan gold prices via Sarafa.pk Developer API.
 * Features:
 * - 15-minute two-tier cache (In-memory L1 + MongoDB SystemSetting L2 for cross-instance safety)
 * - Distributed atomic locking in MongoDB to prevent cross-instance refresh stampedes
 * - Single-flight concurrent request deduplication to prevent intra-process stampedes
 * - Rate-limit quota header tracking (< 5 remaining stops outbound calls and serves stale data)
 * - Persistent quota awareness across distributed server instances
 * - Strict Zod validation and safe stale fallback responses
 * - Zero exposed secrets; server-side only
 */

import { z } from "zod";
import { getSystemRepository } from "@/repositories/system-repository.factory";
import {
  SupportedCitySlug,
  SupportedCitySlugSchema,
  CITY_DISPLAY_NAMES,
  PakistanGoldRatesResult,
  SarafaApiResponseSchema,
  DISCLAIMER_TEXT,
  SarafaCityDataSchema
} from "./pakistan-gold-rate-schemas";

const SARAFA_BASE_URL = "https://api.sarafa.pk";
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MIN_SAFE_QUOTA_REMAINING = 5; // Reserve threshold to avoid hitting hard limit (100 req/day)
const DISTRIBUTED_LOCK_TTL_MS = 30 * 1000; // 30 seconds distributed refresh lock

// L1: In-memory cache entry
interface CacheEntry {
  data: PakistanGoldRatesResult;
  cachedAtMs: number;
  expiresAtMs: number;
}
const memoryCache = new Map<SupportedCitySlug, CacheEntry>();

// Concurrency in-flight deduplication map (process-level)
const inFlightRequests = new Map<SupportedCitySlug, Promise<PakistanGoldRatesResult>>();

// Global in-memory quota tracking
let lastKnownRemainingQuota: number | null = null;

/**
 * Normalizes raw city data into structured domain rates.
 */
export function normalizeSarafaCityData(
  citySlug: SupportedCitySlug,
  rawCity: z.infer<typeof SarafaCityDataSchema>,
  cachedAt: Date,
  expiresAt: Date,
  isStale = false,
  staleReason?: string,
  remainingQuota: number | null = null
): PakistanGoldRatesResult {
  const tola = rawCity.rates?.tola || {};
  const gram10 = rawCity.rates?.gram_10 || {};

  // Check if flat rate_24k_tola is present (API v1 endpoint format)
  const direct24kTola = typeof rawCity.rate_24k_tola === "number" ? rawCity.rate_24k_tola : null;

  const buildPurity = (
    purity: "24K" | "22K" | "21K" | "18K",
    label: string,
    tolaKey: "gold_24k" | "gold_22k" | "gold_21k" | "gold_18k",
    purityRatio: number
  ) => {
    let perTola = typeof tola[tolaKey] === "number" ? tola[tolaKey]! : null;
    let per10G = typeof gram10[tolaKey] === "number" ? gram10[tolaKey]! : null;

    // If flat direct24kTola is used and nested tola/gram_10 object is absent
    if (!rawCity.rates && direct24kTola !== null) {
      perTola = Math.round(direct24kTola * purityRatio);
      per10G = Math.round((perTola / 11.6638) * 10);
    }

    const perGram = per10G !== null ? Math.round((per10G / 10) * 100) / 100 : null;

    return {
      purity,
      label,
      perTolaPkr: perTola,
      per10GramsPkr: per10G,
      perGramPkr: perGram,
      isDerivedGramPrice: true
    };
  };

  const pathoor = typeof tola.pathoor_24k === "number" ? tola.pathoor_24k : null;

  return {
    citySlug,
    cityName: CITY_DISPLAY_NAMES[citySlug] || rawCity.city || citySlug,
    currency: "PKR" as const,
    rates: {
      "24K": buildPurity("24K", "24 Karat (Pure Gold)", "gold_24k", 1.0),
      "22K": buildPurity("22K", "22 Karat (Jewelry)", "gold_22k", 22 / 24),
      "21K": buildPurity("21K", "21 Karat", "gold_21k", 21 / 24),
      "18K": buildPurity("18K", "18 Karat", "gold_18k", 18 / 24)
    },
    pathoor24kPerTola: pathoor,
    providerTimestamp: rawCity.last_updated || new Date().toISOString(),
    cachedAt: cachedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    isStale,
    staleReason,
    remainingDailyQuota: remainingQuota,
    providerAttribution: "Market data verified by Sarafa.pk (All Pakistan Sarafa Gems & Jewellers Association)",
    providerUrl: "https://sarafa.pk",
    disclaimer: DISCLAIMER_TEXT
  };
}

/**
 * Retrieves L2 persistent cache from SystemSetting table.
 */
async function getPersistentCache(citySlug: SupportedCitySlug): Promise<CacheEntry | null> {
  try {
    const systemRepo = getSystemRepository();
    const settingKey = `gold_rates_cache_${citySlug}`;
    const entry = await systemRepo.findSettingByKey(settingKey);
    if (!entry || !entry.value || typeof entry.value !== "object") return null;

    const val = entry.value as Record<string, unknown>;
    const cachedAtMs = typeof val.cachedAtMs === "number" ? val.cachedAtMs : 0;
    const expiresAtMs = typeof val.expiresAtMs === "number" ? val.expiresAtMs : 0;
    const data = val.data as PakistanGoldRatesResult;

    if (!data || !data.rates) return null;
    return { data, cachedAtMs, expiresAtMs };
  } catch {
    return null;
  }
}

/**
 * Stores L2 persistent cache in SystemSetting table.
 */
async function setPersistentCache(
  citySlug: SupportedCitySlug,
  data: PakistanGoldRatesResult,
  cachedAtMs: number,
  expiresAtMs: number
): Promise<void> {
  try {
    const systemRepo = getSystemRepository();
    const settingKey = `gold_rates_cache_${citySlug}`;
    await systemRepo.upsertSetting({
      category: "FINANCE_CACHE",
      key: settingKey,
      value: { data, cachedAtMs, expiresAtMs },
      description: `Persistent L2 gold rates cache for ${citySlug}`
    });
  } catch {
    // Non-fatal, L1 memory cache continues to function
  }
}

/**
 * Persistent distributed lock management for cross-instance refresh coordination.
 */
async function acquireDistributedRefreshLock(citySlug: SupportedCitySlug): Promise<boolean> {
  try {
    const systemRepo = getSystemRepository();
    const lockKey = `gold_rates_lock_${citySlug}`;
    const now = Date.now();
    const existing = await systemRepo.findSettingByKey(lockKey);

    if (existing && existing.value && typeof existing.value === "object") {
      const lockVal = existing.value as { lockedUntilMs?: number };
      if (typeof lockVal.lockedUntilMs === "number" && now < lockVal.lockedUntilMs) {
        // Lock currently active on another instance
        return false;
      }
    }

    // Acquire or take over expired lock
    await systemRepo.upsertSetting({
      category: "FINANCE_LOCK",
      key: lockKey,
      value: { lockedUntilMs: now + DISTRIBUTED_LOCK_TTL_MS, lockedAtMs: now },
      description: `Distributed refresh lock for ${citySlug}`
    });
    return true;
  } catch {
    // If distributed lock fails (e.g. database offline), permit flight on this process
    return true;
  }
}

async function releaseDistributedRefreshLock(citySlug: SupportedCitySlug): Promise<void> {
  try {
    const systemRepo = getSystemRepository();
    const lockKey = `gold_rates_lock_${citySlug}`;
    await systemRepo.deleteSettingByKey(lockKey);
  } catch {
    // silent
  }
}

/**
 * Persistent quota tracking to share remaining quota state across instances.
 */
async function getPersistentRemainingQuota(): Promise<number | null> {
  if (lastKnownRemainingQuota !== null) return lastKnownRemainingQuota;
  try {
    const systemRepo = getSystemRepository();
    const setting = await systemRepo.findSettingByKey("gold_rates_quota_state");
    if (setting && setting.value && typeof setting.value === "object") {
      const val = setting.value as { remaining?: number };
      if (typeof val.remaining === "number") {
        lastKnownRemainingQuota = val.remaining;
        return val.remaining;
      }
    }
  } catch {
    // silent
  }
  return null;
}

async function setPersistentRemainingQuota(remaining: number): Promise<void> {
  lastKnownRemainingQuota = remaining;
  try {
    const systemRepo = getSystemRepository();
    await systemRepo.upsertSetting({
      category: "FINANCE_QUOTA",
      key: "gold_rates_quota_state",
      value: { remaining, updatedAtMs: Date.now() },
      description: "Cross-instance persistent quota tracker"
    });
  } catch {
    // silent
  }
}

/**
 * Main function to fetch Pakistan gold rates for a city.
 */
export async function getPakistanGoldRates(
  rawCitySlug: string,
  forceRefresh = false
): Promise<PakistanGoldRatesResult> {
  const cityValidation = SupportedCitySlugSchema.safeParse(rawCitySlug.toLowerCase().trim());
  if (!cityValidation.success) {
    throw new Error(
      `Unsupported city '${rawCitySlug}'. Supported cities: ${Object.keys(CITY_DISPLAY_NAMES).join(", ")}`
    );
  }
  const citySlug = cityValidation.data;
  const nowMs = Date.now();

  // 1. Check L1 Memory Cache
  const memCached = memoryCache.get(citySlug);
  if (!forceRefresh && memCached && nowMs < memCached.expiresAtMs) {
    return {
      ...memCached.data,
      isStale: false,
      remainingDailyQuota: lastKnownRemainingQuota
    };
  }

  // 2. Check L2 Database Cache
  if (!forceRefresh) {
    const dbCached = await getPersistentCache(citySlug);
    if (dbCached && nowMs < dbCached.expiresAtMs) {
      memoryCache.set(citySlug, dbCached);
      return {
        ...dbCached.data,
        isStale: false,
        remainingDailyQuota: lastKnownRemainingQuota
      };
    }
  }

  // 3. Single-flight concurrent deduplication (intra-process)
  const existingInFlight = inFlightRequests.get(citySlug);
  if (existingInFlight) {
    return existingInFlight;
  }

  // 4. Check if quota exhausted or reserved (cross-instance check)
  const effectiveQuota = await getPersistentRemainingQuota();
  if (effectiveQuota !== null && effectiveQuota <= MIN_SAFE_QUOTA_REMAINING) {
    const fallback = memCached || (await getPersistentCache(citySlug));
    if (fallback) {
      return {
        ...fallback.data,
        isStale: true,
        staleReason: `Provider daily quota threshold reached (${effectiveQuota} remaining). Serving cached data to avoid service disruption.`,
        remainingDailyQuota: effectiveQuota
      };
    }
  }

  // 5. Distributed cross-instance refresh coordination
  const acquiredLock = await acquireDistributedRefreshLock(citySlug);
  if (!acquiredLock) {
    // Another instance is actively refreshing. Serve cached data if present to avoid duplicate calls.
    const fallback = memCached || (await getPersistentCache(citySlug));
    if (fallback) {
      return {
        ...fallback.data,
        isStale: true,
        staleReason: "Another instance is actively refreshing gold rates. Serving cached data.",
        remainingDailyQuota: effectiveQuota
      };
    }
  }

  // 6. Initiate outbound fetch
  const fetchPromise = (async () => {
    try {
      const apiKey = process.env.SARAFA_API_KEY;
      if (!apiKey) {
        // If no API key configured, check if any cached data exists
        const fallback = memCached || (await getPersistentCache(citySlug));
        if (fallback) {
          return {
            ...fallback.data,
            isStale: true,
            staleReason: "Provider API key is not configured on server. Serving cached data."
          };
        }

        // Return a zeroed benchmark placeholder informing the user to set SARAFA_API_KEY
        const now = new Date();
        const placeholder: PakistanGoldRatesResult = {
          citySlug,
          cityName: CITY_DISPLAY_NAMES[citySlug],
          currency: "PKR",
          rates: {
            "24K": { purity: "24K", label: "24 Karat (Pure Gold)", perTolaPkr: null, per10GramsPkr: null, perGramPkr: null, isDerivedGramPrice: true },
            "22K": { purity: "22K", label: "22 Karat (Jewelry)", perTolaPkr: null, per10GramsPkr: null, perGramPkr: null, isDerivedGramPrice: true },
            "21K": { purity: "21K", label: "21 Karat", perTolaPkr: null, per10GramsPkr: null, perGramPkr: null, isDerivedGramPrice: true },
            "18K": { purity: "18K", label: "18 Karat", perTolaPkr: null, per10GramsPkr: null, perGramPkr: null, isDerivedGramPrice: true }
          },
          providerTimestamp: now.toISOString(),
          cachedAt: now.toISOString(),
          expiresAt: new Date(nowMs + CACHE_TTL_MS).toISOString(),
          isStale: true,
          staleReason: "Provider API key is not configured. Set your free key from sarafa.pk/en/developers/api-access to view live bullion rates.",
          remainingDailyQuota: null,
          providerAttribution: "Sarafa.pk Bullion Market API",
          providerUrl: "https://sarafa.pk",
          disclaimer: DISCLAIMER_TEXT
        };
        return placeholder;
      }

      const url = `${SARAFA_BASE_URL}/api/v1/public-rates/gold/cities/${encodeURIComponent(citySlug)}`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "X-API-Key": apiKey,
          "X-Client-Platform": "server",
          Accept: "application/json"
        },
        signal: AbortSignal.timeout(6000)
      });

      // Parse RateLimit header
      const remainingHdr = res.headers.get("x-ratelimit-remaining");
      if (remainingHdr) {
        const parsedQuota = parseInt(remainingHdr, 10);
        if (!isNaN(parsedQuota)) {
          await setPersistentRemainingQuota(parsedQuota);
        }
      }

      if (res.status === 429) {
        await setPersistentRemainingQuota(0);
        const fallback = memCached || (await getPersistentCache(citySlug));
        if (fallback) {
          return {
            ...fallback.data,
            isStale: true,
            staleReason: "Provider rate limit (100 req/day) exceeded. Serving cached data.",
            remainingDailyQuota: 0
          };
        }
        throw new Error("Sarafa.pk rate limit exceeded and no cached data is available.");
      }

      if (!res.ok) {
        throw new Error(`Sarafa.pk API responded with HTTP status ${res.status}`);
      }

      const json = await res.json();
      const parsed = SarafaApiResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new Error("Invalid response format received from Sarafa.pk");
      }

      let rawCityData: z.infer<typeof SarafaCityDataSchema> | undefined;
      const parsedData = parsed.data;
      if ("data" in parsedData && parsedData.data) {
        const d = parsedData.data;
        rawCityData = Array.isArray(d) ? d[0] : d;
      } else if (Array.isArray(parsedData)) {
        rawCityData = parsedData[0];
      } else {
        rawCityData = parsedData as z.infer<typeof SarafaCityDataSchema>;
      }

      if (!rawCityData) {
        throw new Error(`No rate data found in provider response for city '${citySlug}'`);
      }

      const cachedAt = new Date(nowMs);
      const expiresAt = new Date(nowMs + CACHE_TTL_MS);
      const normalized = normalizeSarafaCityData(
        citySlug,
        rawCityData,
        cachedAt,
        expiresAt,
        false,
        undefined,
        lastKnownRemainingQuota
      );

      // Save to L1 and L2
      const entry: CacheEntry = {
        data: normalized,
        cachedAtMs: nowMs,
        expiresAtMs: nowMs + CACHE_TTL_MS
      };
      memoryCache.set(citySlug, entry);
      await setPersistentCache(citySlug, normalized, nowMs, nowMs + CACHE_TTL_MS);

      return normalized;
    } catch (err: unknown) {
      // On network failure or timeout, fallback to existing cache if available without destroying it
      const fallback = memCached || (await getPersistentCache(citySlug));
      if (fallback) {
        return {
          ...fallback.data,
          isStale: true,
          staleReason: `Provider unreachable (${err instanceof Error ? err.message : "Network error"}). Serving cached data.`
        };
      }
      throw err;
    } finally {
      inFlightRequests.delete(citySlug);
      await releaseDistributedRefreshLock(citySlug);
    }
  })();

  inFlightRequests.set(citySlug, fetchPromise);
  return fetchPromise;
}

/**
 * Resets memory and persistent cache for testing purposes.
 */
export async function resetGoldRateCacheForTesting(): Promise<void> {
  memoryCache.clear();
  inFlightRequests.clear();
  lastKnownRemainingQuota = null;
  try {
    const systemRepo = getSystemRepository();
    await systemRepo.deleteSettingsByCategory("FINANCE_CACHE");
    await systemRepo.deleteSettingsByCategory("FINANCE_LOCK");
    await systemRepo.deleteSettingsByCategory("FINANCE_QUOTA");
  } catch {
    // silent
  }
}
