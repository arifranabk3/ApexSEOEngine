import { describe, it, expect, beforeAll } from "vitest";
import { getContentBriefRepository } from "../src/repositories/content-brief-repository.factory";
import { migrateContentBriefsToMongo } from "../src/services/migration/content-brief-migration-engine";
import { ensureSystemSeeded } from "../src/lib/seed-service";

describe("Phase F1 — MongoDB ContentBrief Migration", () => {
  const repo = getContentBriefRepository();
  const testWebsiteId = "test-site-brief-" + Date.now();

  beforeAll(async () => {
    await ensureSystemSeeded();
    await repo.initIndexes();
  });

  it("migrates existing PostgreSQL content briefs idempotently", async () => {
    // Dry-run
    const dryRun = await migrateContentBriefsToMongo({ dryRun: true });
    expect(dryRun.dryRun).toBe(true);
    expect(dryRun.errors.length).toBe(0);

    // Live migration
    const live = await migrateContentBriefsToMongo({ dryRun: false });
    expect(live.dryRun).toBe(false);
    expect(live.errors.length).toBe(0);

    // Idempotent second live migration
    const rerun = await migrateContentBriefsToMongo({ dryRun: false });
    expect(rerun.errors.length).toBe(0);
    expect(rerun.briefsInserted).toBe(0);
  }, 60000);

  it("performs full ContentBrief CRUD operations", async () => {
    const title = "Comprehensive Technical SEO Architecture Guide " + Date.now();
    const outline = [
      { heading: "Core Web Vitals Blueprint", level: 2 },
      { heading: "Schema Markup Architecture", level: 2 }
    ];
    const secondaryKeywords = ["technical seo checklist", "core web vitals audit"];

    const created = await repo.createBrief({
      websiteId: testWebsiteId,
      title,
      targetWordCount: 2200,
      searchIntent: "INFORMATIONAL",
      outline,
      secondaryKeywords,
      competitorNotes: "Focus on zero-cost infrastructure and performance metrics",
      status: "DRAFT"
    });

    expect(created.id).toBeDefined();
    expect(created.websiteId).toBe(testWebsiteId);
    expect(created.title).toBe(title);
    expect(created.targetWordCount).toBe(2200);
    expect(created.status).toBe("DRAFT");

    // Lookup by ID
    const found = await repo.findById(created.id);
    expect(found?.title).toBe(title);

    // Update status to APPROVED and modify word count
    const updated = await repo.updateBrief(created.id, {
      status: "APPROVED",
      targetWordCount: 2500
    });
    expect(updated?.status).toBe("APPROVED");
    expect(updated?.targetWordCount).toBe(2500);

    // List by website
    const list = await repo.findByWebsite(testWebsiteId);
    expect(list.some((b) => b.id === created.id)).toBe(true);

    // Count briefs
    const count = await repo.countBriefs({ websiteId: testWebsiteId });
    expect(count).toBeGreaterThanOrEqual(1);

    // Delete
    const deleted = await repo.deleteBrief(created.id);
    expect(deleted).toBe(true);

    const recheck = await repo.findById(created.id);
    expect(recheck).toBeNull();
  });
});
