import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ensureSystemSeeded } from "@/lib/seed-service";
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  hasPermission,
  SESSION_COOKIE_NAME,
  SessionUser
} from "@/lib/auth";
import { checkRateLimitDistributed, resetRateLimiterForTesting } from "@/lib/rate-limit";
import { POST as changePasswordPost } from "@/app/api/v1/auth/change-password/route";
import { GET as contentGet, POST as contentPost } from "@/app/api/v1/content/route";
import { PATCH as websitePatch, DELETE as websiteDelete } from "@/app/api/v1/websites/[id]/route";
import { GET as settingsGet } from "@/app/api/v1/settings/route";
import { GET as meGet } from "@/app/api/v1/auth/me/route";

describe("Security Hardening, RBAC & Privilege Escalation Suite", () => {
  let superAdminUser: SessionUser;
  let editorUser: SessionUser;
  let viewerUser: SessionUser;
  let unprivilegedUser: SessionUser;
  let primaryWebsiteId: string;

  beforeAll(async () => {
    await ensureSystemSeeded();
    const db = await getDb();

    const superAdminDb = await db.user.findFirst({
      where: { role: { name: "SUPER_ADMIN" } },
      include: { role: { include: { permissions: true } } }
    });
    superAdminUser = {
      id: superAdminDb!.id,
      email: superAdminDb!.email,
      name: superAdminDb!.name,
      roleName: superAdminDb!.role.name,
      permissions: superAdminDb!.role.permissions.map((p) => p.code),
      tokenVersion: superAdminDb!.tokenVersion ?? 0,
      mustChangePassword: superAdminDb!.mustChangePassword
    };

    // Create an explicit EDITOR test user
    const editorRole = await db.role.findUnique({
      where: { name: "EDITOR" },
      include: { permissions: true }
    });
    const editorDb = await db.user.upsert({
      where: { email: "test-editor@apexseo.local" },
      update: {},
      create: {
        email: "test-editor@apexseo.local",
        name: "Test Editor",
        passwordHash: await hashPassword("EditorSecure!2026"),
        roleId: editorRole!.id
      },
      include: { role: { include: { permissions: true } } }
    });
    editorUser = {
      id: editorDb.id,
      email: editorDb.email,
      name: editorDb.name,
      roleName: editorDb.role.name,
      permissions: editorDb.role.permissions.map((p) => p.code),
      tokenVersion: editorDb.tokenVersion ?? 0,
      mustChangePassword: false
    };

    // Create an explicit VIEWER test user
    const viewerRole = await db.role.findUnique({
      where: { name: "VIEWER" },
      include: { permissions: true }
    });
    const viewerDb = await db.user.upsert({
      where: { email: "test-viewer@apexseo.local" },
      update: {},
      create: {
        email: "test-viewer@apexseo.local",
        name: "Test Viewer",
        passwordHash: await hashPassword("ViewerSecure!2026"),
        roleId: viewerRole!.id
      },
      include: { role: { include: { permissions: true } } }
    });
    viewerUser = {
      id: viewerDb.id,
      email: viewerDb.email,
      name: viewerDb.name,
      roleName: viewerDb.role.name,
      permissions: viewerDb.role.permissions.map((p) => p.code),
      tokenVersion: viewerDb.tokenVersion ?? 0,
      mustChangePassword: false
    };

    unprivilegedUser = {
      id: "unprivileged-test-id",
      email: "intruder@malicious.local",
      name: "Unprivileged User",
      roleName: "GUEST",
      permissions: [],
      tokenVersion: 0,
      mustChangePassword: false
    };

    const site = await db.website.findFirst({ where: { status: "ACTIVE" } });
    primaryWebsiteId = site!.id;
  });

  beforeEach(() => {
    resetRateLimiterForTesting();
  });

  it("enforces RBAC permissions across non-admin roles (Editor vs Viewer)", () => {
    // EDITOR has content permissions but not website deletion
    expect(hasPermission(editorUser, "content:read")).toBe(true);
    expect(hasPermission(editorUser, "content:write")).toBe(true);
    expect(hasPermission(editorUser, "websites:delete")).toBe(false);
    expect(hasPermission(editorUser, "settings:write")).toBe(false);

    // VIEWER only has read permissions
    expect(hasPermission(viewerUser, "content:read")).toBe(true);
    expect(hasPermission(viewerUser, "websites:read")).toBe(true);
    expect(hasPermission(viewerUser, "content:write")).toBe(false);
    expect(hasPermission(viewerUser, "websites:write")).toBe(false);

    // GUEST has no permissions
    expect(hasPermission(unprivilegedUser, "content:read")).toBe(false);
  });

  it("blocks vertical privilege escalation: VIEWER cannot create content or delete websites", async () => {
    const viewerToken = await createSessionToken(viewerUser);

    // Attempt to write content with VIEWER token -> must be 403 Forbidden
    const createReq = new NextRequest("http://localhost:3000/api/v1/content", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${viewerToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        websiteId: primaryWebsiteId,
        title: "Escalation Attempt Article",
        slug: "escalation-attempt",
        content: "Attempting to create article without permission."
      })
    });
    const createRes = await contentPost(createReq);
    expect(createRes.status).toBe(403);
    const createJson = await createRes.json();
    expect(createJson.error.code).toBe("FORBIDDEN");

    // Attempt to delete a website with VIEWER token -> must be 403 Forbidden
    const deleteReq = new NextRequest(`http://localhost:3000/api/v1/websites/${primaryWebsiteId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${viewerToken}` }
    });
    const deleteRes = await websiteDelete(deleteReq, {
      params: Promise.resolve({ id: primaryWebsiteId })
    });
    expect(deleteRes.status).toBe(403);
  });

  it("blocks vertical privilege escalation: EDITOR cannot modify system settings", async () => {
    const editorToken = await createSessionToken(editorUser);

    const settingsReq = new NextRequest("http://localhost:3000/api/v1/settings", {
      method: "GET",
      headers: { Authorization: `Bearer ${editorToken}` }
    });
    const settingsRes = await settingsGet(settingsReq);
    expect(settingsRes.status).toBe(403);
    const settingsJson = await settingsRes.json();
    expect(settingsJson.error.code).toBe("FORBIDDEN");
  });

  it("masks secrets in API responses so plaintext credentials are never returned", async () => {
    const adminToken = await createSessionToken(superAdminUser);

    const req = new NextRequest("http://localhost:3000/api/v1/settings", {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const res = await settingsGet(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    const secretSettings = json.data.filter((s: { isSecret: boolean }) => s.isSecret);
    expect(secretSettings.length).toBeGreaterThan(0);
    for (const item of secretSettings) {
      expect(item.value).toMatch(/^[•]+$|^.{3}••••••••.{3}$|^Not Configured$/);
      expect(item.value).not.toContain("super-secret");
      expect(item.value).not.toContain("password");
    }
  });

  it("handles password rotation and invalidates all existing sessions via tokenVersion bump", async () => {
    const db = await getDb();

    // Create a dedicated user for password rotation test
    const testEmail = `rotation-user-${Date.now()}@apexseo.local`;
    const initialPass = "InitialPass#2026";
    const initialHash = await hashPassword(initialPass);
    const user = await db.user.create({
      data: {
        email: testEmail,
        name: "Rotation Test User",
        passwordHash: initialHash,
        mustChangePassword: true,
        tokenVersion: 1,
        roleId: editorUser.id ? (await db.role.findFirst({ where: { name: "EDITOR" } }))!.id : ""
      },
      include: { role: { include: { permissions: true } } }
    });

    const sessionObj: SessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      roleName: user.role.name,
      permissions: user.role.permissions.map((p) => p.code),
      tokenVersion: 1,
      mustChangePassword: true
    };

    // Issue initial session token
    const oldSessionToken = await createSessionToken(sessionObj);

    // Initial session is valid
    const initialVerify = await verifySessionToken(oldSessionToken);
    expect(initialVerify).not.toBeNull();
    expect(initialVerify?.tokenVersion).toBe(1);

    // Change password via API route
    const changeReq = new NextRequest("http://localhost:3000/api/v1/auth/change-password", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${oldSessionToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        currentPassword: initialPass,
        newPassword: "BrandNewSecurePassword#2027!",
        confirmPassword: "BrandNewSecurePassword#2027!"
      })
    });

    const changeRes = await changePasswordPost(changeReq);
    expect(changeRes.status).toBe(200);
    const changeJson = await changeRes.json();
    expect(changeJson.data.passwordChanged).toBe(true);

    // CRITICAL SECURITY ASSERTION: Old session token MUST now be invalidated
    const oldTokenAfterRotation = await verifySessionToken(oldSessionToken);
    expect(oldTokenAfterRotation).toBeNull(); // REVOKED!

    // Verify database tokenVersion was incremented
    const updatedDbUser = await db.user.findUnique({ where: { id: user.id } });
    expect(updatedDbUser?.tokenVersion).toBe(2);
    expect(updatedDbUser?.mustChangePassword).toBe(false);

    // Verify new password hashes correctly
    expect(await verifyPassword("BrandNewSecurePassword#2027!", updatedDbUser!.passwordHash)).toBe(true);
    expect(await verifyPassword(initialPass, updatedDbUser!.passwordHash)).toBe(false);
  });

  it("enforces distributed rate limiting using PostgreSQL AuditLog correlation", async () => {
    const testIp = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
    const db = await getDb();

    // Create 16 recent failed login audit records for this IP in PostgreSQL
    const now = new Date();
    for (let i = 0; i < 16; i++) {
      await db.auditLog.create({
        data: {
          action: "AUTH_LOGIN_FAILED",
          module: "auth",
          ipAddress: testIp,
          createdAt: now,
          metadata: { email: "target@apexseo.local" }
        }
      });
    }

    // Even if local in-memory bucket is reset, distributed check must block the IP
    resetRateLimiterForTesting();
    const result = await checkRateLimitDistributed(`login:${testIp}`, 15, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
