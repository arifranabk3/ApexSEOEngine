import { z } from "zod";

// ============================================================================
// 1. CLAIM CATEGORY & RISK TAXONOMY
// ============================================================================

export const ClaimCategorySchema = z.enum([
  "STATISTICAL_NUMERICAL",
  "FINANCIAL",
  "HEALTH_SAFETY",
  "LEGAL_REGULATORY",
  "SCIENTIFIC_TECHNICAL",
  "DATES_HISTORICAL",
  "ORGANIZATION_PERSON",
  "GENERAL_FACTUAL"
]);
export type ClaimCategory = z.infer<typeof ClaimCategorySchema>;

export const RiskLevelSchema = z.enum([
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL"
]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const VerificationStatusSchema = z.enum([
  "VERIFIED",
  "UNVERIFIED",
  "UNVERIFIABLE"
]);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

export const ReviewerDecisionSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "CORRECTED",
  "REMOVED"
]);
export type ReviewerDecision = z.infer<typeof ReviewerDecisionSchema>;

// ============================================================================
// 2. EXTRACTED & REVIEWED CLAIM SCHEMAS
// ============================================================================

export const SourceEvaluationSchema = z.object({
  url: z.string().optional(),
  title: z.string().optional(),
  authorOrOrg: z.string().optional(),
  publicationDate: z.string().optional(),
  isPrimarySource: z.boolean().default(false),
  authorityAssessment: z.string(),
  relevanceAssessment: z.string(),
  supportsClaim: z.boolean().default(false),
  contradictsClaim: z.boolean().default(false),
  isOutdated: z.boolean().default(false),
  isAccessible: z.boolean().default(false),
  excerptOrEvidence: z.string().optional()
});
export type SourceEvaluation = z.infer<typeof SourceEvaluationSchema>;

export const FactualClaimItemSchema = z.object({
  id: z.string(),
  claimText: z.string().min(5),
  sectionLocation: z.string().default("Body"),
  category: ClaimCategorySchema,
  riskLevel: RiskLevelSchema,
  hasCitation: z.boolean().default(false),
  suppliedSources: z.array(z.string()).default([]),
  evaluatedSources: z.array(SourceEvaluationSchema).default([]),
  verificationStatus: VerificationStatusSchema.default("UNVERIFIED"),
  requiresHumanReview: z.boolean().default(false),
  explanation: z.string(),
  recommendedAction: z.string(),
  // Human Editorial Decision tracking
  reviewerDecision: ReviewerDecisionSchema.default("PENDING"),
  reviewerNotes: z.string().optional(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().optional()
});
export type FactualClaimItem = z.infer<typeof FactualClaimItemSchema>;

export const FactualReviewSummarySchema = z.object({
  totalClaims: z.number().int().min(0),
  verifiedCount: z.number().int().min(0),
  unverifiedCount: z.number().int().min(0),
  unverifiableCount: z.number().int().min(0),
  criticalRiskCount: z.number().int().min(0),
  highRiskCount: z.number().int().min(0),
  mediumRiskCount: z.number().int().min(0),
  lowRiskCount: z.number().int().min(0),
  pendingHumanReviewCount: z.number().int().min(0),
  readyForPublishing: z.boolean(),
  editorialSummary: z.string(),
  mandatoryDisclaimer: z.string()
});
export type FactualReviewSummary = z.infer<typeof FactualReviewSummarySchema>;

export const FactualReviewReportSchema = z.object({
  articleId: z.string().optional(),
  articleTitle: z.string(),
  evaluatedAt: z.string(),
  summary: FactualReviewSummarySchema,
  claims: z.array(FactualClaimItemSchema)
});
export type FactualReviewReport = z.infer<typeof FactualReviewReportSchema>;

// Input payload for review
export const FactualReviewInputSchema = z.object({
  articleId: z.string().optional(),
  title: z.string().min(1),
  content: z.string().min(1),
  knownSources: z.array(z.string()).optional().default([]),
  unverifiedClaims: z.array(z.string()).optional().default([])
});
export type FactualReviewInput = z.input<typeof FactualReviewInputSchema>;
