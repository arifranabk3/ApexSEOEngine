import { z } from "zod";

export const ContentBriefStatusSchema = z.enum([
  "DRAFT",
  "REVIEW",
  "APPROVED",
  "IN_PROGRESS",
  "PUBLISHED",
  "ARCHIVED"
]);
export type ContentBriefStatus = z.infer<typeof ContentBriefStatusSchema>;

export const ContentBriefEntitySchema = z.object({
  id: z.string(),
  websiteId: z.string(),
  keywordId: z.string().nullable().optional(),
  clusterId: z.string().nullable().optional(),
  title: z.string().min(1),
  targetWordCount: z.number().int().default(1500),
  searchIntent: z.string().default("INFORMATIONAL"),
  outline: z.unknown().default([]),
  secondaryKeywords: z.unknown().default([]),
  competitorNotes: z.string().nullable().optional(),
  status: z.string().default("DRAFT"),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});
export type ContentBriefEntity = z.infer<typeof ContentBriefEntitySchema>;

export interface CreateContentBriefInput {
  id?: string;
  websiteId: string;
  keywordId?: string | null;
  clusterId?: string | null;
  title: string;
  targetWordCount?: number;
  searchIntent?: string;
  outline?: unknown;
  secondaryKeywords?: unknown;
  competitorNotes?: string | null;
  status?: string;
}

export interface UpdateContentBriefInput {
  keywordId?: string | null;
  clusterId?: string | null;
  title?: string;
  targetWordCount?: number;
  searchIntent?: string;
  outline?: unknown;
  secondaryKeywords?: unknown;
  competitorNotes?: string | null;
  status?: string;
}

export interface IContentBriefRepository {
  initIndexes(): Promise<void>;
  findById(id: string): Promise<ContentBriefEntity | null>;
  findByWebsite(
    websiteId: string,
    filter?: { status?: string; limit?: number; offset?: number }
  ): Promise<ContentBriefEntity[]>;
  createBrief(input: CreateContentBriefInput): Promise<ContentBriefEntity>;
  updateBrief(id: string, updates: UpdateContentBriefInput): Promise<ContentBriefEntity | null>;
  upsertBrief(input: CreateContentBriefInput): Promise<ContentBriefEntity>;
  deleteBrief(id: string): Promise<boolean>;
  countBriefs(filter?: { websiteId?: string; status?: string }): Promise<number>;
}
