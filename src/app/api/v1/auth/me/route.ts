import { NextRequest } from "next/server";
import { requireApiAuth, apiSuccess } from "@/lib/api-response";
import { ensureSystemSeeded } from "@/lib/seed-service";

export async function GET(req: NextRequest) {
  await ensureSystemSeeded();
  const { user, errorResponse } = await requireApiAuth(req);
  if (errorResponse || !user) return errorResponse!;

  return apiSuccess({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      roleName: user.roleName,
      permissions: user.permissions,
      mustChangePassword: Boolean(user.mustChangePassword)
    }
  });
}

