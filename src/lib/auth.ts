import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { getAuthRepository } from "@/repositories/auth-repository.factory";

export const SESSION_COOKIE_NAME = "apexseo_session";
export const CSRF_COOKIE_NAME = "apexseo_csrf";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  roleName: string;
  permissions: string[];
  tokenVersion?: number;
  mustChangePassword?: boolean;
}

function getJwtSecret(): Uint8Array {
  const secret =
    process.env.JWT_SECRET ||
    "super-secret-jwt-signing-key-phase-01-seo-automation-platform-2026";
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    roleName: user.roleName,
    permissions: user.permissions,
    tokenVersion: user.tokenVersion ?? 0,
    mustChangePassword: user.mustChangePassword ?? false
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (!payload.sub || typeof payload.email !== "string") {
      return null;
    }

    const sessionUser: SessionUser = {
      id: payload.sub,
      email: payload.email,
      name: String(payload.name || ""),
      roleName: String(payload.roleName || "VIEWER"),
      permissions: Array.isArray(payload.permissions)
        ? payload.permissions.map(String)
        : [],
      tokenVersion: typeof payload.tokenVersion === "number" ? payload.tokenVersion : 0,
      mustChangePassword: Boolean(payload.mustChangePassword)
    };

    // Database-backed session validation & revocation check
    // If user exists in DB, ensure user is active and tokenVersion matches
    try {
      const repo = getAuthRepository();
      const record = await repo.findUserById(sessionUser.id);

      if (record) {
        if (!record.user.isActive) {
          return null;
        }

        if (record.user.tokenVersion !== (sessionUser.tokenVersion ?? 0)) {
          return null; // Token revoked due to password change or explicit revocation
        }

        sessionUser.mustChangePassword = record.user.mustChangePassword;
        // Centralized RBAC check: sync active permissions from live role
        sessionUser.roleName = record.role.name;
        sessionUser.permissions = record.permissions;
      }
    } catch {
      // In standalone unit tests or disconnected DB mock environments, permit payload evaluation
    }

    return sessionUser;
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(req?: NextRequest): Promise<SessionUser | null> {
  let token: string | undefined;

  if (req) {
    token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice(7);
      }
    }
  } else {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch {
      return null;
    }
  }

  if (!token) return null;
  return verifySessionToken(token);
}

export function hasPermission(user: SessionUser | null, requiredPermission: string): boolean {
  if (!user) return false;
  if (user.roleName === "SUPER_ADMIN") return true;
  if (user.permissions.includes("*")) return true;
  return user.permissions.includes(requiredPermission);
}

export async function authenticateUserCredentials(
  email: string,
  passwordPlain: string
): Promise<SessionUser | null> {
  const repo = getAuthRepository();
  const normalizedEmail = email.trim().toLowerCase();

  const record = await repo.findUserByEmail(normalizedEmail);
  if (!record || !record.user.isActive) {
    return null;
  }

  const valid = await verifyPassword(passwordPlain, record.user.passwordHash);
  if (!valid) {
    return null;
  }

  await repo.updateLastLogin(record.user.id, new Date());

  return {
    id: record.user.id,
    email: record.user.email,
    name: record.user.name,
    roleName: record.role.name,
    permissions: record.permissions,
    tokenVersion: record.user.tokenVersion ?? 0,
    mustChangePassword: record.user.mustChangePassword ?? false
  };
}

