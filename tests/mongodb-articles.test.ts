import { describe, it, expect, beforeAll } from "vitest";
import { getArticleRepository } from "../src/repositories/article-repository.factory";
import { migrateArticlesToMongo } from "../src/services/migration/article-migration-engine";
import { ensureSystemSeeded } from "../src/lib/seed-service";

describe("Phase F2 — MongoDB Article Content Engine Migration", () => {
  const repo = getArticleRepository();
  const testWebsiteId = "test-site-art-" + Date.now();

  beforeAll(async () => {
    await ensureSystemSeeded();
    await repo.initIndexes();
  }, 60000);

  it("migrates existing PostgreSQL articles, versions, and images idempotently", async () => {
    // Dry-run
    const dryRun = await migrateArticlesToMongo({ dryRun: true });
    expect(dryRun.dryRun).toBe(true);
    expect(dryRun.errors.length).toBe(0);

    // Live migration
    const live = await migrateArticlesToMongo({ dryRun: false });
    expect(live.dryRun).toBe(false);
    expect(live.errors.length).toBe(0);

    // Idempotent second live migration
    const rerun = await migrateArticlesToMongo({ dryRun: false });
    expect(rerun.errors.length).toBe(0);
    expect(rerun.articlesInserted).toBe(0);
    expect(rerun.versionsInserted).toBe(0);
    expect(rerun.imagesInserted).toBe(0);
  }, 60000);

  it("performs full Article CRUD operations and slug retrieval", async () => {
    const slug = "test-article-" + Date.now();
    const created = await repo.createArticle({
      websiteId: testWebsiteId,
      title: "Test Article Title",
      slug,
      excerpt: "Short excerpt for testing",
      content: "# Heading 1\n\nArticle body content for testing.",
      status: "DRAFT",
      focusKeyword: "testing keyword",
      metaTitle: "Test Article SEO Title",
      metaDescription: "Test Article SEO Meta Description",
      seoScore: 85,
      wordCount: 150,
      initialVersion: {
        title: "Test Article Title",
        content: "# Heading 1\n\nArticle body content for testing.",
        metaTitle: "Test Article SEO Title",
        metaDesc: "Test Article SEO Meta Description",
        changeSummary: "Initial version"
      }
    });

    expect(created.id).toBeDefined();
    expect(created.slug).toBe(slug);
    expect(created.status).toBe("DRAFT");
    expect(created.wordCount).toBe(150);

    // Query by ID
    const byId = await repo.findArticleById(created.id);
    expect(byId).not.toBeNull();
    expect(byId?.title).toBe("Test Article Title");

    // Query by Website + Slug
    const bySlug = await repo.findArticleBySlug(testWebsiteId, slug);
    expect(bySlug).not.toBeNull();
    expect(bySlug?.id).toBe(created.id);

    // Update Article with a new version
    const updated = await repo.updateArticle(created.id, {
      title: "Updated Article Title",
      status: "APPROVED",
      newVersion: {
        title: "Updated Article Title",
        content: "# Heading 1\n\nRevised content with additions.",
        changeSummary: "Editorial updates"
      }
    });
    expect(updated?.title).toBe("Updated Article Title");
    expect(updated?.status).toBe("APPROVED");

    // Verify versions
    const versions = await repo.getVersionsByArticle(created.id);
    expect(versions.length).toBe(2);
    expect(versions[0].versionNumber).toBe(2);
    expect(versions[0].title).toBe("Updated Article Title");
    expect(versions[1].versionNumber).toBe(1);

    // List by website
    const articles = await repo.findArticlesByWebsite(testWebsiteId);
    expect(articles.length).toBeGreaterThanOrEqual(1);

    // Count
    const countTotal = await repo.countArticles({ websiteId: testWebsiteId });
    expect(countTotal).toBeGreaterThanOrEqual(1);
    const countApproved = await repo.countArticles({ websiteId: testWebsiteId, status: "APPROVED" });
    expect(countApproved).toBeGreaterThanOrEqual(1);
  });

  it("supports ArticleImage operations including featured image toggling", async () => {
    const slug = "test-image-article-" + Date.now();
    const article = await repo.createArticle({
      websiteId: testWebsiteId,
      title: "Image Article",
      slug,
      content: "Content with image"
    });

    const img1 = await repo.addImage({
      articleId: article.id,
      url: "https://example.com/img1.svg",
      altText: "Image 1 alt",
      isFeatured: true
    });
    expect(img1.id).toBeDefined();
    expect(img1.isFeatured).toBe(true);

    const img2 = await repo.addImage({
      articleId: article.id,
      url: "https://example.com/img2.svg",
      altText: "Image 2 alt",
      isFeatured: false
    });
    expect(img2.isFeatured).toBe(false);

    let images = await repo.getImagesByArticle(article.id);
    expect(images.length).toBe(2);

    // Switch featured image to img2
    const setFeaturedRes = await repo.setFeaturedImage(article.id, img2.id);
    expect(setFeaturedRes).toBe(true);

    images = await repo.getImagesByArticle(article.id);
    const currentFeatured = images.find((i) => i.isFeatured);
    expect(currentFeatured?.id).toBe(img2.id);

    // Delete image 1
    const delRes = await repo.deleteImage(img1.id);
    expect(delRes).toBe(true);
    const imagesAfterDel = await repo.getImagesByArticle(article.id);
    expect(imagesAfterDel.length).toBe(1);
  });

  it("cascades deletion of versions and images when an article is deleted", async () => {
    const slug = "test-cascade-" + Date.now();
    const article = await repo.createArticle({
      websiteId: testWebsiteId,
      title: "Cascade Test",
      slug,
      content: "Cascade content",
      initialVersion: {
        title: "Cascade Test",
        content: "Cascade content"
      }
    });

    await repo.addImage({
      articleId: article.id,
      url: "https://example.com/cascade.svg",
      altText: "Cascade alt"
    });

    const deleted = await repo.deleteArticle(article.id);
    expect(deleted).toBe(true);

    const byId = await repo.findArticleById(article.id);
    expect(byId).toBeNull();

    const versions = await repo.getVersionsByArticle(article.id);
    expect(versions.length).toBe(0);

    const images = await repo.getImagesByArticle(article.id);
    expect(images.length).toBe(0);
  });
});
