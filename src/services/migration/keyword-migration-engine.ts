import { getDb } from "@/lib/db";
import { getKeywordDomainRepository } from "@/repositories/keyword-repository.factory";

export interface KeywordMigrationReport {
  dryRun: boolean;
  categoriesExamined: number;
  categoriesInserted: number;
  categoriesUpdated: number;
  clustersExamined: number;
  clustersInserted: number;
  clustersUpdated: number;
  keywordsExamined: number;
  keywordsInserted: number;
  keywordsUpdated: number;
  errors: string[];
}

export async function migrateKeywordsToMongo(
  options: { dryRun?: boolean } = {}
): Promise<KeywordMigrationReport> {
  const dryRun = options.dryRun ?? false;
  const report: KeywordMigrationReport = {
    dryRun,
    categoriesExamined: 0,
    categoriesInserted: 0,
    categoriesUpdated: 0,
    clustersExamined: 0,
    clustersInserted: 0,
    clustersUpdated: 0,
    keywordsExamined: 0,
    keywordsInserted: 0,
    keywordsUpdated: 0,
    errors: []
  };

  const db = await getDb();
  const mongoRepo = getKeywordDomainRepository();

  if (!dryRun) {
    await mongoRepo.initIndexes();
  }

  // 1. Migrate Categories
  try {
    const pgCategories = await db.category.findMany();
    report.categoriesExamined = pgCategories.length;

    for (const cat of pgCategories) {
      try {
        const existing = await mongoRepo.findCategoryBySlug(cat.websiteId, cat.slug);
        if (!existing) {
          if (!dryRun) {
            await mongoRepo.createCategory({
              id: cat.id,
              websiteId: cat.websiteId,
              name: cat.name,
              slug: cat.slug,
              description: cat.description,
              parentId: cat.parentId
            });
          }
          report.categoriesInserted++;
        } else {
          if (!dryRun) {
            await mongoRepo.updateCategory(existing.id, {
              name: cat.name,
              description: cat.description,
              parentId: cat.parentId
            });
          }
          report.categoriesUpdated++;
        }
      } catch (err) {
        report.errors.push(
          `Category migration error (${cat.slug}): ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
  } catch (err) {
    report.errors.push(
      `Failed to query PostgreSQL categories: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  // 2. Migrate Keyword Clusters
  try {
    const pgClusters = await db.keywordCluster.findMany();
    report.clustersExamined = pgClusters.length;

    for (const clus of pgClusters) {
      try {
        const existing = await mongoRepo.findClusterById(clus.id);
        if (!existing) {
          if (!dryRun) {
            await mongoRepo.createCluster({
              id: clus.id,
              websiteId: clus.websiteId,
              name: clus.name,
              pillarKeyword: clus.pillarKeyword,
              intent: clus.intent,
              status: clus.status
            });
          }
          report.clustersInserted++;
        } else {
          if (!dryRun) {
            await mongoRepo.updateCluster(existing.id, {
              name: clus.name,
              pillarKeyword: clus.pillarKeyword,
              intent: clus.intent,
              status: clus.status
            });
          }
          report.clustersUpdated++;
        }
      } catch (err) {
        report.errors.push(
          `Cluster migration error (${clus.id}): ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
  } catch (err) {
    report.errors.push(
      `Failed to query PostgreSQL keyword clusters: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  // 3. Migrate Keywords
  try {
    const pgKeywords = await db.keyword.findMany();
    report.keywordsExamined = pgKeywords.length;

    for (const kw of pgKeywords) {
      try {
        const existing = await mongoRepo.findKeywordByTerm(kw.websiteId, kw.term);
        if (!existing) {
          if (!dryRun) {
            await mongoRepo.createKeyword({
              id: kw.id,
              websiteId: kw.websiteId,
              clusterId: kw.clusterId,
              term: kw.term,
              searchIntent: kw.searchIntent,
              searchVolume: kw.searchVolume,
              difficulty: kw.difficulty,
              cpc: kw.cpc,
              currentPosition: kw.currentPosition,
              status: kw.status
            });
          }
          report.keywordsInserted++;
        } else {
          if (!dryRun) {
            await mongoRepo.updateKeyword(existing.id, {
              clusterId: kw.clusterId,
              searchIntent: kw.searchIntent,
              searchVolume: kw.searchVolume,
              difficulty: kw.difficulty,
              cpc: kw.cpc,
              currentPosition: kw.currentPosition,
              status: kw.status
            });
          }
          report.keywordsUpdated++;
        }
      } catch (err) {
        report.errors.push(
          `Keyword migration error (${kw.term}): ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
  } catch (err) {
    report.errors.push(
      `Failed to query PostgreSQL keywords: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  return report;
}
