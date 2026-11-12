import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ensureSystemSeeded } from "@/lib/seed-service";
import { apiError, apiSuccess } from "@/lib/api-response";
import {
  enqueueDurableJob,
  recoverStalledJobs,
  verifyWorkerSignature
} from "@/services/automation/durable-job-queue";

/**
 * GET /api/v1/cron/enqueue-schedules
 * Lightweight Vercel Cron trigger (executes in <200ms).
 * Never runs long-lived workers inside Vercel Functions — only recovers expired leases
 * and idempotently enqueues scheduled jobs into PostgreSQL for the external Automation Service.
 */
export async function GET(req: NextRequest) {
  await ensureSystemSeeded();

  const sigCheck = verifyWorkerSignature({
    rawBody: "",
    timestampHeader: req.headers.get("x-worker-timestamp"),
    signatureHeader: req.headers.get("x-worker-signature"),
    authorizationHeader: req.headers.get("authorization")
  });

  if (!sigCheck.valid) {
    return apiError(
      "UNAUTHORIZED_CRON_TRIGGER",
      "Valid CRON_SECRET Bearer token or worker HMAC signature required",
      401
    );
  }

  const db = await getDb();
  const recoveredLocks = await recoverStalledJobs();

  const websites = await db.website.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, url: true }
  });

  const dateBucket = new Date().toISOString().slice(0, 13); // hourly idempotency bucket
  const enqueuedJobs = [];

  for (const site of websites) {
    const gscSyncJob = await enqueueDurableJob({
      websiteId: site.id,
      jobType: "SEARCH_PERFORMANCE_MONITORING",
      idempotencyKey: `scheduled-gsc-sync:${site.id}:${dateBucket}`,
      priority: 20,
      payload: {
        websiteId: site.id,
        websiteUrl: site.url,
        scheduledBucket: dateBucket
      }
    });
    enqueuedJobs.push(gscSyncJob);

    const seoAuditJob = await enqueueDurableJob({
      websiteId: site.id,
      jobType: "SEO_AUDITING",
      idempotencyKey: `scheduled-seo-audit:${site.id}:${dateBucket}`,
      priority: 30,
      payload: {
        websiteId: site.id,
        pageUrl: site.url,
        title: `${site.name} Scheduled Compliance Verification`,
        slug: "index"
      }
    });
    enqueuedJobs.push(seoAuditJob);
  }

  return apiSuccess({
    triggeredAt: new Date().toISOString(),
    recoveredLocks,
    enqueuedCount: enqueuedJobs.filter((j) => !j.deduplicated).length,
    deduplicatedCount: enqueuedJobs.filter((j) => j.deduplicated).length,
    jobs: enqueuedJobs
  });
}

