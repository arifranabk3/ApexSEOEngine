import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getPakistanGoldRates,
  normalizeSarafaCityData,
  resetGoldRateCacheForTesting
} from "@/services/finance/pakistan-gold-rate-service";
import {
  SupportedCitySlug,
  SarafaCityDataSchema
} from "@/services/finance/pakistan-gold-rate-schemas";

const sampleSarafaPayload = {
  city: "Islamabad",
  slug: "islamabad",
  currency: "PKR",
  last_updated: "2026-11-14T06:00:00.000Z",
  rates: {
    tola: {
      gold_24k: 285000,
      pathoor_24k: 282500,
      gold_22k: 261250,
      gold_21k: 249375,
      gold_18k: 213750
    },
    gram_10: {
      gold_24k: 244341,
      gold_22k: 223979,
      gold_21k: 213798,
      gold_18k: 183256
    }
  }
};

describe("Phase 02.2: Pakistan Gold Rate Service & Normalizer", () => {
  beforeEach(async () => {
    await resetGoldRateCacheForTesting();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Data Normalizer & Purity Math", () => {
    it("normalizes all 4 purities with tola, 10g and derived 1g prices", () => {
      const cachedAt = new Date();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      const normalized = normalizeSarafaCityData(
        "islamabad",
        sampleSarafaPayload,
        cachedAt,
        expiresAt,
        false,
        undefined,
        85
      );

      expect(normalized.citySlug).toBe("islamabad");
      expect(normalized.cityName).toBe("Islamabad");
      expect(normalized.currency).toBe("PKR");

      // Check 24K
      const r24k = normalized.rates["24K"];
      expect(r24k.perTolaPkr).toBe(285000);
      expect(r24k.per10GramsPkr).toBe(244341);
      expect(r24k.perGramPkr).toBe(24434.1); // 244341 / 10 rounded
      expect(r24k.isDerivedGramPrice).toBe(true);

      // Check 22K
      const r22k = normalized.rates["22K"];
      expect(r22k.perTolaPkr).toBe(261250);
      expect(r22k.per10GramsPkr).toBe(223979);
      expect(r22k.perGramPkr).toBe(22397.9);

      // Check 21K
      const r21k = normalized.rates["21K"];
      expect(r21k.perTolaPkr).toBe(249375);

      // Check 18K
      const r18k = normalized.rates["18K"];
      expect(r18k.perTolaPkr).toBe(213750);

      // Check Pathoor benchmark
      expect(normalized.pathoor24kPerTola).toBe(282500);

      // Check Quota and attribution
      expect(normalized.remainingDailyQuota).toBe(85);
      expect(normalized.providerAttribution).toContain("Sarafa.pk");
    });

    it("handles missing prices safely as null without throwing", () => {
      const partialData = {
        city: "Karachi",
        slug: "karachi",
        currency: "PKR",
        rates: {
          tola: { gold_24k: 284000 }
        }
      };

      const normalized = normalizeSarafaCityData(
        "karachi",
        partialData,
        new Date(),
        new Date()
      );

      expect(normalized.rates["24K"].perTolaPkr).toBe(284000);
      expect(normalized.rates["24K"].per10GramsPkr).toBeNull();
      expect(normalized.rates["24K"].perGramPkr).toBeNull();
      expect(normalized.rates["22K"].perTolaPkr).toBeNull();
      expect(normalized.pathoor24kPerTola).toBeNull();
    });
  });

  describe("API Integration & Caching Layer", () => {
    it("rejects unsupported cities with clear validation error", async () => {
      await expect(getPakistanGoldRates("tokyo")).rejects.toThrow("Unsupported city 'tokyo'");
      await expect(getPakistanGoldRates("newyork")).rejects.toThrow("Unsupported city 'newyork'");
    });

    it("serves live rates and caches in-memory for 15 minutes", async () => {
      const originalApiKey = process.env.SARAFA_API_KEY;
      process.env.SARAFA_API_KEY = "test-sarafa-key-12345";

      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "success",
            code: 200,
            data: sampleSarafaPayload
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "x-ratelimit-remaining": "92"
            }
          }
        )
      );

      // 1. Initial call: triggers fetch
      const result1 = await getPakistanGoldRates("islamabad");
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result1.rates["24K"].perTolaPkr).toBe(285000);
      expect(result1.isStale).toBe(false);
      expect(result1.remainingDailyQuota).toBe(92);

      // 2. Second immediate call: served from memory cache without new fetch
      const result2 = await getPakistanGoldRates("islamabad");
      expect(mockFetch).toHaveBeenCalledTimes(1); // No new network call!
      expect(result2.rates["24K"].perTolaPkr).toBe(285000);

      process.env.SARAFA_API_KEY = originalApiKey;
    });

    it("handles concurrent requests for the same city with single-flight deduplication", async () => {
      const originalApiKey = process.env.SARAFA_API_KEY;
      process.env.SARAFA_API_KEY = "test-sarafa-key-12345";

      const mockFetch = vi.spyOn(global, "fetch").mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              status: "success",
              code: 200,
              data: sampleSarafaPayload
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json", "x-ratelimit-remaining": "88" }
            }
          )
      );

      // Launch 5 concurrent calls simultaneously
      const results = await Promise.all([
        getPakistanGoldRates("lahore"),
        getPakistanGoldRates("lahore"),
        getPakistanGoldRates("lahore"),
        getPakistanGoldRates("lahore"),
        getPakistanGoldRates("lahore")
      ]);

      expect(mockFetch).toHaveBeenCalledTimes(1); // Only 1 outbound request triggered!
      expect(results.length).toBe(5);
      expect(results[0].rates["24K"].perTolaPkr).toBe(285000);

      process.env.SARAFA_API_KEY = originalApiKey;
    });

    it("serves stale cache when provider returns 429 rate limit exceeded", async () => {
      const originalApiKey = process.env.SARAFA_API_KEY;
      process.env.SARAFA_API_KEY = "test-sarafa-key-12345";

      // Prime the cache first
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "success",
            code: 200,
            data: sampleSarafaPayload
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
      await getPakistanGoldRates("karachi");

      // Force refresh with 429 response
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response("Rate limit exceeded", { status: 429 })
      );

      const staleResult = await getPakistanGoldRates("karachi", true);
      expect(staleResult.isStale).toBe(true);
      expect(staleResult.staleReason).toContain("rate limit");
      expect(staleResult.rates["24K"].perTolaPkr).toBe(285000);

      process.env.SARAFA_API_KEY = originalApiKey;
    });

    it("serves placeholder when SARAFA_API_KEY is unset without crashing", async () => {
      const originalApiKey = process.env.SARAFA_API_KEY;
      delete process.env.SARAFA_API_KEY;

      const result = await getPakistanGoldRates("peshawar", true);
      expect(result.citySlug).toBe("peshawar");
      expect(result.isStale).toBe(true);
      expect(result.staleReason).toContain("Provider API key is not configured");

      process.env.SARAFA_API_KEY = originalApiKey;
    });
  });
});
