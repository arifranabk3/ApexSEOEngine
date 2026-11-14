import { z } from "zod";

/**
 * ---------------------------------------------------------------------------
 * Phase I — Domain Enums and Primitives
 * ---------------------------------------------------------------------------
 */
export const SettingTypeSchema = z.enum(["STRING", "NUMBER", "BOOLEAN", "JSON"]);
export type SettingType = z.infer<typeof SettingTypeSchema>;

/**
 * ---------------------------------------------------------------------------
 * SearchPerformance Types & Schemas
 * ---------------------------------------------------------------------------
 */
export const SearchPerformanceEntitySchema = z.object({
  id: z.string(),
  websiteId: z.string(),
  pageUrl: z.string().min(1),
  query: z.string().min(1),
  clicks: z.number().int().nonnegative().default(0),
  impressions: z.number().int().nonnegative().default(0),
  ctr: z.number().default(0),
  position: z.number().default(0),
  date: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SearchPerformanceEntity = z.infer<typeof SearchPerformanceEntitySchema>;

export const CreateSearchPerformanceInputSchema = z.object({
  websiteId: z.string(),
  pageUrl: z.string().min(1),
  query: z.string().min(1),
  clicks: z.number().int().nonnegative().default(0),
  impressions: z.number().int().nonnegative().default(0),
  ctr: z.number().default(0),
  position: z.number().default(0),
  date: z.date(),
});

export type CreateSearchPerformanceInput = z.infer<typeof CreateSearchPerformanceInputSchema>;

export interface SearchPerformanceFilter {
  websiteId?: string;
  pageUrl?: string;
  query?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface SearchPerformanceMetrics {
  totalClicks: number;
  totalImpressions: number;
  averageCtr: number;
  averagePosition: number;
  recordCount: number;
}

/**
 * ---------------------------------------------------------------------------
 * SystemSetting Types & Schemas
 * ---------------------------------------------------------------------------
 */
export const SystemSettingEntitySchema = z.object({
  id: z.string(),
  key: z.string().min(1),
  value: z.any(),
  type: SettingTypeSchema.default("JSON"),
  category: z.string().default("GENERAL"),
  description: z.string().nullable().optional(),
  isSecret: z.boolean().default(false),
  isEncrypted: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SystemSettingEntity = z.infer<typeof SystemSettingEntitySchema>;

export const UpsertSystemSettingInputSchema = z.object({
  key: z.string().min(1),
  value: z.any(),
  type: SettingTypeSchema.optional().default("JSON"),
  category: z.string().optional().default("GENERAL"),
  description: z.string().nullable().optional(),
  isSecret: z.boolean().optional().default(false),
  isEncrypted: z.boolean().optional().default(false),
});

export type UpsertSystemSettingInput = z.input<typeof UpsertSystemSettingInputSchema>;

/**
 * ---------------------------------------------------------------------------
 * AuditLog Types & Schemas
 * ---------------------------------------------------------------------------
 */
export const AuditLogEntitySchema = z.object({
  id: z.string(),
  userId: z.string().nullable().optional(),
  action: z.string().min(1),
  module: z.string().min(1),
  entityType: z.string().nullable().optional(),
  entityId: z.string().nullable().optional(),
  resourceId: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).default({}),
  details: z.record(z.string(), z.any()).nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  createdAt: z.date(),
});

export type AuditLogEntity = z.infer<typeof AuditLogEntitySchema>;

export const CreateAuditLogInputSchema = z.object({
  userId: z.string().nullable().optional(),
  action: z.string().min(1),
  module: z.string().min(1),
  entityType: z.string().nullable().optional(),
  entityId: z.string().nullable().optional(),
  resourceId: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional().default({}),
  details: z.record(z.string(), z.any()).nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  createdAt: z.date().optional(),
});

export type CreateAuditLogInput = z.input<typeof CreateAuditLogInputSchema>;

export interface AuditLogFilter {
  userId?: string | null;
  module?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  resourceId?: string;
  ipAddress?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * ---------------------------------------------------------------------------
 * Unified System Repository Contract
 * ---------------------------------------------------------------------------
 */
export interface ISystemRepository {
  // SearchPerformance
  recordSearchPerformance(input: CreateSearchPerformanceInput): Promise<SearchPerformanceEntity>;
  bulkUpsertSearchPerformance(records: CreateSearchPerformanceInput[]): Promise<number>;
  findSearchPerformance(filter: SearchPerformanceFilter): Promise<SearchPerformanceEntity[]>;
  countSearchPerformance(filter: SearchPerformanceFilter): Promise<number>;
  aggregateSearchMetrics(filter: SearchPerformanceFilter): Promise<SearchPerformanceMetrics>;

  // SystemSetting
  findSettingByKey(key: string): Promise<SystemSettingEntity | null>;
  findSettingsByCategory(category: string): Promise<SystemSettingEntity[]>;
  findAllSettings(): Promise<SystemSettingEntity[]>;
  upsertSetting(input: UpsertSystemSettingInput): Promise<SystemSettingEntity>;
  deleteSettingsByCategory(category: string): Promise<number>;
  deleteSettingByKey(key: string): Promise<boolean>;

  // AuditLog
  createAuditLog(input: CreateAuditLogInput): Promise<AuditLogEntity>;
  findAuditLogs(filter: AuditLogFilter): Promise<AuditLogEntity[]>;
  countAuditLogs(filter: AuditLogFilter): Promise<number>;
}
