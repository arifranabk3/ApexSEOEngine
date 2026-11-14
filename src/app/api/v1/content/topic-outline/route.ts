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
import { getAIConfigRepository } from "@/repositories/ai-config-repository.factory";
import { getKeywordDomainRepository } from "@/repositories/keyword-repository.factory";
import {
  TopicAnalysisOutputSchema,
  TopicClusterOutputSchema,
  ArticleOutlineOutputSchema,
  createTopicAnalysisInput,
  SearchIntentEnum,
  ArticleTypeEnum
} from "@/services/ai/topic-outline-schemas";
import { TopicClusterOutlineEngine } from "@/services/ai/topic-outline-engine";
import { validateArticleOutline } from "@/services/ai/outline-validator";

const requestInputSchema = z.object({
  websiteId: z.string().min(1, "Website is required"),
  mainTopic: z.string().min(3, "Main topic must be at least 3 characters"),
  focusKeyword: z.string().min(2, "Focus keyword must be at least 2 characters"),
  secondaryKeywords: z.array(z.string()).optional(),
  targetCountry: z.string().optional(),
  targetLanguage: z.string().optional(),
  targetAudience: z.string().optional(),
  searchIntent: SearchIntentEnum.optional(),
  articleType: ArticleTypeEnum.optional(),
  existingClusterId: z.string().optional(),
  referenceUrls: z.array(z.string().url()).optional()
});

const topicWorkflowSchema = z.discriminatedUnion("stage", [
  z.object({
    stage: z.literal("analyze_topic"),
    input: requestInputSchema
  }),
  z.object({
    stage: z.literal("generate_cluster"),
    input: requestInputSchema,
    analysis: TopicAnalysisOutputSchema.optional()
  }),
  z.object({
    stage: z.literal("generate_outline"),
    input: requestInputSchema,
    analysis: TopicAnalysisOutputSchema.optional(),
    cluster: TopicClusterOutputSchema.optional()
  }),
  z.object({
    stage: z.literal("validate_outline"),
    input: requestInputSchema,
    outline: ArticleOutlineOutputSchema
  }),
  z.object({
    stage: z.literal("save_plan"),
    websiteId: z.string().min(1),
    cluster: TopicClusterOutputSchema.optional(),
    outline: ArticleOutlineOutputSchema,
    keyword: z.string().min(1),
    createArticleDraft: z.boolean().default(true)
  })
]);

export async function POST(req: NextRequest) {
  await ensureSystemSeeded();
  const { user, errorResponse } = await requireApiAuth(req, "content:write");
  if (errorResponse || !user) return errorResponse!;

  const { data, errorResponse: valErr } = await parseAndValidateBody(
    req,
    topicWorkflowSchema
  );
  if (valErr || !data) return valErr!;

  const db = await getDb();

  // Multi-tenant check: Verify website ownership or admin role
  const targetWebsiteId = "websiteId" in data ? data.websiteId : data.input.websiteId;
  const website = await db.website.findUnique({
    where: { id: targetWebsiteId }
  });

  if (!website) {
    return apiError("WEBSITE_NOT_FOUND", "Selected website does not exist", 404);
  }

  const isSuperAdmin = user.roleName === "SUPER_ADMIN" || user.roleName === "ADMIN";
  if (!isSuperAdmin && website.ownerId !== user.id) {
    return apiError(
      "FORBIDDEN_WEBSITE_ACCESS",
      "You do not have access to manage content for this website",
      403
    );
  }

  // 1. STAGE: VALIDATE OUTLINE (No AI call required)
  if (data.stage === "validate_outline") {
    const validatedInput = createTopicAnalysisInput(data.input);
    const validation = validateArticleOutline(data.outline, validatedInput);
    return apiSuccess({ validation });
  }

  // 2. STAGE: SAVE PLAN (Persist KeywordCluster, Keywords via Mongo Repository, ContentBrief & optional Article draft)
  if (data.stage === "save_plan") {
    let clusterRecordId: string | undefined;
    const keywordRepo = getKeywordDomainRepository();

    // A. Persist cluster if provided
    if (data.cluster) {
      const clusterRecord = await keywordRepo.createCluster({
        websiteId: website.id,
        name: data.cluster.clusterName,
        pillarKeyword: data.cluster.pillarKeyword,
        intent: data.cluster.intent,
        status: "PLANNED"
      });
      clusterRecordId = clusterRecord.id;

      // Add supporting keywords under cluster
      for (const sup of data.cluster.supportingArticles) {
        await keywordRepo.upsertKeyword({
          websiteId: website.id,
          clusterId: clusterRecord.id,
          term: sup.targetKeyword,
          searchIntent: sup.intent,
          status: "PLANNED"
        });
      }
    }

    // B. Upsert main focus keyword
    const mainKeyword = await keywordRepo.upsertKeyword({
      websiteId: website.id,
      term: data.keyword,
      clusterId: clusterRecordId ?? null,
      searchIntent: data.cluster?.intent ?? "INFORMATIONAL",
      status: "TARGETED"
    });

    // C. Create ContentBrief
    const brief = await db.contentBrief.create({
      data: {
        websiteId: website.id,
        keywordId: mainKeyword.id,
        clusterId: clusterRecordId ?? null,
        title: data.outline.seoTitle,
        searchIntent: data.cluster?.intent ?? "INFORMATIONAL",
        outline: JSON.parse(JSON.stringify(data.outline)),
        secondaryKeywords: data.cluster?.supportingArticles.map((s) => s.targetKeyword) || [],
        status: "APPROVED"
      }
    });

    // D. Optionally create draft Article with initial version
    let articleRecord = null;
    if (data.createArticleDraft) {
      // Deduplicate slug if an article with the same slug already exists for this website
      let targetSlug = data.outline.urlSlug;
      const existingArticleWithSlug = await db.article.findUnique({
        where: {
          websiteId_slug: {
            websiteId: website.id,
            slug: targetSlug
          }
        }
      });
      if (existingArticleWithSlug) {
        targetSlug = `${targetSlug}-${Date.now().toString().slice(-4)}`;
      }

      articleRecord = await db.article.create({
        data: {
          websiteId: website.id,
          briefId: brief.id,
          authorId: user.id,
          title: data.outline.h1,
          slug: targetSlug,
          excerpt: data.outline.metaDescription,
          content: `# ${data.outline.h1}\n\n*Outline approved. Ready for section generation.*`,
          focusKeyword: data.keyword,
          metaTitle: data.outline.seoTitle,
          metaDescription: data.outline.metaDescription,
          status: "DRAFT",
          seoScore: 85,
          versions: {
            create: {
              versionNumber: 1,
              title: data.outline.h1,
              content: `# ${data.outline.h1}\n\n*Outline approved.*`,
              metaTitle: data.outline.seoTitle,
              metaDesc: data.outline.metaDescription,
              changeSummary: "Draft generated from approved AI outline",
              createdBy: user.email
            }
          }
        }
      });
    }

    await recordAuditLog({
      userId: user.id,
      action: "TOPIC_PLAN_SAVED",
      module: "content",
      entityType: "ContentBrief",
      entityId: brief.id,
      metadata: {
        websiteId: website.id,
        clusterId: clusterRecordId,
        articleId: articleRecord?.id
      }
    });

    return apiSuccess(
      {
        briefId: brief.id,
        clusterId: clusterRecordId,
        articleId: articleRecord?.id,
        message: "Topic cluster and outline successfully approved and saved."
      },
      201
    );
  }

  // 3. AI STAGES: Resolve enabled AI provider & model via Mongo repository
  const aiConfigRepo = getAIConfigRepository();
  const activeConfig = await aiConfigRepo.findFirstEnabledWithDefaultModel();

  if (!activeConfig) {
    return apiError(
      "NO_AI_PROVIDER_AVAILABLE",
      "No active AI provider configured. Please check AI Providers in settings.",
      503
    );
  }

  const { provider, defaultModel: model } = activeConfig;
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

  const engine = new TopicClusterOutlineEngine({
    adapter,
    modelId
  });

  const validatedInput = createTopicAnalysisInput(data.input);

  try {
    if (data.stage === "analyze_topic") {
      const analysis = await engine.generateTopicAnalysis(validatedInput);
      return apiSuccess({ analysis });
    }

    if (data.stage === "generate_cluster") {
      const cluster = await engine.generateTopicCluster(validatedInput, data.analysis);
      return apiSuccess({ cluster });
    }

    if (data.stage === "generate_outline") {
      const { outline, validation } = await engine.generateArticleOutline(
        validatedInput,
        data.analysis,
        data.cluster
      );
      return apiSuccess({ outline, validation });
    }
  } catch (err) {
    return apiError(
      "AI_WORKFLOW_FAILED",
      `Topic outline generation failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      502
    );
  }

  return apiError("INVALID_STAGE", "Unknown workflow stage", 400);
}
