import { NextRequest } from "next/server";
import { requireApiAuth, apiSuccess } from "@/lib/api-response";
import { ensureSystemSeeded } from "@/lib/seed-service";

export async function GET(req: NextRequest) {
  await ensureSystemSeeded();
  const { user, errorResponse } = await requireApiAuth(req);
  if (errorResponse || !user) return errorResponse!;

  return apiSuccess({ user });
}

