import { getMongoDb } from "@/lib/mongodb";
import {
  IAuthRepository,
  AuthenticatedUserRecord,
  UserEntity,
  RoleWithPermissions,
  CreateUserInput,
  UpdateUserInput,
  CreateRoleInput,
  CreatePermissionInput,
  PermissionEntity,
  UserEntitySchema,
  RoleEntitySchema,
  PermissionEntitySchema
} from "./auth-repository.types";
import crypto from "crypto";

export class MongoAuthRepository implements IAuthRepository {
  async ensureIndexes(): Promise<void> {
    const db = await getMongoDb();
    await Promise.all([
      db.collection("users").createIndexes([
        { key: { email: 1 }, unique: true, name: "uniq_user_email" },
        { key: { id: 1 }, unique: true, name: "uniq_user_id" },
        { key: { roleId: 1 }, name: "idx_user_roleId" },
        { key: { isActive: 1 }, name: "idx_user_isActive" }
      ]),
      db.collection("roles").createIndexes([
        { key: { name: 1 }, unique: true, name: "uniq_role_name" },
        { key: { id: 1 }, unique: true, name: "uniq_role_id" }
      ]),
      db.collection("permissions").createIndexes([
        { key: { code: 1 }, unique: true, name: "uniq_perm_code" },
        { key: { module: 1, action: 1 }, name: "idx_perm_module_action" }
      ])
    ]);
  }

  async findUserByEmail(email: string): Promise<AuthenticatedUserRecord | null> {
    const db = await getMongoDb();
    const doc = await db.collection("users").findOne({ email: email.trim().toLowerCase() });
    if (!doc) return null;

    const roleDoc = await db.collection("roles").findOne({ id: doc.roleId });
    if (!roleDoc) return null;

    const userParsed = UserEntitySchema.safeParse({
      id: doc.id,
      email: doc.email,
      name: doc.name,
      passwordHash: doc.passwordHash,
      isActive: doc.isActive,
      mustChangePassword: doc.mustChangePassword,
      tokenVersion: doc.tokenVersion ?? 0,
      roleId: doc.roleId,
      websiteIds: doc.websiteIds ?? [],
      lastLoginAt: doc.lastLoginAt ? new Date(doc.lastLoginAt) : null,
      passwordChangedAt: doc.passwordChangedAt ? new Date(doc.passwordChangedAt) : null,
      createdAt: new Date(doc.createdAt),
      updatedAt: new Date(doc.updatedAt)
    });

    const roleParsed = RoleEntitySchema.safeParse({
      id: roleDoc.id,
      name: roleDoc.name,
      description: roleDoc.description ?? null,
      isSystem: roleDoc.isSystem ?? false,
      permissionCodes: roleDoc.permissionCodes ?? [],
      version: roleDoc.version ?? 1,
      createdAt: new Date(roleDoc.createdAt),
      updatedAt: new Date(roleDoc.updatedAt)
    });

    if (!userParsed.success || !roleParsed.success) {
      return null;
    }

    return {
      user: userParsed.data,
      role: roleParsed.data,
      permissions: roleParsed.data.permissionCodes
    };
  }

  async findUserById(id: string): Promise<AuthenticatedUserRecord | null> {
    const db = await getMongoDb();
    const doc = await db.collection("users").findOne({ id });
    if (!doc) return null;

    const roleDoc = await db.collection("roles").findOne({ id: doc.roleId });
    if (!roleDoc) return null;

    const userParsed = UserEntitySchema.safeParse({
      id: doc.id,
      email: doc.email,
      name: doc.name,
      passwordHash: doc.passwordHash,
      isActive: doc.isActive,
      mustChangePassword: doc.mustChangePassword,
      tokenVersion: doc.tokenVersion ?? 0,
      roleId: doc.roleId,
      websiteIds: doc.websiteIds ?? [],
      lastLoginAt: doc.lastLoginAt ? new Date(doc.lastLoginAt) : null,
      passwordChangedAt: doc.passwordChangedAt ? new Date(doc.passwordChangedAt) : null,
      createdAt: new Date(doc.createdAt),
      updatedAt: new Date(doc.updatedAt)
    });

    const roleParsed = RoleEntitySchema.safeParse({
      id: roleDoc.id,
      name: roleDoc.name,
      description: roleDoc.description ?? null,
      isSystem: roleDoc.isSystem ?? false,
      permissionCodes: roleDoc.permissionCodes ?? [],
      version: roleDoc.version ?? 1,
      createdAt: new Date(roleDoc.createdAt),
      updatedAt: new Date(roleDoc.updatedAt)
    });

    if (!userParsed.success || !roleParsed.success) {
      return null;
    }

    return {
      user: userParsed.data,
      role: roleParsed.data,
      permissions: roleParsed.data.permissionCodes
    };
  }

  async createUser(input: CreateUserInput): Promise<UserEntity> {
    const db = await getMongoDb();
    const id = crypto.randomUUID();
    const now = new Date();

    const doc = {
      id,
      email: input.email.trim().toLowerCase(),
      name: input.name,
      passwordHash: input.passwordHash,
      isActive: input.isActive ?? true,
      mustChangePassword: input.mustChangePassword ?? false,
      tokenVersion: 0,
      roleId: input.roleId,
      websiteIds: input.websiteIds ?? [],
      lastLoginAt: null,
      passwordChangedAt: null,
      createdAt: now,
      updatedAt: now
    };

    await db.collection("users").insertOne(doc);

    return {
      ...doc
    };
  }

  async updatePassword(id: string, newPasswordHash: string, nextTokenVersion: number): Promise<void> {
    const db = await getMongoDb();
    const now = new Date();
    await db.collection("users").updateOne(
      { id },
      {
        $set: {
          passwordHash: newPasswordHash,
          tokenVersion: nextTokenVersion,
          mustChangePassword: false,
          passwordChangedAt: now,
          updatedAt: now
        }
      }
    );
  }

  async updateLastLogin(id: string, date: Date): Promise<void> {
    const db = await getMongoDb();
    await db.collection("users").updateOne(
      { id },
      {
        $set: {
          lastLoginAt: date,
          updatedAt: new Date()
        }
      }
    );
  }

  async getRoleById(roleId: string): Promise<RoleWithPermissions | null> {
    const db = await getMongoDb();
    const roleDoc = await db.collection("roles").findOne({ id: roleId });
    if (!roleDoc) return null;

    const parsed = RoleEntitySchema.safeParse({
      id: roleDoc.id,
      name: roleDoc.name,
      description: roleDoc.description ?? null,
      isSystem: roleDoc.isSystem ?? false,
      permissionCodes: roleDoc.permissionCodes ?? [],
      version: roleDoc.version ?? 1,
      createdAt: new Date(roleDoc.createdAt),
      updatedAt: new Date(roleDoc.updatedAt)
    });

    if (!parsed.success) return null;
    return {
      role: parsed.data,
      permissions: parsed.data.permissionCodes
    };
  }

  async getRoleByName(name: string): Promise<RoleWithPermissions | null> {
    const db = await getMongoDb();
    const roleDoc = await db.collection("roles").findOne({ name });
    if (!roleDoc) return null;

    const parsed = RoleEntitySchema.safeParse({
      id: roleDoc.id,
      name: roleDoc.name,
      description: roleDoc.description ?? null,
      isSystem: roleDoc.isSystem ?? false,
      permissionCodes: roleDoc.permissionCodes ?? [],
      version: roleDoc.version ?? 1,
      createdAt: new Date(roleDoc.createdAt),
      updatedAt: new Date(roleDoc.updatedAt)
    });

    if (!parsed.success) return null;
    return {
      role: parsed.data,
      permissions: parsed.data.permissionCodes
    };
  }

  async countUsers(): Promise<number> {
    const db = await getMongoDb();
    return db.collection("users").countDocuments();
  }

  async updateUser(id: string, updates: UpdateUserInput): Promise<UserEntity | null> {
    const db = await getMongoDb();
    const now = new Date();
    const setFields: Record<string, unknown> = { updatedAt: now };

    if (updates.name !== undefined) setFields.name = updates.name;
    if (updates.isActive !== undefined) setFields.isActive = updates.isActive;
    if (updates.mustChangePassword !== undefined) setFields.mustChangePassword = updates.mustChangePassword;
    if (updates.roleId !== undefined) setFields.roleId = updates.roleId;
    if (updates.websiteIds !== undefined) setFields.websiteIds = updates.websiteIds;

    await db.collection("users").updateOne({ id }, { $set: setFields });
    const userRec = await this.findUserById(id);
    return userRec ? userRec.user : null;
  }

  async upsertPermission(input: CreatePermissionInput): Promise<PermissionEntity> {
    const db = await getMongoDb();
    const now = new Date();
    const existing = await db.collection("permissions").findOne({ code: input.code });

    if (existing) {
      const updated = {
        module: input.module,
        action: input.action,
        description: input.description ?? existing.description ?? null,
        updatedAt: now
      };
      await db.collection("permissions").updateOne({ code: input.code }, { $set: updated });
      return PermissionEntitySchema.parse({
        id: existing.id,
        code: input.code,
        module: input.module,
        action: input.action,
        description: updated.description,
        createdAt: new Date(existing.createdAt),
        updatedAt: now
      });
    }

    const id = crypto.randomUUID();
    const doc = {
      id,
      code: input.code,
      module: input.module,
      action: input.action,
      description: input.description ?? null,
      createdAt: now,
      updatedAt: now
    };
    await db.collection("permissions").insertOne(doc);
    return PermissionEntitySchema.parse(doc);
  }

  async upsertRole(input: CreateRoleInput): Promise<RoleWithPermissions> {
    const db = await getMongoDb();
    const now = new Date();
    const existing = await db.collection("roles").findOne({ name: input.name });

    if (existing) {
      await db.collection("roles").updateOne(
        { name: input.name },
        {
          $set: {
            description: input.description ?? existing.description ?? null,
            permissionCodes: input.permissionCodes,
            isSystem: input.isSystem ?? existing.isSystem ?? false,
            updatedAt: now
          }
        }
      );
      const res = await this.getRoleByName(input.name);
      if (!res) throw new Error(`Failed to load updated role ${input.name}`);
      return res;
    }

    const id = crypto.randomUUID();
    const doc = {
      id,
      name: input.name,
      description: input.description ?? null,
      isSystem: input.isSystem ?? false,
      permissionCodes: input.permissionCodes,
      version: 1,
      createdAt: now,
      updatedAt: now
    };
    await db.collection("roles").insertOne(doc);
    const res = await this.getRoleByName(input.name);
    if (!res) throw new Error(`Failed to create role ${input.name}`);
    return res;
  }

  async verifyTenantAccess(userId: string, websiteId: string): Promise<boolean> {
    const userRec = await this.findUserById(userId);
    if (!userRec || !userRec.user.isActive) return false;
    if (userRec.role.name === "SUPER_ADMIN") return true;

    // Check direct ownership array on user document
    if (userRec.user.websiteIds.includes(websiteId)) {
      return true;
    }

    // Check MongoDB websites collection if migrated
    const db = await getMongoDb();
    const ws = await db.collection("websites").findOne({ id: websiteId, userId });
    return !!ws;
  }
}
