import { NextRequest } from "next/server";
import { ensureSystemSeeded } from "@/lib/seed-service";
import { apiError, apiSuccess } from "@/lib/api-response";
import { verifyWorkerSignature } from "@/services/automation/durable-job-queue";
import { runSchedulerTick } from "@/services/automation/job-scheduler";

/**
 * GET /api/v1/cron/enqueue-schedules
 * Optional DAILY safety-net trigger (Vercel Hobby allows at most one run per day).
 * Sub-daily scheduling is driven externally via POST /api/v1/scheduler/tick.
 * Delegates to the same PostgreSQL-backed scheduler, so it is idempotent.
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

  const result = await runSchedulerTick({ triggeredBy: "vercel-daily-cron" });
  return apiSuccess({ triggeredAt: new Date().toISOString(), ...result });
}
