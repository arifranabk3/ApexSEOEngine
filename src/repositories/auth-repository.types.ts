import { z } from "zod";

export const UserEntitySchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  passwordHash: z.string(),
  isActive: z.boolean(),
  mustChangePassword: z.boolean(),
  tokenVersion: z.number().int(),
  roleId: z.string(),
  websiteIds: z.array(z.string()).default([]),
  lastLoginAt: z.date().nullable().optional(),
  passwordChangedAt: z.date().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});
export type UserEntity = z.infer<typeof UserEntitySchema>;

export const RoleEntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  isSystem: z.boolean(),
  permissionCodes: z.array(z.string()).default([]),
  version: z.number().int().default(1),
  createdAt: z.date(),
  updatedAt: z.date()
});
export type RoleEntity = z.infer<typeof RoleEntitySchema>;

export const PermissionEntitySchema = z.object({
  id: z.string(),
  code: z.string(),
  module: z.string(),
  action: z.string(),
  description: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});
export type PermissionEntity = z.infer<typeof PermissionEntitySchema>;

export interface RoleWithPermissions {
  role: RoleEntity;
  permissions: string[];
}

export interface AuthenticatedUserRecord {
  user: UserEntity;
  role: RoleEntity;
  permissions: string[];
}

export interface CreateUserInput {
  email: string;
  name: string;
  passwordHash: string;
  roleId: string;
  isActive?: boolean;
  mustChangePassword?: boolean;
  websiteIds?: string[];
}

export interface CreatePermissionInput {
  code: string;
  module: string;
  action: string;
  description?: string;
}

export interface CreateRoleInput {
  name: string;
  description?: string;
  isSystem?: boolean;
  permissionCodes: string[];
}

export interface UpdateUserInput {
  name?: string;
  isActive?: boolean;
  mustChangePassword?: boolean;
  roleId?: string;
  websiteIds?: string[];
}

export interface IAuthRepository {
  findUserByEmail(email: string): Promise<AuthenticatedUserRecord | null>;
  findUserById(id: string): Promise<AuthenticatedUserRecord | null>;
  createUser(input: CreateUserInput): Promise<UserEntity>;
  updateUser?(id: string, updates: UpdateUserInput): Promise<UserEntity | null>;
  countUsers?(): Promise<number>;
  updatePassword(id: string, newPasswordHash: string, nextTokenVersion: number): Promise<void>;
  updateLastLogin(id: string, date: Date): Promise<void>;
  getRoleById(roleId: string): Promise<RoleWithPermissions | null>;
  getRoleByName(name: string): Promise<RoleWithPermissions | null>;
  upsertRole?(input: CreateRoleInput): Promise<RoleWithPermissions>;
  upsertPermission?(input: CreatePermissionInput): Promise<PermissionEntity>;
  verifyTenantAccess(userId: string, websiteId: string): Promise<boolean>;
  ensureIndexes?(): Promise<void>;
}
