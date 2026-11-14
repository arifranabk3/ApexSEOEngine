import { getDb } from "@/lib/db";
import { getPublishingRepository } from "@/repositories/publishing-repository.factory";
import { CreateInternalLinkInput, CreatePublishingJobInput } from "@/repositories/publishing-repository.types";

export interface PublishingMigrationOptions {
  dryRun?: boolean;
}

export interface PublishingMigrationResult {
  dryRun: boolean;
  linksSourceCount: number;
  linksInserted: number;
  linksSkipped: number;
  jobsSourceCount: number;
  jobsInserted: number;
  jobsSkipped: number;
  errors: Array<{ entity: "InternalLink" | "PublishingJob"; id: string; error: string }>;
}

export async function migratePublishingToMongo(
  options: PublishingMigrationOptions = {}
): Promise<PublishingMigrationResult> {
  const dryRun = Boolean(options.dryRun);
  const db = await getDb();
  const publishingRepo = getPublishingRepository();

  if (!dryRun) {
    await publishingRepo.initIndexes();
  }

  // 1. Fetch source records from PostgreSQL / Prisma
  const [sourceLinks, sourceJobs] = await Promise.all([
    db.internalLink.findMany({ orderBy: { createdAt: "asc" } }),
    db.publishingJob.findMany({ orderBy: { createdAt: "asc" } })
  ]);

  const result: PublishingMigrationResult = {
    dryRun,
    linksSourceCount: sourceLinks.length,
    linksInserted: 0,
    linksSkipped: 0,
    jobsSourceCount: sourceJobs.length,
    jobsInserted: 0,
    jobsSkipped: 0,
    errors: []
  };

  // 2. Migrate InternalLink records
  for (const link of sourceLinks) {
    try {
      const existing = await publishingRepo.findInternalLinkById(link.id);
      if (existing) {
        result.linksSkipped++;
        continue;
      }

      if (!dryRun) {
        const input: CreateInternalLinkInput = {
          id: link.id,
          websiteId: link.websiteId,
          sourceArticleId: link.sourceArticleId,
          targetArticleId: link.targetArticleId,
          anchorText: link.anchorText,
          targetUrl: link.targetUrl,
          status: link.status,
          relevanceScore: link.relevanceScore
        };
        await publishingRepo.createInternalLink(input);
      }
      result.linksInserted++;
    } catch (err) {
      result.errors.push({
        entity: "InternalLink",
        id: link.id,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  // 3. Migrate PublishingJob records
  for (const job of sourceJobs) {
    try {
      const existing = await publishingRepo.findPublishingJobById(job.id);
      if (existing) {
        result.jobsSkipped++;
        continue;
      }

      if (!dryRun) {
        const input: CreatePublishingJobInput = {
          id: job.id,
          websiteId: job.websiteId,
          articleId: job.articleId,
          cmsType: job.cmsType,
          status: job.status,
          scheduledFor: job.scheduledFor,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
          remotePostId: job.remotePostId,
          publishedUrl: job.publishedUrl,
          errorMessage: job.errorMessage,
          responseLog: job.responseLog as Record<string, unknown>
        };
        await publishingRepo.createPublishingJob(input);
      }
      result.jobsInserted++;
    } catch (err) {
      result.errors.push({
        entity: "PublishingJob",
        id: job.id,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  return result;
}
