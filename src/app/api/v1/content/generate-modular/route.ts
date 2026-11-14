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
import { decryptSecret } from "@/lib/crypto";
import { recordAuditLog } from "@/lib/audit";
import { createAIAdapter } from "@/services/ai/provider-adapter";
import {
  OutlineSectionSchema,
  ArticleOutlineOutput
} from "@/services/ai/topic-outline-schemas";
import {
  GeneratedSectionOutputSchema
} from "@/services/ai/modular-article-schemas";
import { ModularArticleGenerator } from "@/services/ai/modular-article-generator";

const modularGenerationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("generate_single_section"),
    articleId: z.string().min(1),
    sectionIndex: z.number().int().min(0),
    section: OutlineSectionSchema,
    previousSectionsSummary: z.string().optional()
  }),
  z.object({
    action: z.literal("regenerate_section"),
    articleId: z.string().min(1),
    sectionIndex: z.number().int().min(0),
    section: OutlineSectionSchema,
    previousSectionsSummary: z.string().optional()
  }),
  z.object({
    action: z.literal("assemble_and_save"),
    articleId: z.string().min(1),
    sections: z.array(GeneratedSectionOutputSchema).min(1),
    changeSummary: z.string().optional()
  })
]);

export async function POST(req: NextRequest) {
  await ensureSystemSeeded();
  const { user, errorResponse } = await requireApiAuth(req, "content:write");
  if (errorResponse || !user) return errorResponse!;

  const { data, errorResponse: valErr } = await parseAndValidateBody(
    req,
    modularGenerationSchema
  );
  if (valErr || !data) return valErr!;

  const db = await getDb();

  // Find the target article
  const article = await db.article.findUnique({
    where: { id: data.articleId },
    include: {
      brief: true,
      website: true,
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1
      }
    }
  });

  if (!article) {
    return apiError("ARTICLE_NOT_FOUND", "Article does not exist", 404);
  }

  // Tenant Isolation Enforcement
  const isSuperAdmin = user.roleName === "SUPER_ADMIN" || user.roleName === "ADMIN";
  if (!isSuperAdmin && article.website.ownerId !== user.id) {
    return apiError(
      "FORBIDDEN_WEBSITE_ACCESS",
      "You do not have access to edit articles for this website",
      403
    );
  }

  // Handle Action 3: assemble_and_save (No AI call required)
  if (data.action === "assemble_and_save") {
    const rawOutline = (article.brief?.outline || {}) as unknown as ArticleOutlineOutput;
    if (!rawOutline || !rawOutline.h1) {
      return apiError("MISSING_OUTLINE", "ContentBrief does not contain an approved outline", 400);
    }

    const generator = new ModularArticleGenerator({
      adapter: createAIAdapter({ providerType: "OLLAMA", baseUrl: "http://localhost:11434" }),
      modelId: "mock"
    });

    const assembled = generator.assembleArticle(
      rawOutline,
      data.sections,
      article.website.url
    );

    const nextVersionNumber = (article.versions[0]?.versionNumber || 0) + 1;

    // Update article and preserve full version history
    const updated = await db.article.update({
      where: { id: article.id },
      data: {
        title: assembled.title,
        content: assembled.markdownContent,
        wordCount: assembled.wordCount,
        seoScore: assembled.complianceSummary.canPublishDirectly ? 92 : 75,
        status: "DRAFT", // Keep as draft for human editorial review
        versions: {
          create: {
            versionNumber: nextVersionNumber,
            title: assembled.title,
            content: assembled.markdownContent,
            metaTitle: assembled.metaTitle,
            metaDesc: assembled.metaDescription,
            changeSummary:
              data.changeSummary ||
              `Modular assembly v${nextVersionNumber} (${assembled.sections.length} sections, ${assembled.allUnverifiedClaims.length} unverified claims)`,
            createdBy: user.email
          }
        }
      },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1
        }
      }
    });

    await recordAuditLog({
      userId: user.id,
      action: "ARTICLE_MODULAR_ASSEMBLED",
      module: "content",
      entityType: "Article",
      entityId: updated.id,
      metadata: {
        version: nextVersionNumber,
        sectionsCount: assembled.sections.length,
        unverifiedClaimsCount: assembled.allUnverifiedClaims.length
      }
    });

    return apiSuccess({
      article: updated,
      assembled
    });
  }

  // Handle Section Generation / Regeneration: Resolve AI provider
  const provider = await db.aIProvider.findFirst({
    where: { isEnabled: true },
    include: {
      models: {
        where: { isEnabled: true },
        orderBy: { isDefault: "desc" }
      }
    }
  });

  if (!provider) {
    return apiError(
      "NO_AI_PROVIDER_AVAILABLE",
      "No active AI provider configured. Please check AI Providers in settings.",
      503
    );
  }

  const model = provider.models[0];
  const modelId = model?.modelId || "llama3.2:latest";
  const decryptedKey = provider.encryptedApiKey
    ? decryptSecret(provider.encryptedApiKey)
    : null;

  const adapter = createAIAdapter({
    providerType: provider.providerType,
    baseUrl: provider.baseUrl,
    apiKey: decryptedKey,
    name: provider.name
  });

  const generator = new ModularArticleGenerator({
    adapter,
    modelId
  });

  try {
    const generated = await generator.generateSection(data.section, {
      articleTitle: article.title,
      focusKeyword: article.focusKeyword || "seo guide",
      targetAudience: "Technical readers & professionals",
      articleType: "PILLAR_POST",
      currentSectionIndex: data.sectionIndex,
      totalSections: 5,
      previousSectionsSummary: data.previousSectionsSummary || "",
      terminologyGuide: {}
    });

    return apiSuccess({
      sectionIndex: data.sectionIndex,
      section: generated
    });
  } catch (err) {
    return apiError(
      "SECTION_GENERATION_FAILED",
      `Failed to generate section: ${err instanceof Error ? err.message : "Unknown error"}`,
      502
    );
  }
}
