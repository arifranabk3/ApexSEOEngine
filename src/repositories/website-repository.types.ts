import { z } from "zod";

// ============================================================================
// 1. ZOD DOMAIN SCHEMAS
// ============================================================================

export const WebsiteCmsTypeSchema = z.enum([
  "WORDPRESS",
  "CUSTOM_REST",
  "GHOST",
  "WEBFLOW",
  "HEADLESS"
]);
export type WebsiteCmsType = z.infer<typeof WebsiteCmsTypeSchema>;

export const WebsiteStatusSchema = z.enum(["ACTIVE", "PAUSED", "MAINTENANCE"]);
export type WebsiteStatus = z.infer<typeof WebsiteStatusSchema>;

export const WebsiteEntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().url(),
  cmsType: WebsiteCmsTypeSchema.default("WORDPRESS"),
  status: WebsiteStatusSchema.default("ACTIVE"),
  ownerId: z.string(),
  encryptedCredentials: z.string().nullable().optional(),
  publishingConfig: z.record(z.unknown()).default({}),
  seoConfig: z.record(z.unknown()).default({}),
  createdAt: z.date(),
  updatedAt: z.date()
});
export type WebsiteEntity = z.infer<typeof WebsiteEntitySchema>;

export const WebsiteIntegrationTypeSchema = z.enum([
  "WORDPRESS",
  "GSC",
  "GA4",
  "N8N",
  "CUSTOM_CMS"
]);
export type WebsiteIntegrationType = z.infer<typeof WebsiteIntegrationTypeSchema>;

export const WebsiteIntegrationStatusSchema = z.enum([
  "CONFIGURED",
  "CONNECTED",
  "DISCONNECTED"
]);
export type WebsiteIntegrationStatus = z.infer<typeof WebsiteIntegrationStatusSchema>;

export const WebsiteIntegrationEntitySchema = z.object({
  id: z.string(),
  websiteId: z.string(),
  integrationType: WebsiteIntegrationTypeSchema,
  name: z.string(),
  endpointUrl: z.string().nullable().optional(),
  encryptedCredentials: z.string().nullable().optional(),
  status: WebsiteIntegrationStatusSchema.default("CONFIGURED"),
  lastSyncedAt: z.date().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});
export type WebsiteIntegrationEntity = z.infer<typeof WebsiteIntegrationEntitySchema>;

// ============================================================================
// 2. INPUT / DTO TYPES
// ============================================================================

export interface CreateWebsiteInput {
  name: string;
  url: string;
  ownerId: string;
  cmsType?: WebsiteCmsType;
  status?: WebsiteStatus;
  encryptedCredentials?: string | null;
  publishingConfig?: Record<string, unknown>;
  seoConfig?: Record<string, unknown>;
}

export interface UpdateWebsiteInput {
  name?: string;
  url?: string;
  cmsType?: WebsiteCmsType;
  status?: WebsiteStatus;
  encryptedCredentials?: string | null;
  publishingConfig?: Record<string, unknown>;
  seoConfig?: Record<string, unknown>;
}

export interface UpsertIntegrationInput {
  websiteId: string;
  integrationType: WebsiteIntegrationType;
  name: string;
  endpointUrl?: string | null;
  encryptedCredentials?: string | null;
  status?: WebsiteIntegrationStatus;
}

export interface WebsiteCounts {
  articles: number;
  keywords: number;
  categories: number;
  integrations: number;
}

export interface WebsiteWithCounts extends WebsiteEntity {
  counts: WebsiteCounts;
}

export interface IntegrationWithWebsite extends WebsiteIntegrationEntity {
  website: {
    id: string;
    name: string;
    url: string;
  } | null;
}

// ============================================================================
// 3. REPOSITORY INTERFACE CONTRACT
// ============================================================================

export interface IWebsiteRepository {
  ensureIndexes(): Promise<void>;
  findWebsiteById(id: string): Promise<WebsiteEntity | null>;
  findWebsiteByUrl(url: string): Promise<WebsiteEntity | null>;
  listWebsites(ownerId?: string): Promise<WebsiteWithCounts[]>;
  countWebsites(ownerId?: string): Promise<number>;
  createWebsite(input: CreateWebsiteInput): Promise<WebsiteEntity>;
  updateWebsite(id: string, input: UpdateWebsiteInput): Promise<WebsiteEntity | null>;
  deleteWebsite(id: string): Promise<boolean>;

  // Integrations
  findIntegrationById(id: string): Promise<WebsiteIntegrationEntity | null>;
  findIntegration(websiteId: string, type: WebsiteIntegrationType): Promise<WebsiteIntegrationEntity | null>;
  listIntegrations(websiteId?: string): Promise<IntegrationWithWebsite[]>;
  upsertIntegration(input: UpsertIntegrationInput): Promise<WebsiteIntegrationEntity>;
  deleteIntegration(id: string): Promise<boolean>;
}
