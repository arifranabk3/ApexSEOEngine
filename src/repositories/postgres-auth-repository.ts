import { getDb } from "@/lib/db";
import {
  IAuthRepository,
  AuthenticatedUserRecord,
  UserEntity,
  RoleWithPermissions,
  CreateUserInput
} from "./auth-repository.types";
import crypto from "crypto";

export class PostgresAuthRepository implements IAuthRepository {
  async findUserByEmail(email: string): Promise<AuthenticatedUserRecord | null> {
    const db = await getDb();
    const user = await db.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: {
        role: {
          include: {
            permissions: true
          }
        },
        websites: {
          select: { id: true }
        }
      }
    });

    if (!user) return null;

    const roleEntity = {
      id: user.role.id,
      name: user.role.name,
      description: user.role.description,
      isSystem: user.role.isSystem,
      permissionCodes: user.role.permissions.map((p) => p.code),
      version: 1,
      createdAt: user.role.createdAt,
      updatedAt: user.role.updatedAt
    };

    const userEntity: UserEntity = {
      id: user.id,
      email: user.email,
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
    };

    return {
      user: userEntity,
      role: roleEntity,
      permissions: roleEntity.permissionCodes
    };
  }

  async findUserById(id: string): Promise<AuthenticatedUserRecord | null> {
    const db = await getDb();
    const user = await db.user.findUnique({
      where: { id },
      include: {
        role: {
          include: {
            permissions: true
          }
        },
        websites: {
          select: { id: true }
        }
      }
    });

    if (!user) return null;

    const roleEntity = {
      id: user.role.id,
      name: user.role.name,
      description: user.role.description,
      isSystem: user.role.isSystem,
      permissionCodes: user.role.permissions.map((p) => p.code),
      version: 1,
      createdAt: user.role.createdAt,
      updatedAt: user.role.updatedAt
    };

    const userEntity: UserEntity = {
      id: user.id,
      email: user.email,
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
    };

    return {
      user: userEntity,
      role: roleEntity,
      permissions: roleEntity.permissionCodes
    };
  }

  async createUser(input: CreateUserInput): Promise<UserEntity> {
    const db = await getDb();
    const id = crypto.randomUUID();
    const created = await db.user.create({
      data: {
        id,
        email: input.email.trim().toLowerCase(),
        name: input.name,
        passwordHash: input.passwordHash,
        roleId: input.roleId,
        isActive: input.isActive ?? true,
        mustChangePassword: input.mustChangePassword ?? false
      }
    });

    return {
      id: created.id,
      email: created.email,
      name: created.name,
      passwordHash: created.passwordHash,
      isActive: created.isActive,
      mustChangePassword: created.mustChangePassword,
      tokenVersion: created.tokenVersion ?? 0,
      roleId: created.roleId,
      websiteIds: input.websiteIds ?? [],
      lastLoginAt: created.lastLoginAt,
      passwordChangedAt: created.passwordChangedAt,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt
    };
  }

  async updatePassword(id: string, newPasswordHash: string, nextTokenVersion: number): Promise<void> {
    const db = await getDb();
    await db.user.update({
      where: { id },
      data: {
        passwordHash: newPasswordHash,
        tokenVersion: nextTokenVersion,
        mustChangePassword: false,
        passwordChangedAt: new Date()
      }
    });
  }

  async updateLastLogin(id: string, date: Date): Promise<void> {
    const db = await getDb();
    await db.user.update({
      where: { id },
      data: { lastLoginAt: date }
    });
  }

  async getRoleById(roleId: string): Promise<RoleWithPermissions | null> {
    const db = await getDb();
    const role = await db.role.findUnique({
      where: { id: roleId },
      include: { permissions: true }
    });
    if (!role) return null;

    return {
      role: {
        id: role.id,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        permissionCodes: role.permissions.map((p) => p.code),
        version: 1,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt
      },
      permissions: role.permissions.map((p) => p.code)
    };
  }

  async getRoleByName(name: string): Promise<RoleWithPermissions | null> {
    const db = await getDb();
    const role = await db.role.findUnique({
      where: { name },
      include: { permissions: true }
    });
    if (!role) return null;

    return {
      role: {
        id: role.id,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        permissionCodes: role.permissions.map((p) => p.code),
        version: 1,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt
      },
      permissions: role.permissions.map((p) => p.code)
    };
  }

  async verifyTenantAccess(userId: string, websiteId: string): Promise<boolean> {
    const userRec = await this.findUserById(userId);
    if (!userRec || !userRec.user.isActive) return false;
    if (userRec.role.name === "SUPER_ADMIN") return true;

    const db = await getDb();
    const website = await db.website.findFirst({
      where: {
        id: websiteId,
        ownerId: userId
      }
    });
    return !!website;
  }
}
