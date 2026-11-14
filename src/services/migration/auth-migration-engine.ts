import { getDb } from "@/lib/db";
import { getMongoDb } from "@/lib/mongodb";
import { MongoAuthRepository } from "@/repositories/mongo-auth-repository";

export interface MigrationOptions {
  dryRun?: boolean;
  batchSize?: number;
}

export interface MigrationSummary {
  dryRun: boolean;
  permissionsSourceCount: number;
  permissionsTargetCount: number;
  rolesSourceCount: number;
  rolesTargetCount: number;
  usersSourceCount: number;
  usersTargetCount: number;
  errors: string[];
  durationMs: number;
}

export async function migrateAuthToMongo(options: MigrationOptions = {}): Promise<MigrationSummary> {
  const startTime = Date.now();
  const dryRun = !!options.dryRun;
  const errors: string[] = [];

  const pgDb = await getDb();
  const mongoDb = await getMongoDb();
  const mongoRepo = new MongoAuthRepository();

  if (!dryRun) {
    await mongoRepo.ensureIndexes();
  }

  // 1. Permissions Migration
  const pgPermissions = await pgDb.permission.findMany();
  let permissionsMigrated = 0;

  for (const perm of pgPermissions) {
    try {
      if (!dryRun) {
        await mongoDb.collection("permissions").updateOne(
          { id: perm.id },
          {
            $set: {
              id: perm.id,
              code: perm.code,
              module: perm.module,
              action: perm.action,
              description: perm.description,
              createdAt: perm.createdAt,
              updatedAt: perm.updatedAt
            }
          },
          { upsert: true }
        );
      }
      permissionsMigrated++;
    } catch (err: unknown) {
      errors.push(`Permission migration error for code ${perm.code}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 2. Roles Migration
  const pgRoles = await pgDb.role.findMany({
    include: { permissions: true }
  });
  let rolesMigrated = 0;

  for (const role of pgRoles) {
    try {
      const permissionCodes = role.permissions.map((p) => p.code);
      if (!dryRun) {
        await mongoDb.collection("roles").updateOne(
          { id: role.id },
          {
            $set: {
              id: role.id,
              name: role.name,
              description: role.description,
              isSystem: role.isSystem,
              permissionCodes,
              version: 1,
              createdAt: role.createdAt,
              updatedAt: role.updatedAt
            }
          },
          { upsert: true }
        );
      }
      rolesMigrated++;
    } catch (err: unknown) {
      errors.push(`Role migration error for role ${role.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 3. Users Migration
  const pgUsers = await pgDb.user.findMany({
    include: {
      role: true,
      websites: { select: { id: true } }
    }
  });
  let usersMigrated = 0;

  for (const user of pgUsers) {
    try {
      if (!dryRun) {
        await mongoDb.collection("users").updateOne(
          { id: user.id },
          {
            $set: {
              id: user.id,
              email: user.email.toLowerCase().trim(),
              name: user.name,
              passwordHash: user.passwordHash,
              isActive: user.isActive,
              mustChangePassword: user.mustChangePassword,
              tokenVersion: user.tokenVersion ?? 0,
              roleId: user.roleId,
              websiteIds: user.websites.map((w) => w.id),
              lastLoginAt: user.lastLoginAt,
              passwordChangedAt: user.passwordChangedAt,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt
            }
          },
          { upsert: true }
        );
      }
      usersMigrated++;
    } catch (err: unknown) {
      errors.push(`User migration error for ${user.email}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    dryRun,
    permissionsSourceCount: pgPermissions.length,
    permissionsTargetCount: permissionsMigrated,
    rolesSourceCount: pgRoles.length,
    rolesTargetCount: rolesMigrated,
    usersSourceCount: pgUsers.length,
    usersTargetCount: usersMigrated,
    errors,
    durationMs: Date.now() - startTime
  };
}
