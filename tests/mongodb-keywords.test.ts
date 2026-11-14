import { describe, it, expect, beforeAll } from "vitest";
import { getKeywordDomainRepository } from "../src/repositories/keyword-repository.factory";
import { migrateKeywordsToMongo } from "../src/services/migration/keyword-migration-engine";
import { ensureSystemSeeded } from "@/lib/seed-service";

describe("Phase E — MongoDB Category, KeywordCluster & Keyword Migration", () => {
  const repo = getKeywordDomainRepository();
  const testWebsiteId = "test-site-" + Date.now();

  beforeAll(async () => {
    await ensureSystemSeeded();
    await repo.initIndexes();
  });

  it("migrates existing PostgreSQL categories, clusters, and keywords idempotently", async () => {
    // Dry-run
    const dryRun = await migrateKeywordsToMongo({ dryRun: true });
    expect(dryRun.dryRun).toBe(true);
    expect(dryRun.errors.length).toBe(0);

    // Live migration
    const live = await migrateKeywordsToMongo({ dryRun: false });
    expect(live.dryRun).toBe(false);
    expect(live.errors.length).toBe(0);

    // Idempotent second live migration
    const rerun = await migrateKeywordsToMongo({ dryRun: false });
    expect(rerun.errors.length).toBe(0);
    expect(rerun.categoriesInserted).toBe(0);
    expect(rerun.clustersInserted).toBe(0);
    expect(rerun.keywordsInserted).toBe(0);
  }, 60000);

  it("performs full Category CRUD and enforces unique slug per website", async () => {
    const slug = "test-category-" + Date.now();

    const created = await repo.createCategory({
      websiteId: testWebsiteId,
      name: "Test Category",
      slug,
      description: "Sample category for testing"
    });

    expect(created.id).toBeDefined();
    expect(created.websiteId).toBe(testWebsiteId);
    expect(created.slug).toBe(slug);

    // Unique slug constraint check
    await expect(
      repo.createCategory({
        websiteId: testWebsiteId,
        name: "Duplicate Category",
        slug
      })
    ).rejects.toThrow();

    // Update
    const updated = await repo.updateCategory(created.id, {
      name: "Updated Category Name",
      description: "Updated description"
    });
    expect(updated?.name).toBe("Updated Category Name");

    // List by website
    const list = await repo.findCategoriesByWebsite(testWebsiteId);
    expect(list.some((c) => c.id === created.id)).toBe(true);

    // Delete
    const deleted = await repo.deleteCategory(created.id);
    expect(deleted).toBe(true);
  });

  it("performs KeywordCluster CRUD and unlinks child keywords upon cluster deletion", async () => {
    const cluster = await repo.createCluster({
      websiteId: testWebsiteId,
      name: "Topic Cluster Alpha",
      pillarKeyword: "ai seo platform",
      intent: "COMMERCIAL",
      status: "ACTIVE"
    });

    expect(cluster.id).toBeDefined();
    expect(cluster.pillarKeyword).toBe("ai seo platform");

    // Create keyword linked to cluster
    const kw = await repo.createKeyword({
      websiteId: testWebsiteId,
      clusterId: cluster.id,
      term: "ai seo platform open source " + Date.now(),
      searchIntent: "COMMERCIAL",
      searchVolume: 1200,
      difficulty: 35
    });

    expect(kw.clusterId).toBe(cluster.id);

    // Delete cluster
    const deleted = await repo.deleteCluster(cluster.id);
    expect(deleted).toBe(true);

    // Verify keyword is unlinked (clusterId becomes null)
    const refreshedKw = await repo.findKeywordById(kw.id);
    expect(refreshedKw?.clusterId).toBeNull();

    // Clean up keyword
    await repo.deleteKeyword(kw.id);
  });

  it("performs Keyword CRUD and enforces compound uniqueness on websiteId + term", async () => {
    const term = "unique seo term " + Date.now();

    const kw = await repo.createKeyword({
      websiteId: testWebsiteId,
      term,
      searchIntent: "INFORMATIONAL",
      searchVolume: 500,
      difficulty: 20
    });

    expect(kw.id).toBeDefined();
    expect(kw.term).toBe(term);

    // Duplicate prevention
    await expect(
      repo.createKeyword({
        websiteId: testWebsiteId,
        term
      })
    ).rejects.toThrow();

    // Upsert behavior on duplicate
    const upserted = await repo.upsertKeyword({
      websiteId: testWebsiteId,
      term,
      searchVolume: 750
    });
    expect(upserted.id).toBe(kw.id);
    expect(upserted.searchVolume).toBe(750);

    // List and count
    const count = await repo.countKeywords({ websiteId: testWebsiteId });
    expect(count).toBeGreaterThanOrEqual(1);

    // Delete
    const deleted = await repo.deleteKeyword(kw.id);
    expect(deleted).toBe(true);
  });
});
