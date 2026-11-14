import { NextRequest } from "next/server";
import { z } from "zod";
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  SESSION_COOKIE_NAME
} from "@/lib/auth";
import {
  apiError,
  apiSuccess,
  parseAndValidateBody,
  requireApiAuth
} from "@/lib/api-response";
import { recordAuditLog } from "@/lib/audit";
import { ensureSystemSeeded } from "@/lib/seed-service";
import { getAuthRepository } from "@/repositories/auth-repository.factory";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(10, "New password must be at least 10 characters long")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/,
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
      ),
    confirmPassword: z.string().min(1, "Please confirm your new password")
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New passwords do not match",
    path: ["confirmPassword"]
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password cannot be the same as your current password",
    path: ["newPassword"]
  });

export async function POST(req: NextRequest) {
  await ensureSystemSeeded();
  const { user, errorResponse } = await requireApiAuth(req);
  if (errorResponse || !user) return errorResponse!;

  const { data, errorResponse: valErr } = await parseAndValidateBody(
    req,
    changePasswordSchema
  );
  if (valErr || !data) return valErr!;

  const authRepo = getAuthRepository();
  const authRecord = await authRepo.findUserById(user.id);

  if (!authRecord || !authRecord.user.isActive) {
    return apiError("USER_NOT_FOUND", "User account not found or inactive", 404);
  }

  const dbUser = authRecord.user;

  const isCurrentValid = await verifyPassword(
    data.currentPassword,
    dbUser.passwordHash
  );
  if (!isCurrentValid) {
    await recordAuditLog({
      userId: user.id,
      action: "AUTH_PASSWORD_CHANGE_FAILED",
      module: "auth",
      metadata: { reason: "INVALID_CURRENT_PASSWORD" }
    });
    return apiError("INVALID_CREDENTIALS", "Current password is incorrect", 400);
  }

  const newHash = await hashPassword(data.newPassword);
  const nextTokenVersion = (dbUser.tokenVersion ?? 0) + 1;

  // Update password, clear mandatory rotation flag, and bump tokenVersion to invalidate all existing sessions
  await authRepo.updatePassword(user.id, newHash, nextTokenVersion);

  await recordAuditLog({
    userId: user.id,
    action: "AUTH_PASSWORD_CHANGED",
    module: "auth",
    metadata: {
      email: dbUser.email,
      tokenVersion: nextTokenVersion,
      sessionsRevoked: true
    }
  });

  // Issue fresh session token with updated tokenVersion for the active client
  const freshSessionUser = {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    roleName: authRecord.role.name,
    permissions: authRecord.permissions,
    tokenVersion: nextTokenVersion,
    mustChangePassword: false
  };

  const freshToken = await createSessionToken(freshSessionUser);
  const response = apiSuccess({
    passwordChanged: true,
    mustChangePassword: false,
    message: "Password changed successfully. All previous sessions have been invalidated."
  });

  response.cookies.set(SESSION_COOKIE_NAME, freshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24
  });

  return response;
}
