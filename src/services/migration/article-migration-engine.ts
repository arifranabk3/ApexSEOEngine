import { getDb } from "@/lib/db";
import { getArticleRepository } from "@/repositories/article-repository.factory";

export interface ArticleMigrationReport {
  dryRun: boolean;
  articlesExamined: number;
  articlesInserted: number;
  articlesUpdated: number;
  versionsExamined: number;
  versionsInserted: number;
  imagesExamined: number;
  imagesInserted: number;
  errors: string[];
}

export async function migrateArticlesToMongo(
  options: { dryRun?: boolean } = {}
): Promise<ArticleMigrationReport> {
  const dryRun = options.dryRun ?? false;
  const report: ArticleMigrationReport = {
    dryRun,
    articlesExamined: 0,
    articlesInserted: 0,
    articlesUpdated: 0,
    versionsExamined: 0,
    versionsInserted: 0,
    imagesExamined: 0,
    imagesInserted: 0,
    errors: []
  };

  const db = await getDb();
  const mongoRepo = getArticleRepository();

  if (!dryRun) {
    await mongoRepo.initIndexes();
  }

  try {
    const pgArticles = await db.article.findMany({
      include: {
        versions: true,
        images: true
      }
    });

    report.articlesExamined = pgArticles.length;

    for (const art of pgArticles) {
      try {
        const existing = await mongoRepo.findArticleById(art.id);
        if (!existing) {
          if (!dryRun) {
            await mongoRepo.createArticle({
              id: art.id,
              websiteId: art.websiteId,
              categoryId: art.categoryId,
              briefId: art.briefId,
              authorId: art.authorId,
              title: art.title,
              slug: art.slug,
              excerpt: art.excerpt,
              content: art.content,
              status: art.status,
              focusKeyword: art.focusKeyword,
              metaTitle: art.metaTitle,
              metaDescription: art.metaDescription,
              canonicalUrl: art.canonicalUrl,
              seoScore: art.seoScore,
              wordCount: art.wordCount,
              externalPostId: art.externalPostId,
              publishedUrl: art.publishedUrl,
              publishedAt: art.publishedAt
            });
          }
          report.articlesInserted++;
        } else {
          if (!dryRun) {
            await mongoRepo.updateArticle(existing.id, {
              categoryId: art.categoryId,
              briefId: art.briefId,
              authorId: art.authorId,
              title: art.title,
              slug: art.slug,
              excerpt: art.excerpt,
              content: art.content,
              status: art.status,
              focusKeyword: art.focusKeyword,
              metaTitle: art.metaTitle,
              metaDescription: art.metaDescription,
              canonicalUrl: art.canonicalUrl,
              seoScore: art.seoScore,
              wordCount: art.wordCount,
              externalPostId: art.externalPostId,
              publishedUrl: art.publishedUrl,
              publishedAt: art.publishedAt
            });
          }
          report.articlesUpdated++;
        }

        // Versions
        report.versionsExamined += art.versions.length;
        if (!dryRun) {
          const existingVersions = await mongoRepo.getVersionsByArticle(art.id);
          for (const ver of art.versions) {
            if (!existingVersions.some((v) => v.versionNumber === ver.versionNumber)) {
              await mongoRepo.createVersion({
                id: ver.id,
                articleId: art.id,
                versionNumber: ver.versionNumber,
                title: ver.title,
                content: ver.content,
                metaTitle: ver.metaTitle,
                metaDesc: ver.metaDesc,
                changeSummary: ver.changeSummary,
                createdBy: ver.createdBy
              });
              report.versionsInserted++;
            }
          }
        }

        // Images
        report.imagesExamined += art.images.length;
        if (!dryRun) {
          const existingImages = await mongoRepo.getImagesByArticle(art.id);
          for (const img of art.images) {
            if (!existingImages.some((i) => i.id === img.id || i.url === img.url)) {
              await mongoRepo.addImage({
                id: img.id,
                articleId: art.id,
                url: img.url,
                altText: img.altText,
                caption: img.caption,
                prompt: img.prompt,
                provider: img.provider,
                isFeatured: img.isFeatured,
                width: img.width,
                height: img.height
              });
              report.imagesInserted++;
            }
          }
        }
      } catch (aErr) {
        report.errors.push(
          `Failed to migrate article ${art.id} (${art.slug}): ${
            aErr instanceof Error ? aErr.message : String(aErr)
          }`
        );
      }
    }
  } catch (err) {
    report.errors.push(
      `Failed to query PostgreSQL articles: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  return report;
}
