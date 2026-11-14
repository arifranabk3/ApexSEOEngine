/**
 * Pakistan Gold Rate Service
 *
 * Fetches, normalizes, and caches real-time Pakistan gold prices via Sarafa.pk Developer API.
 * Features:
 * - 15-minute two-tier cache (In-memory L1 + PostgreSQL SystemSetting L2 for cross-instance safety on Vercel)
 * - Single-flight concurrent request deduplication to prevent stampedes
 * - Rate-limit quota header tracking (< 5 remaining stops outbound calls and serves stale data)
 * - Strict Zod validation and safe fallback responses
 * - Zero exposed secrets; server-side only
 */

import { z } from "zod";
import { getDb } from "@/lib/db";
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

// L1: In-memory cache entry
interface CacheEntry {
  data: PakistanGoldRatesResult;
  cachedAtMs: number;
  expiresAtMs: number;
}
const memoryCache = new Map<SupportedCitySlug, CacheEntry>();

// Concurrency in-flight deduplication map
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

  const buildPurity = (
    purity: "24K" | "22K" | "21K" | "18K",
    label: string,
    tolaKey: "gold_24k" | "gold_22k" | "gold_21k" | "gold_18k"
  ) => {
    const perTola = typeof tola[tolaKey] === "number" ? tola[tolaKey]! : null;
    const per10G = typeof gram10[tolaKey] === "number" ? gram10[tolaKey]! : null;
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
    currency: "PKR",
    rates: {
      "24K": buildPurity("24K", "24 Karat (Pure Gold)", "gold_24k"),
      "22K": buildPurity("22K", "22 Karat (Jewelry)", "gold_22k"),
      "21K": buildPurity("21K", "21 Karat", "gold_21k"),
      "18K": buildPurity("18K", "18 Karat", "gold_18k")
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
    const db = await getDb();
    const settingKey = `gold_rates_cache_${citySlug}`;
    const entry = await db.systemSetting.findUnique({
      where: { key: settingKey }
    });
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
    const db = await getDb();
    const settingKey = `gold_rates_cache_${citySlug}`;
    await db.systemSetting.upsert({
      where: { key: settingKey },
      create: {
        category: "FINANCE_CACHE",
        key: settingKey,
        value: { data, cachedAtMs, expiresAtMs },
        description: `Persistent L2 gold rates cache for ${citySlug}`
      },
      update: {
        value: { data, cachedAtMs, expiresAtMs },
        updatedAt: new Date()
      }
    });
  } catch {
    // Non-fatal, L1 memory cache continues to function
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

  // 3. Single-flight concurrent deduplication
  const existingInFlight = inFlightRequests.get(citySlug);
  if (existingInFlight) {
    return existingInFlight;
  }

  // 4. Check if quota exhausted or reserved
  if (lastKnownRemainingQuota !== null && lastKnownRemainingQuota <= MIN_SAFE_QUOTA_REMAINING) {
    const fallback = memCached || (await getPersistentCache(citySlug));
    if (fallback) {
      return {
        ...fallback.data,
        isStale: true,
        staleReason: `Provider daily quota threshold reached (${lastKnownRemainingQuota} remaining). Serving cached data to avoid service disruption.`,
        remainingDailyQuota: lastKnownRemainingQuota
      };
    }
  }

  // 5. Initiate outbound fetch
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
          lastKnownRemainingQuota = parsedQuota;
        }
      }

      if (res.status === 429) {
        lastKnownRemainingQuota = 0;
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

      const rawData = parsed.data.data;
      const cityData = Array.isArray(rawData) ? rawData[0] : rawData;
      if (!cityData) {
        throw new Error(`No rate data found in provider response for city '${citySlug}'`);
      }

      const cachedAt = new Date(nowMs);
      const expiresAt = new Date(nowMs + CACHE_TTL_MS);
      const normalized = normalizeSarafaCityData(
        citySlug,
        cityData,
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
      // On network failure or timeout, fallback to existing cache if available
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
    const db = await getDb();
    await db.systemSetting.deleteMany({
      where: { category: "FINANCE_CACHE" }
    });
  } catch {
    // silent
  }
}
