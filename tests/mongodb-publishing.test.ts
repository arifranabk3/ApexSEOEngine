import { describe, it, expect, beforeAll } from "vitest";
import { getPublishingRepository } from "../src/repositories/publishing-repository.factory";
import { migratePublishingToMongo } from "../src/services/migration/publishing-migration-engine";
import { ensureSystemSeeded } from "../src/lib/seed-service";

describe("Phase G — MongoDB InternalLink & PublishingJob Migration", () => {
  const repo = getPublishingRepository();
  const testWebsiteId = "test-site-pub-" + Date.now();
  const testArticleId1 = "test-art-1-" + Date.now();
  const testArticleId2 = "test-art-2-" + Date.now();

  beforeAll(async () => {
    await ensureSystemSeeded();
    await repo.initIndexes();
  }, 60000);

  it("migrates existing PostgreSQL internal links and publishing jobs idempotently", async () => {
    // Dry-run
    const dryRun = await migratePublishingToMongo({ dryRun: true });
    expect(dryRun.dryRun).toBe(true);
    expect(dryRun.errors.length).toBe(0);

    // Live run
    const live = await migratePublishingToMongo({ dryRun: false });
    expect(live.dryRun).toBe(false);
    expect(live.errors.length).toBe(0);

    // Idempotent second live migration
    const rerun = await migratePublishingToMongo({ dryRun: false });
    expect(rerun.errors.length).toBe(0);
    expect(rerun.linksInserted).toBe(0);
    expect(rerun.jobsInserted).toBe(0);
  }, 60000);

  describe("InternalLink CRUD & Relationships", () => {
    it("creates, queries, updates, and deletes internal links", async () => {
      const created = await repo.createInternalLink({
        websiteId: testWebsiteId,
        sourceArticleId: testArticleId1,
        targetArticleId: testArticleId2,
        anchorText: "deep learning architecture guide",
        targetUrl: "https://example.com/p/deep-learning-guide",
        status: "SUGGESTED",
        relevanceScore: 0.95
      });

      expect(created.id).toBeDefined();
      expect(created.anchorText).toBe("deep learning architecture guide");
      expect(created.relevanceScore).toBe(0.95);

      // Query by ID
      const byId = await repo.findInternalLinkById(created.id);
      expect(byId).not.toBeNull();
      expect(byId?.targetUrl).toBe("https://example.com/p/deep-learning-guide");

      // Query by source article
      const bySource = await repo.findInternalLinksBySourceArticle(testArticleId1);
      expect(bySource.length).toBeGreaterThanOrEqual(1);

      // Query by target article
      const byTarget = await repo.findInternalLinksByTargetArticle(testArticleId2);
      expect(byTarget.length).toBeGreaterThanOrEqual(1);

      // Update link status
      const updated = await repo.updateInternalLink(created.id, {
        status: "APPROVED",
        relevanceScore: 0.98
      });
      expect(updated?.status).toBe("APPROVED");
      expect(updated?.relevanceScore).toBe(0.98);

      // List by website
      const byWebsite = await repo.findInternalLinksByWebsite(testWebsiteId, { status: "APPROVED" });
      expect(byWebsite.length).toBeGreaterThanOrEqual(1);

      // Count
      const count = await repo.countInternalLinks({ websiteId: testWebsiteId, status: "APPROVED" });
      expect(count).toBeGreaterThanOrEqual(1);

      // Delete by article cascade simulation
      const deletedCount = await repo.deleteInternalLinksByArticle(testArticleId1);
      expect(deletedCount).toBeGreaterThanOrEqual(1);

      const afterDelete = await repo.findInternalLinkById(created.id);
      expect(afterDelete).toBeNull();
    });

    it("upserts internal links preventing duplicate recommendations", async () => {
      const input = {
        websiteId: testWebsiteId,
        sourceArticleId: testArticleId1,
        targetArticleId: testArticleId2,
        anchorText: "idempotent anchor",
        targetUrl: "https://example.com/idempotent",
        status: "SUGGESTED"
      };

      const link1 = await repo.upsertInternalLink(input);
      expect(link1.id).toBeDefined();

      const link2 = await repo.upsertInternalLink({
        ...input,
        status: "APPROVED"
      });
      expect(link2.id).toBe(link1.id);
      expect(link2.status).toBe("APPROVED");

      await repo.deleteInternalLink(link1.id);
    });
  });

  describe("PublishingJob Lifecycle & Concurrency", () => {
    it("creates, queries, and updates publishing jobs", async () => {
      const created = await repo.createPublishingJob({
        websiteId: testWebsiteId,
        articleId: testArticleId1,
        cmsType: "WORDPRESS",
        status: "QUEUED",
        scheduledFor: new Date()
      });

      expect(created.id).toBeDefined();
      expect(created.status).toBe("QUEUED");
      expect(created.cmsType).toBe("WORDPRESS");

      // Find by ID
      const byId = await repo.findPublishingJobById(created.id);
      expect(byId).not.toBeNull();
      expect(byId?.articleId).toBe(testArticleId1);

      // Find by article
      const byArticle = await repo.findPublishingJobsByArticle(testArticleId1);
      expect(byArticle.length).toBeGreaterThanOrEqual(1);

      // Count
      const countQueued = await repo.countPublishingJobs({ websiteId: testWebsiteId, status: "QUEUED" });
      expect(countQueued).toBeGreaterThanOrEqual(1);

      await repo.deletePublishingJob(created.id);
    });

    it("supports atomic job claiming, completion, and failure transitions", async () => {
      const job = await repo.createPublishingJob({
        websiteId: testWebsiteId,
        articleId: testArticleId2,
        cmsType: "GHOST",
        status: "QUEUED",
        scheduledFor: new Date(Date.now() - 1000), // Due immediately
        maxAttempts: 2
      });

      // Claim job atomically
      const claimed = await repo.claimNextDueJob("test-worker-alpha");
      expect(claimed).not.toBeNull();
      expect(claimed?.status).toBe("PROCESSING");
      expect(claimed?.attempts).toBe(1);

      // Fail with retry
      const failedRetry = await repo.failJob(claimed!.id, {
        errorMessage: "Temporary gateway timeout 504",
        retryInMs: 100 // 100ms
      });
      expect(failedRetry?.status).toBe("QUEUED");
      expect(failedRetry?.errorMessage).toBe("Temporary gateway timeout 504");

      // Wait 150ms for retry schedule
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Claim second time
      const claimed2 = await repo.claimNextDueJob("test-worker-beta");
      expect(claimed2?.id).toBe(job.id);
      expect(claimed2?.attempts).toBe(2);

      // Complete job
      const completed = await repo.completeJob(claimed2!.id, {
        remotePostId: "ghost-post-123",
        publishedUrl: "https://example.com/ghost-post-123",
        responseLog: { code: 200, status: "published" }
      });
      expect(completed?.status).toBe("COMPLETED");
      expect(completed?.remotePostId).toBe("ghost-post-123");
      expect(completed?.completedAt).toBeDefined();

      await repo.deletePublishingJob(job.id);
    });
  });
});
