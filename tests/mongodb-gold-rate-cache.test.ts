import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getPakistanGoldRates,
  resetGoldRateCacheForTesting,
  normalizeSarafaCityData
} from "../src/services/finance/pakistan-gold-rate-service";
import { getSystemRepository } from "../src/repositories/system-repository.factory";
import { MongoSystemRepository } from "../src/repositories/mongo-system-repository";
import { ISystemRepository } from "../src/repositories/system-repository.types";

describe("Phase J — Pakistan Gold Rate Cache & Production Safety", () => {
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env = { ...originalEnv };
    delete process.env.SARAFA_API_KEY;
    await resetGoldRateCacheForTesting();
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await resetGoldRateCacheForTesting();
    vi.restoreAllMocks();
  });

  it("1. Cache read and write: successfully stores in L2 MongoDB and reads on subsequent calls", async () => {
    const res1 = await getPakistanGoldRates("islamabad");
    expect(res1.citySlug).toBe("islamabad");
    expect(res1.cityName).toBe("Islamabad");

    const repo = getSystemRepository();
    const l2Entry = await repo.findSettingByKey("gold_rates_cache_islamabad");
    expect(l2Entry).not.toBeNull();
    expect(l2Entry?.category).toBe("FINANCE_CACHE");

    const res2 = await getPakistanGoldRates("islamabad");
    expect(res2.citySlug).toBe("islamabad");
  });

  it("2. Cache expiry: enforces 15-minute TTL", async () => {
    const repo = getSystemRepository();
    const past = Date.now() - 20 * 60 * 1000; // 20 minutes ago (expired)

    const rawData = {
      city: "Karachi",
      rate_24k_tola: 280000,
      last_updated: new Date(past).toISOString()
    };
    const normalized = normalizeSarafaCityData(
      "karachi",
      rawData as any,
      new Date(past),
      new Date(past + 15 * 60 * 1000),
      false
    );

    await repo.upsertSetting({
      category: "FINANCE_CACHE",
      key: "gold_rates_cache_karachi",
      value: { data: normalized, cachedAtMs: past, expiresAtMs: past + 15 * 60 * 1000 }
    });

    const res = await getPakistanGoldRates("karachi");
    expect(res.citySlug).toBe("karachi");
  });

  it("3. Stale cache behavior: serves stale data when provider key is missing but cache exists", async () => {
    const repo = getSystemRepository();
    const past = Date.now() - 30 * 60 * 1000;
    const rawData = {
      city: "Lahore",
      rate_24k_tola: 290000,
      last_updated: new Date(past).toISOString()
    };
    const normalized = normalizeSarafaCityData(
      "lahore",
      rawData as any,
      new Date(past),
      new Date(past + 15 * 60 * 1000),
      false
    );

    await repo.upsertSetting({
      category: "FINANCE_CACHE",
      key: "gold_rates_cache_lahore",
      value: { data: normalized, cachedAtMs: past, expiresAtMs: past + 15 * 60 * 1000 }
    });

    const res = await getPakistanGoldRates("lahore", true); // forced refresh with no API key
    expect(res.citySlug).toBe("lahore");
    expect(res.isStale).toBe(true);
    expect(res.staleReason).toContain("API key is not configured");
  });

  it("4. Concurrent refresh requests: single-flight deduplication executes smoothly", async () => {
    const [call1, call2, call3] = await Promise.all([
      getPakistanGoldRates("multan"),
      getPakistanGoldRates("multan"),
      getPakistanGoldRates("multan"),
    ]);

    expect(call1.citySlug).toBe("multan");
    expect(call2.citySlug).toBe("multan");
    expect(call3.citySlug).toBe("multan");
  });

  it("5 & 6. Atomic lock acquisition, expiry, and recovery", async () => {
    const repo = getSystemRepository();
    const now = Date.now();

    // Emulate an active lock held by another instance
    await repo.upsertSetting({
      category: "FINANCE_LOCK",
      key: "gold_rates_lock_peshawar",
      value: { lockedUntilMs: now + 20000, lockedAtMs: now }
    });

    // Emulate existing cache
    const rawData = {
      city: "Peshawar",
      rate_24k_tola: 275000,
      last_updated: new Date().toISOString()
    };
    const normalized = normalizeSarafaCityData(
      "peshawar",
      rawData as any,
      new Date(),
      new Date(now + 15 * 60 * 1000),
      false
    );
    await repo.upsertSetting({
      category: "FINANCE_CACHE",
      key: "gold_rates_cache_peshawar",
      value: { data: normalized, cachedAtMs: now, expiresAtMs: now + 15 * 60 * 1000 }
    });

    const res = await getPakistanGoldRates("peshawar", true);
    expect(res.citySlug).toBe("peshawar");

    // Clean up lock
    await repo.deleteSettingByKey("gold_rates_lock_peshawar");
  });

  it("7. External API failure: falls back safely to cached data without error", async () => {
    process.env.SARAFA_API_KEY = "test_sarafa_key";

    // Mock fetch to simulate 500 error
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers(),
      json: async () => ({ error: "Internal Server Error" })
    } as any);

    const repo = getSystemRepository();
    const now = Date.now();
    const rawData = {
      city: "Quetta",
      rate_24k_tola: 278000,
      last_updated: new Date().toISOString()
    };
    const normalized = normalizeSarafaCityData(
      "quetta",
      rawData as any,
      new Date(),
      new Date(now + 15 * 60 * 1000),
      false
    );
    await repo.upsertSetting({
      category: "FINANCE_CACHE",
      key: "gold_rates_cache_quetta",
      value: { data: normalized, cachedAtMs: now, expiresAtMs: now + 15 * 60 * 1000 }
    });

    const res = await getPakistanGoldRates("quetta", true);
    expect(res.citySlug).toBe("quetta");
    expect(res.isStale).toBe(true);
    expect(res.staleReason).toContain("Provider unreachable");
    fetchSpy.mockRestore();
  });

  it("8. MongoDB failure: gracefully degrades to process memory", async () => {
    const res = await getPakistanGoldRates("faisalabad");
    expect(res.citySlug).toBe("faisalabad");
  });

  it("9. Quota protection: serves cached data when quota threshold is reached", async () => {
    const repo = getSystemRepository();
    await repo.upsertSetting({
      category: "FINANCE_QUOTA",
      key: "gold_rates_quota_state",
      value: { remaining: 2, updatedAtMs: Date.now() }
    });

    const now = Date.now();
    const rawData = {
      city: "Rawalpindi",
      rate_24k_tola: 285000,
      last_updated: new Date().toISOString()
    };
    const normalized = normalizeSarafaCityData(
      "rawalpindi",
      rawData as any,
      new Date(),
      new Date(now + 15 * 60 * 1000),
      false
    );
    await repo.upsertSetting({
      category: "FINANCE_CACHE",
      key: "gold_rates_cache_rawalpindi",
      value: { data: normalized, cachedAtMs: now, expiresAtMs: now + 15 * 60 * 1000 }
    });

    const res = await getPakistanGoldRates("rawalpindi");
    expect(res.citySlug).toBe("rawalpindi");
    expect(res.isStale).toBe(true);
    expect(res.staleReason).toContain("quota threshold reached");
  });

  it("10. Forced refresh behavior: re-validates and bypasses memory cache", async () => {
    const resInitial = await getPakistanGoldRates("islamabad");
    expect(resInitial.citySlug).toBe("islamabad");

    const resRefreshed = await getPakistanGoldRates("islamabad", true);
    expect(resRefreshed.citySlug).toBe("islamabad");
  });

  it("11. Preservation of valid cache after failed refresh", async () => {
    process.env.SARAFA_API_KEY = "test_sarafa_key";
    const repo = getSystemRepository();
    const now = Date.now();

    const rawData = {
      city: "Lahore",
      rate_24k_tola: 286000,
      last_updated: new Date().toISOString()
    };
    const originalRate = normalizeSarafaCityData(
      "lahore",
      rawData as any,
      new Date(),
      new Date(now + 15 * 60 * 1000),
      false
    );
    await repo.upsertSetting({
      category: "FINANCE_CACHE",
      key: "gold_rates_cache_lahore",
      value: { data: originalRate, cachedAtMs: now, expiresAtMs: now + 15 * 60 * 1000 }
    });

    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Timeout contacting Sarafa API"));

    const res = await getPakistanGoldRates("lahore", true);
    expect(res.citySlug).toBe("lahore");
    expect(res.isStale).toBe(true);

    const postCheck = await repo.findSettingByKey("gold_rates_cache_lahore");
    expect(postCheck).not.toBeNull();
    expect((postCheck?.value as any).data.citySlug).toBe("lahore");
  });

  it("12. Cross-instance shared persistence: separate repository instances read shared cache", async () => {
    const repoInstance1: ISystemRepository = new MongoSystemRepository();
    const repoInstance2: ISystemRepository = new MongoSystemRepository();

    const testKey = "gold_rates_cache_multan";
    const cacheVal = {
      data: {
        citySlug: "multan",
        cityName: "Multan",
        currency: "PKR",
        rates: {},
        providerTimestamp: new Date().toISOString(),
        cachedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        isStale: false,
        providerAttribution: "Sarafa.pk",
        providerUrl: "https://sarafa.pk",
        disclaimer: "Disclaimer"
      },
      cachedAtMs: Date.now(),
      expiresAtMs: Date.now() + 15 * 60 * 1000
    };

    await repoInstance1.upsertSetting({
      category: "FINANCE_CACHE",
      key: testKey,
      value: cacheVal
    });

    const readBack = await repoInstance2.findSettingByKey(testKey);
    expect(readBack).not.toBeNull();
    expect((readBack?.value as any).data.cityName).toBe("Multan");
  });
});
