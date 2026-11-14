import { NextRequest } from "next/server";
import { ensureSystemSeeded } from "@/lib/seed-service";
import {
  apiError,
  apiSuccess,
  requireApiAuth
} from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { getPakistanGoldRates } from "@/services/finance/pakistan-gold-rate-service";
import { SupportedCitySlugSchema } from "@/services/finance/pakistan-gold-rate-schemas";

export async function GET(req: NextRequest) {
  await ensureSystemSeeded();
  const { user, errorResponse } = await requireApiAuth(req);
  if (errorResponse || !user) return errorResponse!;

  // Apply per-user rate limit (e.g., 30 requests per minute)
  const rateLimit = checkRateLimit(`gold_rates_${user.id}`, 30, 60_000);
  if (!rateLimit.allowed) {
    return apiError(
      "RATE_LIMIT_EXCEEDED",
      "Too many rate requests. Please try again shortly.",
      429,
      { resetAfterMs: rateLimit.resetAfterMs }
    );
  }

  const { searchParams } = new URL(req.url);
  const cityParam = (searchParams.get("city") || "islamabad").toLowerCase().trim();
  const forceRefresh = searchParams.get("refresh") === "true";

  const cityValidation = SupportedCitySlugSchema.safeParse(cityParam);
  if (!cityValidation.success) {
    return apiError(
      "INVALID_CITY",
      `Unsupported city '${cityParam}'. Supported cities: islamabad, rawalpindi, karachi, lahore, peshawar, faisalabad, multan, quetta`,
      400
    );
  }

  try {
    const data = await getPakistanGoldRates(cityValidation.data, forceRefresh);
    return apiSuccess({ rates: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch Pakistan gold rates";
    return apiError("GOLD_RATE_FETCH_FAILED", message, 502);
  }
}
