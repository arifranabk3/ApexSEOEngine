import { getDb } from "@/lib/db";
import { ensureSystemSeeded } from "@/lib/seed-service";
import { apiError, apiSuccess } from "@/lib/api-response";

export async function GET() {
  try {
    await ensureSystemSeeded();
    const db = await getDb();
    const userCount = await db.user.count();
    const websiteCount = await db.website.count();

    return apiSuccess({
      status: "healthy",
      phase: "PHASE_01_FOUNDATION",
      zeroCostPolicy: "ENFORCED",
      database: "connected",
      metrics: {
        users: userCount,
        websites: websiteCount
      }
    });
  } catch (err) {
    return apiError(
      "HEALTH_CHECK_FAILED",
      err instanceof Error ? err.message : "Database connectivity check failed",
      500
    );
  }
}

