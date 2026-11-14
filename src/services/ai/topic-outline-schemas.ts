import { z } from "zod";

// ============================================================================
// 1. INPUT SCHEMAS
// ============================================================================

export const SearchIntentEnum = z.enum([
  "INFORMATIONAL",
  "COMMERCIAL",
  "TRANSACTIONAL",
  "NAVIGATIONAL"
]);
export type SearchIntentType = z.infer<typeof SearchIntentEnum>;

export const ArticleTypeEnum = z.enum([
  "HOW_TO_GUIDE",
  "PILLAR_POST",
  "COMPARISON_REVIEW",
  "BEGINNERS_GUIDE",
  "CHECKLIST_CHEAT_SHEET",
  "CASE_STUDY",
  "TROUBLESHOOTING_GUIDE"
]);
export type ArticleType = z.infer<typeof ArticleTypeEnum>;

export const TopicAnalysisInputSchema = z.object({
  websiteId: z.string().min(1, "Website is required"),
  mainTopic: z.string().min(3, "Main topic must be at least 3 characters"),
  focusKeyword: z.string().min(2, "Focus keyword must be at least 2 characters"),
  secondaryKeywords: z.array(z.string()),
  targetCountry: z.string(),
  targetLanguage: z.string(),
  targetAudience: z.string(),
  searchIntent: SearchIntentEnum,
  articleType: ArticleTypeEnum,
  existingClusterId: z.string().optional(),
  referenceUrls: z.array(z.string().url())
});
export type TopicAnalysisInput = z.infer<typeof TopicAnalysisInputSchema>;

// Helper function to create validated input with defaults
export function createTopicAnalysisInput(
  raw: Partial<TopicAnalysisInput> & {
    websiteId: string;
    mainTopic: string;
    focusKeyword: string;
  }
): TopicAnalysisInput {
  return {
    websiteId: raw.websiteId,
    mainTopic: raw.mainTopic,
    focusKeyword: raw.focusKeyword,
    secondaryKeywords: raw.secondaryKeywords ?? [],
    targetCountry: raw.targetCountry ?? "US",
    targetLanguage: raw.targetLanguage ?? "en",
    targetAudience: raw.targetAudience ?? "General practitioners & professionals",
    searchIntent: raw.searchIntent ?? "INFORMATIONAL",
    articleType: raw.articleType ?? "PILLAR_POST",
    existingClusterId: raw.existingClusterId,
    referenceUrls: raw.referenceUrls ?? []
  };
}

// ============================================================================
// 2. AI STRUCTURED SCHEMAS (Validated with Zod)
// ============================================================================

export const TopicAnalysisOutputSchema = z.object({
  mainTopic: z.string(),
  primaryKeyword: z.string(),
  secondaryKeywords: z.array(z.string()).min(2),
  supportingSubtopics: z.array(z.string()).min(3),
  searchIntent: SearchIntentEnum,
  userProblems: z.array(z.string()).min(2),
  relatedQuestions: z.array(z.string()).min(3),
  relevantEntities: z.array(z.string()).min(3),
  contentGaps: z.array(z.string()).min(2),
  suggestedArticleAngle: z.string(),
  practicalUserOutcomes: z.array(z.string()).min(2)
});
export type TopicAnalysisOutput = z.infer<typeof TopicAnalysisOutputSchema>;

export const SupportingArticleSchema = z.object({
  title: z.string(),
  targetKeyword: z.string(),
  intent: SearchIntentEnum,
  relationshipToPillar: z.string(),
  plannedSlug: z.string()
});
export type SupportingArticle = z.infer<typeof SupportingArticleSchema>;

export const TopicClusterOutputSchema = z.object({
  clusterName: z.string(),
  pillarTopic: z.string(),
  pillarKeyword: z.string(),
  intent: SearchIntentEnum,
  supportingArticles: z.array(SupportingArticleSchema).min(3),
  internalLinkingStrategy: z.string(),
  keywordOverlapNotes: z.string(),
  duplicateTopicRisks: z.array(z.string())
});
export type TopicClusterOutput = z.infer<typeof TopicClusterOutputSchema>;

export const OutlineSectionSchema = z.object({
  heading: z.string().min(2),
  level: z.enum(["h2", "h3"]),
  objective: z.string().min(5),
  questionsAnswered: z.array(z.string()).min(1),
  suggestedExamples: z.array(z.string()),
  suggestedTableOrComparison: z.string().optional(),
  suggestedDiagramOrVisual: z.string().optional(),
  internalLinkAnchorRecommendations: z.array(z.string()),
  subsections: z.array(
    z.object({
      heading: z.string().min(2),
      objective: z.string(),
      questionsAnswered: z.array(z.string())
    })
  )
});
export type OutlineSection = z.infer<typeof OutlineSectionSchema>;

export const ArticleOutlineOutputSchema = z.object({
  seoTitle: z.string().min(10).max(80),
  metaDescription: z.string().min(40).max(170),
  urlSlug: z.string().min(3),
  h1: z.string().min(5),
  sections: z.array(OutlineSectionSchema).min(3),
  conclusionObjective: z.string().min(10),
  practicalTakeaways: z.array(z.string()).min(2),
  faqs: z.array(
    z.object({
      question: z.string(),
      answerBrief: z.string()
    })
  ).min(2),
  imageSuggestions: z.array(
    z.object({
      context: z.string(),
      suggestedAltText: z.string()
    })
  ),
  externalReferenceOpportunities: z.array(z.string())
});
export type ArticleOutlineOutput = z.infer<typeof ArticleOutlineOutputSchema>;

// ============================================================================
// 3. QUALITY GATE & AUDIT VALIDATION
// ============================================================================

export type QualityGateVerdict = "PASS" | "WARNING" | "BLOCKED";

export interface OutlineValidationIssue {
  type: QualityGateVerdict;
  code: string;
  message: string;
  sectionIndex?: number;
}

export interface OutlineValidationReport {
  verdict: QualityGateVerdict;
  canProceedToGeneration: boolean;
  score: number; // 0 - 100 quality heuristic
  issues: OutlineValidationIssue[];
  metrics: {
    totalSections: number;
    h2Count: number;
    h3Count: number;
    faqCount: number;
    estimatedWordCount: number;
  };
  disclaimer: string;
}
