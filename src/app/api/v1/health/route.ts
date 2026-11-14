import { ensureSystemSeeded } from "@/lib/seed-service";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getAuthRepository } from "@/repositories/auth-repository.factory";
import { getWebsiteRepository } from "@/repositories/website-repository.factory";
import { pingMongo } from "@/lib/mongodb";

export async function GET() {
  try {
    await ensureSystemSeeded();
    const authRepo = getAuthRepository();
    const websiteRepo = getWebsiteRepository();

    // Check actual database connectivity
    let dbStatus = "connected";
    if (process.env.MONGODB_URI) {
      try {
        const mongoHealth = await pingMongo();
        if (!mongoHealth.ok) {
          dbStatus = "disconnected";
          return apiError(
            "DATABASE_UNAVAILABLE",
            "MongoDB primary database ping failed",
            503
          );
        }
      } catch (pingErr) {
        return apiError(
          "DATABASE_UNAVAILABLE",
          `MongoDB primary database connection failed: ${pingErr instanceof Error ? pingErr.message : "unreachable"}`,
          503
        );
      }
    }

    const userCount = authRepo.countUsers ? await authRepo.countUsers() : 0;
    const websiteCount = websiteRepo.countWebsites ? await websiteRepo.countWebsites() : 0;

    return apiSuccess({
      status: "healthy",
      phase: "PHASE_01_FOUNDATION",
      zeroCostPolicy: "ENFORCED",
      database: dbStatus,
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
