import { NextRequest } from "next/server";
import { getSessionFromRequest, SESSION_COOKIE_NAME } from "@/lib/auth";
import { apiSuccess } from "@/lib/api-response";
import { recordAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (user) {
    await recordAuditLog({
      userId: user.id,
      action: "AUTH_LOGOUT",
      module: "auth",
      metadata: { email: user.email }
    });
  }

  const response = apiSuccess({ loggedOut: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  return response;
}

