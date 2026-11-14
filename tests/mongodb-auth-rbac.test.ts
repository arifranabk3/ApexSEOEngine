import { describe, it, expect, beforeAll } from "vitest";
import { MongoAuthRepository } from "@/repositories/mongo-auth-repository";
import { PostgresAuthRepository } from "@/repositories/postgres-auth-repository";
import { migrateAuthToMongo } from "@/services/migration/auth-migration-engine";
import { hashPassword, verifyPassword, createSessionToken, verifySessionToken, hasPermission } from "@/lib/auth";
import { ensureSystemSeeded } from "@/lib/seed-service";

describe("Phase B: MongoDB Auth & RBAC Complete Integration Suite", () => {
  let mongoRepo: MongoAuthRepository;
  let pgRepo: PostgresAuthRepository;

  beforeAll(async () => {
    await ensureSystemSeeded();
    mongoRepo = new MongoAuthRepository();
    pgRepo = new PostgresAuthRepository();
    await mongoRepo.ensureIndexes();
  });

  it("executes an idempotent dry-run migration without writing records", async () => {
    const dryRunRes = await migrateAuthToMongo({ dryRun: true });
    expect(dryRunRes.dryRun).toBe(true);
    expect(dryRunRes.permissionsSourceCount).toBeGreaterThan(0);
    expect(dryRunRes.rolesSourceCount).toBeGreaterThan(0);
    expect(dryRunRes.usersSourceCount).toBeGreaterThan(0);
    expect(dryRunRes.errors).toHaveLength(0);
  });

  it("migrates all users, roles, and permissions from PostgreSQL to MongoDB idempotently", async () => {
    const liveRunRes = await migrateAuthToMongo({ dryRun: false });
    expect(liveRunRes.dryRun).toBe(false);
    expect(liveRunRes.permissionsTargetCount).toBe(liveRunRes.permissionsSourceCount);
    expect(liveRunRes.rolesTargetCount).toBe(liveRunRes.rolesSourceCount);
    expect(liveRunRes.usersTargetCount).toBe(liveRunRes.usersSourceCount);
    expect(liveRunRes.errors).toHaveLength(0);

    // Verify admin user exists and is identical
    const adminEmail = "admin@apexseo.local";
    const pgAdmin = await pgRepo.findUserByEmail(adminEmail);
    const mongoAdmin = await mongoRepo.findUserByEmail(adminEmail);

    expect(pgAdmin).not.toBeNull();
    expect(mongoAdmin).not.toBeNull();
    expect(mongoAdmin!.user.id).toBe(pgAdmin!.user.id);
    expect(mongoAdmin!.user.email).toBe(pgAdmin!.user.email);
    expect(mongoAdmin!.role.name).toBe("SUPER_ADMIN");
  });

  it("verifies bcrypt password hash compatibility on migrated MongoDB user", async () => {
    const mongoAdmin = await mongoRepo.findUserByEmail("admin@apexseo.local");
    expect(mongoAdmin).not.toBeNull();

    // Verify existing password works without re-hashing
    const defaultPassword = process.env.INITIAL_ADMIN_PASSWORD || "Admin@12345";
    const isValid = await verifyPassword(defaultPassword, mongoAdmin!.user.passwordHash);
    expect(isValid).toBe(true);

    const isWrong = await verifyPassword("WrongPassword123", mongoAdmin!.user.passwordHash);
    expect(isWrong).toBe(false);
  });

  it("enforces unique email index on MongoDB users collection", async () => {
    const role = await mongoRepo.getRoleByName("VIEWER");
    expect(role).not.toBeNull();

    const testEmail = `duplicate-test-${Date.now()}@apexseo.local`;
    await mongoRepo.createUser({
      email: testEmail,
      name: "Duplicate Original",
      passwordHash: await hashPassword("ValidPass!123"),
      roleId: role!.role.id
    });

    // Second insertion with identical email must throw duplicate key error
    await expect(
      mongoRepo.createUser({
        email: testEmail,
        name: "Duplicate Attempt",
        passwordHash: await hashPassword("ValidPass!123"),
        roleId: role!.role.id
      })
    ).rejects.toThrow();
  });

  it("signs and verifies JWT sessions against MongoDB repository with tokenVersion revocation", async () => {
    const mongoUser = await mongoRepo.findUserByEmail("admin@apexseo.local");
    expect(mongoUser).not.toBeNull();

    const sessionPayload = {
      id: mongoUser!.user.id,
      email: mongoUser!.user.email,
      name: mongoUser!.user.name,
      roleName: mongoUser!.role.name,
      permissions: mongoUser!.permissions,
      tokenVersion: mongoUser!.user.tokenVersion,
      mustChangePassword: mongoUser!.user.mustChangePassword
    };

    const token = await createSessionToken(sessionPayload);
    const verified = await verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified!.id).toBe(mongoUser!.user.id);

    // Bump tokenVersion to invalidate
    const nextVersion = mongoUser!.user.tokenVersion + 1;
    await mongoRepo.updatePassword(mongoUser!.user.id, mongoUser!.user.passwordHash, nextVersion);

    // With AUTH_STORAGE_BACKEND="mongodb", token is now revoked
    const origBackend = process.env.AUTH_STORAGE_BACKEND;
    process.env.AUTH_STORAGE_BACKEND = "mongodb";
    try {
      const revoked = await verifySessionToken(token);
      expect(revoked).toBeNull();
    } finally {
      process.env.AUTH_STORAGE_BACKEND = origBackend;
    }
  });

  it("verifies tenant isolation logic for users", async () => {
    const mongoAdmin = await mongoRepo.findUserByEmail("admin@apexseo.local");
    const fakeWebsiteId = "00000000-0000-0000-0000-000000000001";

    // Super Admin has access to all tenants
    const superAdminAccess = await mongoRepo.verifyTenantAccess(mongoAdmin!.user.id, fakeWebsiteId);
    expect(superAdminAccess).toBe(true);

    // Viewer without website ownership is denied
    const viewerRole = await mongoRepo.getRoleByName("VIEWER");
    const unprivileged = await mongoRepo.createUser({
      email: `isolated-user-${Date.now()}@apexseo.local`,
      name: "Tenant Isolated",
      passwordHash: await hashPassword("Pass!12345"),
      roleId: viewerRole!.role.id,
      websiteIds: []
    });

    const unprivilegedAccess = await mongoRepo.verifyTenantAccess(unprivileged.id, fakeWebsiteId);
    expect(unprivilegedAccess).toBe(false);
  });
});
