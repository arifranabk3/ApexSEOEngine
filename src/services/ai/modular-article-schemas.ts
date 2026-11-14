import { z } from "zod";

// ============================================================================
// 1. SECTION GENERATION SCHEMAS
// ============================================================================

export const GeneratedSectionOutputSchema = z.object({
  heading: z.string(),
  level: z.enum(["h2", "h3"]),
  markdownContent: z.string().min(50),
  keyTakeaways: z.array(z.string()),
  unverifiedClaims: z.array(z.string()),
  citedEntitiesOrSources: z.array(z.string()),
  wordCount: z.number().positive()
});
export type GeneratedSectionOutput = z.infer<typeof GeneratedSectionOutputSchema>;

export function createGeneratedSection(raw: {
  heading: string;
  level: "h2" | "h3";
  markdownContent: string;
  keyTakeaways?: string[];
  unverifiedClaims?: string[];
  citedEntitiesOrSources?: string[];
  wordCount?: number;
}): GeneratedSectionOutput {
  const words = raw.wordCount ?? raw.markdownContent.trim().split(/\s+/).filter(Boolean).length;
  return {
    heading: raw.heading,
    level: raw.level,
    markdownContent: raw.markdownContent,
    keyTakeaways: raw.keyTakeaways ?? [],
    unverifiedClaims: raw.unverifiedClaims ?? [],
    citedEntitiesOrSources: raw.citedEntitiesOrSources ?? [],
    wordCount: Math.max(1, words)
  };
}

export const SectionGenerationContextSchema = z.object({
  articleTitle: z.string(),
  focusKeyword: z.string(),
  targetAudience: z.string(),
  articleType: z.string(),
  currentSectionIndex: z.number(),
  totalSections: z.number(),
  previousSectionsSummary: z.string(),
  terminologyGuide: z.record(z.string())
});
export type SectionGenerationContext = z.infer<typeof SectionGenerationContextSchema>;

// ============================================================================
// 2. ARTICLE METADATA & ASSEMBLY SCHEMAS
// ============================================================================

export const ArticleMetadataOutputSchema = z.object({
  seoTitle: z.string().min(10).max(80),
  metaDescription: z.string().min(40).max(170),
  slug: z.string().min(3),
  excerpt: z.string().min(20).max(300),
  canonicalUrl: z.string().url().optional()
});
export type ArticleMetadataOutput = z.infer<typeof ArticleMetadataOutputSchema>;

export const AssembledArticleResultSchema = z.object({
  title: z.string(),
  slug: z.string(),
  metaTitle: z.string(),
  metaDescription: z.string(),
  excerpt: z.string(),
  markdownContent: z.string(),
  htmlContent: z.string(),
  wordCount: z.number(),
  sections: z.array(GeneratedSectionOutputSchema),
  allUnverifiedClaims: z.array(z.string()),
  allCitedSources: z.array(z.string()),
  complianceSummary: z.object({
    canPublishDirectly: z.boolean(),
    overallGateStatus: z.enum(["PASS", "WARNING", "BLOCKED"]),
    blockingIssuesCount: z.number(),
    warningsCount: z.number()
  })
});
export type AssembledArticleResult = z.infer<typeof AssembledArticleResultSchema>;

// ============================================================================
// 3. GENERATION RECOVERY & PROGRESS STATE (Stored in Brief/Article JSON)
// ============================================================================

export interface GenerationProgressState {
  articleId: string;
  briefId: string;
  totalSections: number;
  completedSections: Record<number, GeneratedSectionOutput>;
  status: "INITIALIZING" | "IN_PROGRESS" | "COMPLETED" | "INTERRUPTED" | "FAILED";
  lastCompletedIndex: number;
  lastError?: string;
  updatedAt: string;
}
