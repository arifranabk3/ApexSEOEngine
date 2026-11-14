import { NextRequest } from "next/server";
import { z } from "zod";
import {
  authenticateUserCredentials,
  createSessionToken,
  SESSION_COOKIE_NAME
} from "@/lib/auth";
import { apiError, apiSuccess, parseAndValidateBody } from "@/lib/api-response";
import { recordAuditLog } from "@/lib/audit";
import { ensureSystemSeeded } from "@/lib/seed-service";
import { checkRateLimitDistributed } from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

export async function POST(req: NextRequest) {
  await ensureSystemSeeded();

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  const rl = await checkRateLimitDistributed(`login:${ip}`, 15, 60_000);
  if (!rl.allowed) {
    return apiError(
      "LOGIN_RATE_LIMITED",
      "Too many login attempts. Please wait a minute before trying again.",
      429
    );
  }

  const { data, errorResponse } = await parseAndValidateBody(req, loginSchema);
  if (errorResponse || !data) return errorResponse!;

  const sessionUser = await authenticateUserCredentials(data.email, data.password);
  if (!sessionUser) {
    await recordAuditLog({
      action: "AUTH_LOGIN_FAILED",
      module: "auth",
      ipAddress: ip,
      metadata: { email: data.email }
    });
    return apiError("INVALID_CREDENTIALS", "Invalid email or password", 401);
  }

  const token = await createSessionToken(sessionUser);

  await recordAuditLog({
    userId: sessionUser.id,
    action: "AUTH_LOGIN_SUCCESS",
    module: "auth",
    ipAddress: ip,
    metadata: { email: sessionUser.email, role: sessionUser.roleName }
  });

  const response = apiSuccess({
    user: sessionUser
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24
  });

  return response;
}

