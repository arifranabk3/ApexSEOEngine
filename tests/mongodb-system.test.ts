import { describe, it, expect, beforeAll } from "vitest";
import { getSystemRepository } from "../src/repositories/system-repository.factory";
import { SystemMigrationEngine } from "../src/services/migration/system-migration-engine";
import { resetGoldRateCacheForTesting } from "../src/services/finance/pakistan-gold-rate-service";
import { getPakistanGoldRates } from "../src/services/finance/pakistan-gold-rate-service";

describe("Phase I — Final Three Models (SearchPerformance, SystemSetting, AuditLog) in MongoDB", () => {
  const repo = getSystemRepository();
  const testWebsiteId = "test-site-system-" + Date.now();

  beforeAll(async () => {
    // Ensure indexes on native collections
    if ("ensureIndexes" in repo && typeof (repo as any).ensureIndexes === "function") {
      await (repo as any).ensureIndexes();
    }
  }, 60000);

  describe("SearchPerformance Model Operations", () => {
    it("records and upserts search performance records atomically", async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const created = await repo.recordSearchPerformance({
        websiteId: testWebsiteId,
        pageUrl: "https://apexseoengine.vercel.app/p/seo-guide",
        query: "best seo engine 2026",
        clicks: 42,
        impressions: 1200,
        ctr: 0.035,
        position: 4.2,
        date: today,
      });

      expect(created.id).toBeDefined();
      expect(created.clicks).toBe(42);
      expect(created.impressions).toBe(1200);

      // Re-recording the exact same unique dimension updates in-place
      const updated = await repo.recordSearchPerformance({
        websiteId: testWebsiteId,
        pageUrl: "https://apexseoengine.vercel.app/p/seo-guide",
        query: "best seo engine 2026",
        clicks: 50,
        impressions: 1300,
        ctr: 0.038,
        position: 3.9,
        date: today,
      });

      expect(updated.id).toBe(created.id);
      expect(updated.clicks).toBe(50);
      expect(updated.impressions).toBe(1300);
    });

    it("bulk upserts and aggregates search performance metrics", async () => {
      const date1 = new Date("2026-05-01T00:00:00.000Z");
      const date2 = new Date("2026-05-02T00:00:00.000Z");

      const count = await repo.bulkUpsertSearchPerformance([
        {
          websiteId: testWebsiteId,
          pageUrl: "https://apexseoengine.vercel.app/p/page-a",
          query: "query a",
          clicks: 10,
          impressions: 100,
          ctr: 0.1,
          position: 2.0,
          date: date1,
        },
        {
          websiteId: testWebsiteId,
          pageUrl: "https://apexseoengine.vercel.app/p/page-b",
          query: "query b",
          clicks: 20,
          impressions: 200,
          ctr: 0.1,
          position: 4.0,
          date: date2,
        },
      ]);

      expect(count).toBeGreaterThanOrEqual(2);

      const found = await repo.findSearchPerformance({ websiteId: testWebsiteId });
      expect(found.length).toBeGreaterThanOrEqual(2);

      const metrics = await repo.aggregateSearchMetrics({ websiteId: testWebsiteId });
      expect(metrics.totalClicks).toBeGreaterThanOrEqual(30);
      expect(metrics.totalImpressions).toBeGreaterThanOrEqual(300);
      expect(metrics.recordCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe("SystemSetting Model Operations & Gold Rate Cache", () => {
    it("upserts, finds, and deletes system settings", async () => {
      const key = "test.setting." + Date.now();
      const setting = await repo.upsertSetting({
        key,
        value: { foo: "bar", active: true },
        category: "TEST_SUITE",
        description: "Integration test setting",
      });

      expect(setting.id).toBeDefined();
      expect(setting.key).toBe(key);
      expect((setting.value as any).foo).toBe("bar");

      const retrieved = await repo.findSettingByKey(key);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.category).toBe("TEST_SUITE");

      const byCat = await repo.findSettingsByCategory("TEST_SUITE");
      expect(byCat.some((s) => s.key === key)).toBe(true);

      const deleted = await repo.deleteSettingByKey(key);
      expect(deleted).toBe(true);

      const checkGone = await repo.findSettingByKey(key);
      expect(checkGone).toBeNull();
    });

    it("safely writes and clears persistent L2 Gold Rate cache under concurrent operations", async () => {
      await resetGoldRateCacheForTesting();

      // Trigger concurrent fetches for pakistan gold rates (mocked/static fallback)
      const results = await Promise.all([
        getPakistanGoldRates("islamabad"),
        getPakistanGoldRates("islamabad"),
        getPakistanGoldRates("karachi"),
      ]);

      expect(results[0].citySlug).toBe("islamabad");
      expect(results[1].citySlug).toBe("islamabad");
      expect(results[2].citySlug).toBe("karachi");

      // Verify persistent cache in MongoDB
      const islamabadCache = await repo.findSettingByKey("gold_rates_cache_islamabad");
      expect(islamabadCache).not.toBeNull();
      expect(islamabadCache?.category).toBe("FINANCE_CACHE");

      // Verify resetGoldRateCacheForTesting cleans up MongoDB
      await resetGoldRateCacheForTesting();
      const afterReset = await repo.findSettingByKey("gold_rates_cache_islamabad");
      expect(afterReset).toBeNull();
    });
  });

  describe("AuditLog Model Operations", () => {
    it("creates, queries, and filters audit log entries", async () => {
      const action = "TEST_SYSTEM_AUDIT_" + Date.now();
      const ip = "192.168.1.100";

      const created = await repo.createAuditLog({
        userId: "user-system-test-1",
        action,
        module: "test-module",
        entityType: "Article",
        entityId: "art-test-1",
        ipAddress: ip,
        userAgent: "vitest/1.0",
        metadata: { claimId: "claim-123", reviewedBy: "qa-lead" },
      });

      expect(created.id).toBeDefined();
      expect(created.action).toBe(action);
      expect(created.module).toBe("test-module");

      const list = await repo.findAuditLogs({ action, ipAddress: ip });
      expect(list.length).toBe(1);
      expect(list[0].id).toBe(created.id);
      expect(list[0].metadata.claimId).toBe("claim-123");

      const count = await repo.countAuditLogs({ action, ipAddress: ip });
      expect(count).toBe(1);
    });
  });

  describe("System Migration Engine", () => {
    it("runs dry-run and live migration without errors", async () => {
      const engine = new SystemMigrationEngine();

      const dryRun = await engine.migrateAll({ dryRun: true });
      expect(dryRun.dryRun).toBe(true);
      expect(dryRun.searchPerformance.errors).toBe(0);
      expect(dryRun.systemSettings.errors).toBe(0);
      expect(dryRun.auditLogs.errors).toBe(0);

      const live = await engine.migrateAll({ dryRun: false });
      expect(live.dryRun).toBe(false);
      expect(live.searchPerformance.errors).toBe(0);
      expect(live.systemSettings.errors).toBe(0);
      expect(live.auditLogs.errors).toBe(0);
    });
  });
});
