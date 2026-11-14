import { getDb } from "@/lib/db";
import { getContentBriefRepository } from "@/repositories/content-brief-repository.factory";

export interface ContentBriefMigrationReport {
  dryRun: boolean;
  briefsExamined: number;
  briefsInserted: number;
  briefsUpdated: number;
  skipped: number;
  errors: string[];
}

export async function migrateContentBriefsToMongo(
  options: { dryRun?: boolean } = {}
): Promise<ContentBriefMigrationReport> {
  const dryRun = options.dryRun ?? false;
  const report: ContentBriefMigrationReport = {
    dryRun,
    briefsExamined: 0,
    briefsInserted: 0,
    briefsUpdated: 0,
    skipped: 0,
    errors: []
  };

  const db = await getDb();
  const mongoRepo = getContentBriefRepository();

  if (!dryRun) {
    await mongoRepo.initIndexes();
  }

  try {
    const pgBriefs = await db.contentBrief.findMany();
    report.briefsExamined = pgBriefs.length;

    for (const brief of pgBriefs) {
      try {
        const existing = await mongoRepo.findById(brief.id);
        if (!existing) {
          if (!dryRun) {
            await mongoRepo.createBrief({
              id: brief.id,
              websiteId: brief.websiteId,
              keywordId: brief.keywordId,
              clusterId: brief.clusterId,
              title: brief.title,
              targetWordCount: brief.targetWordCount,
              searchIntent: brief.searchIntent,
              outline: brief.outline,
              secondaryKeywords: brief.secondaryKeywords,
              competitorNotes: brief.competitorNotes,
              status: brief.status
            });
          }
          report.briefsInserted++;
        } else {
          if (!dryRun) {
            await mongoRepo.updateBrief(existing.id, {
              keywordId: brief.keywordId,
              clusterId: brief.clusterId,
              title: brief.title,
              targetWordCount: brief.targetWordCount,
              searchIntent: brief.searchIntent,
              outline: brief.outline,
              secondaryKeywords: brief.secondaryKeywords,
              competitorNotes: brief.competitorNotes,
              status: brief.status
            });
          }
          report.briefsUpdated++;
        }
      } catch (bErr) {
        report.errors.push(
          `Failed to migrate brief ${brief.id}: ${
            bErr instanceof Error ? bErr.message : String(bErr)
          }`
        );
      }
    }
  } catch (err) {
    report.errors.push(
      `Failed to query PostgreSQL content briefs: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  return report;
}
