import { NextRequest } from "next/server";
import { z } from "zod";
import { isExternalManagedDatabase } from "@/lib/db";
import { ensureSystemSeeded } from "@/lib/seed-service";
import {
  apiError,
  apiSuccess,
  parseAndValidateBody,
  requireApiAuth
} from "@/lib/api-response";
import { recordAuditLog } from "@/lib/audit";
import {
  DURABLE_JOB_TYPES,
  enqueueDurableJob,
  processDurableJobBatch,
  recoverStalledJobs,
  verifyWorkerSignature
} from "@/services/automation/durable-job-queue";
import { getAutomationRepository } from "@/repositories/automation-repository.factory";

const enqueueJobSchema = z.object({
  websiteId: z.string().optional().nullable(),
  jobType: z.enum(DURABLE_JOB_TYPES),
  idempotencyKey: z.string().min(3).max(180),
  priority: z.number().int().min(1).max(100).default(10),
  payload: z.record(z.unknown()).optional(),
  maxAttempts: z.number().int().min(1).max(10).default(3)
});

const workerDispatchSchema = z.object({
  action: z.enum(["process_batch", "recover_stalled", "cron_tick"]).default("process_batch"),
  workerId: z.string().default("external-automation-worker-01"),
  maxBatchSize: z.number().int().min(1).max(25).default(5)
});

/**
 * GET /api/v1/jobs?websiteId=...
 * Lists durable background jobs, queue health counts, and Vercel deployment readiness.
 */
export async function GET(req: NextRequest) {
  await ensureSystemSeeded();
  const { errorResponse } = await requireApiAuth(req, "automations:read");
  if (errorResponse) return errorResponse;

  const repo = getAutomationRepository();
  const websiteId = req.nextUrl.searchParams.get("websiteId");

  const [jobs, statusCounts] = await Promise.all([
    repo.findDurableJobs({ websiteId, limit: 50 }),
    repo.getDurableJobStatusCounts(websiteId)
  ]);

  return apiSuccess({
    architecture: {
      deploymentTopology: "VERCEL_FIRST_DECOUPLED_WORKER",
      persistentWorkersInsideVercelFunctions: false,
      externalManagedPostgresConfigured: isExternalManagedDatabase(),
      publicWebsiteOfflineResilience: true,
      supportedJobTypes: DURABLE_JOB_TYPES
    },
    counts: {
      queued: statusCounts.QUEUED || 0,
      running: statusCounts.RUNNING || 0,
      completed: statusCounts.COMPLETED || 0,
      retryScheduled: statusCounts.RETRY_SCHEDULED || 0,
      deadLetter: statusCounts.DEAD_LETTER || 0
    },
    jobs
  });
}

/**
 * POST /api/v1/jobs
 * Enqueues a durable background job with strict idempotency protection.
 */
export async function POST(req: NextRequest) {
  await ensureSystemSeeded();
  const { user, errorResponse } = await requireApiAuth(req, "automations:write");
  if (errorResponse || !user) return errorResponse!;

  const { data, errorResponse: valErr } = await parseAndValidateBody(
    req,
    enqueueJobSchema
  );
  if (valErr || !data) return valErr!;

  const result = await enqueueDurableJob({
    websiteId: data.websiteId || null,
    jobType: data.jobType,
    idempotencyKey: data.idempotencyKey,
    priority: data.priority,
    payload: data.payload,
    maxAttempts: data.maxAttempts
  });

  await recordAuditLog({
    userId: user.id,
    action: result.deduplicated ? "DURABLE_JOB_DEDUPLICATED" : "DURABLE_JOB_ENQUEUED",
    module: "automations",
    entityType: "DurableJob",
    entityId: result.jobId,
    metadata: {
      jobType: result.jobType,
      idempotencyKey: result.idempotencyKey,
      deduplicated: result.deduplicated
    }
  });

  return apiSuccess(result, result.deduplicated ? 200 : 201);
}

/**
 * PUT /api/v1/jobs
 * Secure endpoint for the separately deployed Automation Worker Service (authenticated via
 * HMAC-SHA256 X-Worker-Signature + X-Worker-Timestamp or authenticated admin session)
 * to process a bounded batch or recover stalled leases.
 */
export async function PUT(req: NextRequest) {
  await ensureSystemSeeded();

  const rawBody = await req.text();
  const sigCheck = verifyWorkerSignature({
    rawBody,
    timestampHeader: req.headers.get("x-worker-timestamp"),
    signatureHeader: req.headers.get("x-worker-signature"),
    authorizationHeader: req.headers.get("authorization")
  });

  if (!sigCheck.valid) {
    // Fallback: allow interactive authenticated admin user from dashboard
    const { errorResponse } = await requireApiAuth(req, "automations:write");
    if (errorResponse) {
      return apiError(
        "UNAUTHORIZED_WORKER_SIGNATURE",
        sigCheck.reason || "Valid HMAC worker signature or admin session required",
        401
      );
    }
  }

  let parsedBody: Record<string, unknown> = {};
  try {
    parsedBody = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return apiError("INVALID_JSON", "Malformed JSON body", 400);
  }

  const parsed = workerDispatchSchema.safeParse(parsedBody);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  const { action, workerId, maxBatchSize } = parsed.data;

  if (action === "recover_stalled") {
    const recoveredCount = await recoverStalledJobs();
    return apiSuccess({ action, workerId, recoveredCount });
  }

  const batchResult = await processDurableJobBatch({ workerId, maxBatchSize });
  return apiSuccess({
    action,
    ...batchResult
  });
}

