import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { getDb } from "./db";

export const SESSION_COOKIE_NAME = "apexseo_session";
export const CSRF_COOKIE_NAME = "apexseo_csrf";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  roleName: string;
  permissions: string[];
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
    permissions: user.permissions
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
    return {
      id: payload.sub,
      email: payload.email,
      name: String(payload.name || ""),
      roleName: String(payload.roleName || "VIEWER"),
      permissions: Array.isArray(payload.permissions)
        ? payload.permissions.map(String)
        : []
    };
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
  const db = await getDb();
  const normalizedEmail = email.trim().toLowerCase();

  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      role: {
        include: {
          permissions: true
        }
      }
    }
  });

  if (!user || !user.isActive) {
    return null;
  }

  const valid = await verifyPassword(passwordPlain, user.passwordHash);
  if (!valid) {
    return null;
  }

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roleName: user.role.name,
    permissions: user.role.permissions.map((p) => p.code)
  };
}

