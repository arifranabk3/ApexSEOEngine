import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { ensureSystemSeeded } from "@/lib/seed-service";
import {
  apiError,
  apiSuccess,
  parseAndValidateBody,
  requireApiAuth
} from "@/lib/api-response";
import { recordAuditLog } from "@/lib/audit";
import { evaluateGoogleSearchComplianceGate } from "@/services/compliance/seo-quality-gate";
import { getKeywordDomainRepository } from "@/repositories/keyword-repository.factory";

const createArticleSchema = z.object({
  websiteId: z.string().min(1),
  categoryId: z.string().optional(),
  title: z.string().min(4),
  slug: z.string().min(3),
  excerpt: z.string().optional(),
  content: z.string().min(10),
  focusKeyword: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  status: z
    .enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "SCHEDULED", "PUBLISHED"])
    .default("DRAFT")
});

const updateArticleSchema = z.object({
  articleId: z.string().min(1),
  title: z.string().min(4).optional(),
  content: z.string().min(10).optional(),
  status: z
    .enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "SCHEDULED", "PUBLISHED"])
    .optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  changeSummary: z.string().optional()
});

export async function GET(req: NextRequest) {
  await ensureSystemSeeded();
  const { errorResponse } = await requireApiAuth(req, "content:read");
  if (errorResponse) return errorResponse;

  const websiteId = req.nextUrl.searchParams.get("websiteId") || undefined;

  const db = await getDb();
  const articles = await db.article.findMany({
    where: websiteId ? { websiteId } : undefined,
    orderBy: { updatedAt: "desc" },
    include: {
      website: { select: { id: true, name: true, url: true } },
      category: { select: { id: true, name: true, slug: true } },
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 5
      }
    }
  });

  const keywordRepo = getKeywordDomainRepository();
  const categories = websiteId
    ? await keywordRepo.findCategoriesByWebsite(websiteId)
    : [];

  return apiSuccess({ articles, categories });
}

export async function POST(req: NextRequest) {
  await ensureSystemSeeded();
  const { user, errorResponse } = await requireApiAuth(req, "content:write");
  if (errorResponse || !user) return errorResponse!;

  const { data, errorResponse: valErr } = await parseAndValidateBody(
    req,
    createArticleSchema
  );
  if (valErr || !data) return valErr!;

  const db = await getDb();
  const wordCount = data.content.trim().split(/\s+/).filter(Boolean).length;

  // Enforce Google Search Compliance Quality Gate if attempting direct PUBLISHED status
  if (data.status === "PUBLISHED") {
    const site = await db.website.findUnique({ where: { id: data.websiteId } });
    const pageUrl = `${(site?.url || "https://example.com").replace(/\/$/, "")}/${data.slug}`;
    const gate = evaluateGoogleSearchComplianceGate({
      technical: {
        pageUrl,
        canonicalUrl: pageUrl,
        htmlContent: data.content
      },
      onPage: {
        title: data.metaTitle || data.title,
        metaDescription: data.metaDescription || data.excerpt || "",
        slug: data.slug,
        searchIntent: "INFORMATIONAL",
        htmlContent: data.content
      },
      qualityAndSpam: {
        title: data.title,
        htmlContent: data.content,
        authorName: user.name
      },
      pageExperience: {
        htmlContent: data.content
      }
    });

    if (!gate.canAutoPublish) {
      return apiError(
        "SEO_QUALITY_GATE_BLOCKED",
        "Automatic publication blocked by Google Search Compliance Quality Gate due to critical issues.",
        422,
        {
          overallGateStatus: gate.overallGateStatus,
          blockingIssues: gate.blockingIssues
        }
      );
    }
  }

  const created = await db.article.create({
    data: {
      websiteId: data.websiteId,
      categoryId: data.categoryId || null,
      authorId: user.id,
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt || null,
      content: data.content,
      status: data.status,
      focusKeyword: data.focusKeyword || null,
      metaTitle: data.metaTitle || data.title,
      metaDescription: data.metaDescription || data.excerpt || null,
      wordCount,
      seoScore: data.focusKeyword ? 82 : 65,
      versions: {
        create: {
          versionNumber: 1,
          title: data.title,
          content: data.content,
          metaTitle: data.metaTitle || data.title,
          metaDesc: data.metaDescription || null,
          changeSummary: "Initial article version created",
          createdBy: user.email
        }
      }
    },
    include: { versions: true }
  });

  await recordAuditLog({
    userId: user.id,
    action: "ARTICLE_CREATED",
    module: "content",
    entityType: "Article",
    entityId: created.id,
    metadata: { title: created.title, websiteId: created.websiteId }
  });

  return apiSuccess(created, 201);
}

export async function PATCH(req: NextRequest) {
  await ensureSystemSeeded();
  const { user, errorResponse } = await requireApiAuth(req, "content:write");
  if (errorResponse || !user) return errorResponse!;

  const { data, errorResponse: valErr } = await parseAndValidateBody(
    req,
    updateArticleSchema
  );
  if (valErr || !data) return valErr!;

  const db = await getDb();
  const existing = await db.article.findUnique({
    where: { id: data.articleId },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1
      }
    }
  });

  if (!existing) {
    return apiError("ARTICLE_NOT_FOUND", "Article not found", 404);
  }

  const nextVersionNumber = (existing.versions[0]?.versionNumber || 0) + 1;
  const nextTitle = data.title ?? existing.title;
  const nextContent = data.content ?? existing.content;
  const wordCount = nextContent.trim().split(/\s+/).filter(Boolean).length;

  const updated = await db.article.update({
    where: { id: existing.id },
    data: {
      title: nextTitle,
      content: nextContent,
      status: data.status ?? existing.status,
      metaTitle: data.metaTitle ?? existing.metaTitle,
      metaDescription: data.metaDescription ?? existing.metaDescription,
      wordCount,
      versions: {
        create: {
          versionNumber: nextVersionNumber,
          title: nextTitle,
          content: nextContent,
          metaTitle: data.metaTitle ?? existing.metaTitle,
          metaDesc: data.metaDescription ?? existing.metaDescription,
          changeSummary: data.changeSummary || `Revision v${nextVersionNumber}`,
          createdBy: user.email
        }
      }
    },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" }
      }
    }
  });

  return apiSuccess(updated);
}

