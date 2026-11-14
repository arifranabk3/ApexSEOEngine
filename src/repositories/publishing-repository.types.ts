import { z } from "zod";

// ============================================================================
// 1. InternalLink Domain Types & Schemas
// ============================================================================

export const InternalLinkStatusSchema = z.enum([
  "SUGGESTED",
  "APPROVED",
  "INSERTED",
  "REJECTED",
  "BROKEN"
]);
export type InternalLinkStatus = z.infer<typeof InternalLinkStatusSchema>;

export const InternalLinkEntitySchema = z.object({
  id: z.string(),
  websiteId: z.string(),
  sourceArticleId: z.string(),
  targetArticleId: z.string(),
  anchorText: z.string().min(1),
  targetUrl: z.string().min(1),
  status: z.string().default("SUGGESTED"),
  relevanceScore: z.number().default(0.8),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});
export type InternalLinkEntity = z.infer<typeof InternalLinkEntitySchema>;

export interface CreateInternalLinkInput {
  id?: string;
  websiteId: string;
  sourceArticleId: string;
  targetArticleId: string;
  anchorText: string;
  targetUrl: string;
  status?: string;
  relevanceScore?: number;
}

export interface UpdateInternalLinkInput {
  anchorText?: string;
  targetUrl?: string;
  status?: string;
  relevanceScore?: number;
}

// ============================================================================
// 2. PublishingJob Domain Types & Schemas
// ============================================================================

export const PublishingJobStatusSchema = z.enum([
  "QUEUED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED"
]);
export type PublishingJobStatus = z.infer<typeof PublishingJobStatusSchema>;

export const PublishingJobEntitySchema = z.object({
  id: z.string(),
  websiteId: z.string(),
  articleId: z.string(),
  cmsType: z.string(),
  status: z.string().default("QUEUED"),
  scheduledFor: z.date().or(z.string()),
  startedAt: z.date().or(z.string()).nullable().optional(),
  completedAt: z.date().or(z.string()).nullable().optional(),
  attempts: z.number().int().default(0),
  maxAttempts: z.number().int().default(3),
  remotePostId: z.string().nullable().optional(),
  publishedUrl: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  responseLog: z.unknown().default({}),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});
export type PublishingJobEntity = z.infer<typeof PublishingJobEntitySchema>;

export interface CreatePublishingJobInput {
  id?: string;
  websiteId: string;
  articleId: string;
  cmsType: string;
  status?: string;
  scheduledFor?: Date | string;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
  attempts?: number;
  maxAttempts?: number;
  remotePostId?: string | null;
  publishedUrl?: string | null;
  errorMessage?: string | null;
  responseLog?: Record<string, unknown> | unknown;
}

export interface UpdatePublishingJobInput {
  status?: string;
  scheduledFor?: Date | string;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
  attempts?: number;
  remotePostId?: string | null;
  publishedUrl?: string | null;
  errorMessage?: string | null;
  responseLog?: Record<string, unknown> | unknown;
}

// ============================================================================
// 3. Publishing Repository Interface
// ============================================================================

export interface IPublishingRepository {
  initIndexes(): Promise<void>;

  // InternalLink Operations
  createInternalLink(input: CreateInternalLinkInput): Promise<InternalLinkEntity>;
  findInternalLinkById(id: string): Promise<InternalLinkEntity | null>;
  findInternalLinksByWebsite(
    websiteId: string,
    filter?: { status?: string; limit?: number; offset?: number }
  ): Promise<InternalLinkEntity[]>;
  findInternalLinksBySourceArticle(sourceArticleId: string): Promise<InternalLinkEntity[]>;
  findInternalLinksByTargetArticle(targetArticleId: string): Promise<InternalLinkEntity[]>;
  updateInternalLink(id: string, updates: UpdateInternalLinkInput): Promise<InternalLinkEntity | null>;
  upsertInternalLink(input: CreateInternalLinkInput): Promise<InternalLinkEntity>;
  deleteInternalLink(id: string): Promise<boolean>;
  deleteInternalLinksByArticle(articleId: string): Promise<number>;
  countInternalLinks(filter?: { websiteId?: string; status?: string }): Promise<number>;

  // PublishingJob Operations
  createPublishingJob(input: CreatePublishingJobInput): Promise<PublishingJobEntity>;
  findPublishingJobById(id: string): Promise<PublishingJobEntity | null>;
  findPublishingJobsByWebsite(
    websiteId: string,
    filter?: { status?: string; limit?: number; offset?: number }
  ): Promise<PublishingJobEntity[]>;
  findPublishingJobsByArticle(articleId: string): Promise<PublishingJobEntity[]>;
  updatePublishingJob(id: string, updates: UpdatePublishingJobInput): Promise<PublishingJobEntity | null>;
  upsertPublishingJob(input: CreatePublishingJobInput): Promise<PublishingJobEntity>;
  deletePublishingJob(id: string): Promise<boolean>;
  countPublishingJobs(filter?: { websiteId?: string; status?: string }): Promise<number>;

  // Worker Claim & State Transitions (Atomic)
  claimNextDueJob(workerId: string): Promise<PublishingJobEntity | null>;
  completeJob(
    id: string,
    result: { remotePostId?: string | null; publishedUrl?: string | null; responseLog?: unknown }
  ): Promise<PublishingJobEntity | null>;
  failJob(
    id: string,
    error: { errorMessage: string; retryInMs?: number; responseLog?: unknown }
  ): Promise<PublishingJobEntity | null>;
}
