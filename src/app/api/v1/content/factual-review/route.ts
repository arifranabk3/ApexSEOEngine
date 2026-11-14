import { NextRequest } from "next/server";
import { z } from "zod";
import { getSystemRepository } from "@/repositories/system-repository.factory";
import { ensureSystemSeeded } from "@/lib/seed-service";
import {
  apiError,
  apiSuccess,
  parseAndValidateBody,
  requireApiAuth
} from "@/lib/api-response";
import { recordAuditLog } from "@/lib/audit";
import {
  ReviewerDecisionSchema,
  ReviewerDecision
} from "@/services/seo/factual-claim-schemas";
import { reviewArticleFactualClaims } from "@/services/seo/factual-claim-reviewer";
import { getArticleRepository } from "@/repositories/article-repository.factory";
import { getWebsiteRepository } from "@/repositories/website-repository.factory";

const factualReviewApiSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("audit_article"),
    articleId: z.string().min(1),
    knownSources: z.array(z.string()).optional(),
    unverifiedClaims: z.array(z.string()).optional()
  }),
  z.object({
    action: z.literal("audit_raw_content"),
    title: z.string().min(1),
    content: z.string().min(1),
    knownSources: z.array(z.string()).optional(),
    unverifiedClaims: z.array(z.string()).optional()
  }),
  z.object({
    action: z.literal("record_reviewer_decision"),
    articleId: z.string().min(1),
    claimId: z.string().min(1),
    decision: ReviewerDecisionSchema,
    reviewerNotes: z.string().optional()
  })
]);

export async function POST(req: NextRequest) {
  await ensureSystemSeeded();
  const { user, errorResponse } = await requireApiAuth(req, "content:write");
  if (errorResponse || !user) return errorResponse!;

  const { data, errorResponse: parseError } = await parseAndValidateBody(
    req,
    factualReviewApiSchema
  );
  if (parseError || !data) return parseError!;

  try {
    if (data.action === "audit_article") {
      const articleRepo = getArticleRepository();
      const websiteRepo = getWebsiteRepository();

      const article = await articleRepo.findArticleById(data.articleId);

      if (!article) {
        return apiError("NOT_FOUND", "Article not found", 404);
      }

      const website = await websiteRepo.findWebsiteById(article.websiteId);
      if (!website) {
        return apiError("NOT_FOUND", "Website not found", 404);
      }

      // Enforce tenant isolation
      if (user.roleName !== "ADMIN" && website.ownerId !== user.id) {
        return apiError("FORBIDDEN", "You do not have access to this website's articles", 403);
      }

      const report = reviewArticleFactualClaims({
        articleId: article.id,
        title: article.title,
        content: article.content,
        knownSources: data.knownSources ?? [],
        unverifiedClaims: data.unverifiedClaims ?? []
      });

      // Retrieve existing human reviewer decisions from AuditLog for this article
      const systemRepo = getSystemRepository();
      const decisionLogs = await systemRepo.findAuditLogs({
        action: "RECORD_CLAIM_DECISION",
        module: "SEO_FACTUAL_REVIEW",
        entityType: "Article",
        entityId: article.id,
      });

      // Apply the most recent decision for each claimId
      const decisionMap = new Map<string, {
        decision: string;
        notes: string | null;
        by: string;
        at: string;
      }>();

      for (const log of decisionLogs) {
        const meta = log.metadata as Record<string, unknown> | null;
        if (meta && typeof meta.claimId === "string" && !decisionMap.has(meta.claimId)) {
          decisionMap.set(meta.claimId, {
            decision: typeof meta.decision === "string" ? meta.decision : "PENDING",
            notes: typeof meta.reviewerNotes === "string" ? meta.reviewerNotes : null,
            by: typeof meta.reviewedBy === "string" ? meta.reviewedBy : (log.userId || "editor"),
            at: typeof meta.reviewedAt === "string" ? meta.reviewedAt : log.createdAt.toISOString()
          });
        }
      }

      for (const claim of report.claims) {
        const saved = decisionMap.get(claim.id);
        if (saved) {
          claim.reviewerDecision = saved.decision as ReviewerDecision;
          claim.reviewerNotes = saved.notes || undefined;
          claim.reviewedBy = saved.by;
          claim.reviewedAt = saved.at;
        }
      }

      // Recompute pending count and readiness based on merged human decisions
      const pendingCount = report.claims.filter(
        (c) => c.requiresHumanReview && c.reviewerDecision === "PENDING"
      ).length;
      report.summary.pendingHumanReviewCount = pendingCount;
      const criticalPending = report.claims.filter(
        (c) => c.riskLevel === "CRITICAL" && c.reviewerDecision !== "ACCEPTED" && c.reviewerDecision !== "CORRECTED"
      ).length;
      report.summary.readyForPublishing = criticalPending === 0 && pendingCount === 0;

      await recordAuditLog({
        userId: user.id,
        action: "AUDIT_FACTUAL_CLAIMS",
        module: "SEO_FACTUAL_REVIEW",
        entityType: "Article",
        entityId: article.id,
        metadata: {
          totalClaims: report.summary.totalClaims,
          unverifiedCount: report.summary.unverifiedCount,
          criticalCount: report.summary.criticalRiskCount
        }
      });

      return apiSuccess({ report });
    }

    if (data.action === "audit_raw_content") {
      const report = reviewArticleFactualClaims({
        title: data.title,
        content: data.content,
        knownSources: data.knownSources ?? [],
        unverifiedClaims: data.unverifiedClaims ?? []
      });

      await recordAuditLog({
        userId: user.id,
        action: "AUDIT_RAW_CONTENT_CLAIMS",
        module: "SEO_FACTUAL_REVIEW",
        metadata: {
          totalClaims: report.summary.totalClaims,
          criticalCount: report.summary.criticalRiskCount
        }
      });

      return apiSuccess({ report });
    }

    if (data.action === "record_reviewer_decision") {
      const articleRepo = getArticleRepository();
      const websiteRepo = getWebsiteRepository();

      const article = await articleRepo.findArticleById(data.articleId);

      if (!article) {
        return apiError("NOT_FOUND", "Article not found", 404);
      }

      const website = await websiteRepo.findWebsiteById(article.websiteId);
      if (!website) {
        return apiError("NOT_FOUND", "Website not found", 404);
      }

      if (user.roleName !== "ADMIN" && website.ownerId !== user.id) {
        return apiError("FORBIDDEN", "You do not have access to this website's articles", 403);
      }

      // Record human decision in audit log with timestamp and reviewer identity
      await recordAuditLog({
        userId: user.id,
        action: "RECORD_CLAIM_DECISION",
        module: "SEO_FACTUAL_REVIEW",
        entityType: "Article",
        entityId: article.id,
        metadata: {
          claimId: data.claimId,
          decision: data.decision,
          reviewerNotes: data.reviewerNotes || null,
          reviewedBy: user.email,
          reviewedAt: new Date().toISOString()
        }
      });

      return apiSuccess({
        success: true,
        claimId: data.claimId,
        decision: data.decision,
        reviewerNotes: data.reviewerNotes || null,
        reviewedBy: user.email,
        reviewedAt: new Date().toISOString()
      });
    }

    return apiError("BAD_REQUEST", "Unsupported action", 400);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal factual review error";
    return apiError("INTERNAL_ERROR", message, 500);
  }
}
