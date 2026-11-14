import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureSystemSeeded } from "@/lib/seed-service";
import {
  apiError,
  apiSuccess,
  parseAndValidateBody,
  requireApiAuth
} from "@/lib/api-response";
import { recordAuditLog } from "@/lib/audit";
import { DeterministicSvgEngine } from "@/services/media/svg-engine";
import { SvgTemplateTypeEnum } from "@/services/media/svg-templates.types";
import { sanitizeSvg } from "@/services/media/svg-sanitizer";
import { getArticleRepository } from "@/repositories/article-repository.factory";
import { getWebsiteRepository } from "@/repositories/website-repository.factory";

const generateImageSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("preview_image"),
    title: z.string().min(3),
    categoryName: z.string().optional(),
    focusKeyword: z.string().optional(),
    templateType: SvgTemplateTypeEnum.default("FEATURED_HERO")
  }),
  z.object({
    action: z.literal("attach_to_article"),
    articleId: z.string().min(1),
    title: z.string().min(3),
    categoryName: z.string().optional(),
    focusKeyword: z.string().optional(),
    templateType: SvgTemplateTypeEnum.default("FEATURED_HERO"),
    isFeatured: z.boolean().default(true),
    customAltText: z.string().optional(),
    customCaption: z.string().optional()
  })
]);

export async function POST(req: NextRequest) {
  await ensureSystemSeeded();
  const { user, errorResponse } = await requireApiAuth(req, "content:write");
  if (errorResponse || !user) return errorResponse!;

  const { data, errorResponse: valErr } = await parseAndValidateBody(
    req,
    generateImageSchema
  );
  if (valErr || !data) return valErr!;

  const engine = new DeterministicSvgEngine();

  // Action 1: Preview without persisting
  if (data.action === "preview_image") {
    const generated = engine.generate({
      title: data.title,
      categoryName: data.categoryName,
      focusKeyword: data.focusKeyword,
      templateType: data.templateType ?? "FEATURED_HERO"
    });

    const sanitization = sanitizeSvg(generated.svgContent);
    if (!sanitization.isValid) {
      return apiError("UNSAFE_SVG_OUTPUT", "Generated SVG failed security sanitization", 422, {
        violations: sanitization.violations
      });
    }

    return apiSuccess({
      asset: generated,
      security: {
        isSanitized: true,
        scriptFree: true
      }
    });
  }

  // Action 2: Attach to existing Article (Persisting ArticleImage record)
  const articleRepo = getArticleRepository();
  const websiteRepo = getWebsiteRepository();

  const article = await articleRepo.findArticleById(data.articleId);

  if (!article) {
    return apiError("ARTICLE_NOT_FOUND", "Article does not exist", 404);
  }

  const website = await websiteRepo.findWebsiteById(article.websiteId);
  if (!website) {
    return apiError("WEBSITE_NOT_FOUND", "Website does not exist", 404);
  }

  // Tenant Isolation Enforcement
  const isSuperAdmin = user.roleName === "SUPER_ADMIN" || user.roleName === "ADMIN";
  if (!isSuperAdmin && website.ownerId !== user.id) {
    return apiError(
      "FORBIDDEN_WEBSITE_ACCESS",
      "You do not have access to manage images for this website",
      403
    );
  }

  const generated = engine.generate({
    title: data.title || article.title,
    categoryName: data.categoryName,
    focusKeyword: data.focusKeyword || article.focusKeyword || undefined,
    templateType: data.templateType ?? "FEATURED_HERO"
  });

  const sanitization = sanitizeSvg(generated.svgContent);
  if (!sanitization.isValid) {
    return apiError("UNSAFE_SVG_OUTPUT", "Generated SVG failed security sanitization", 422, {
      violations: sanitization.violations
    });
  }

  // Encode SVG as Data URI for instant zero-cost persistence
  const encodedSvgDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(sanitization.sanitizedSvg)}`;

  const articleImage = await articleRepo.addImage({
    articleId: article.id,
    url: encodedSvgDataUrl,
    altText: data.customAltText || generated.altText,
    caption: data.customCaption || generated.caption,
    prompt: `Deterministic SVG Template: ${data.templateType}`,
    provider: "LOCAL_DETERMINISTIC_SVG",
    isFeatured: data.isFeatured,
    width: generated.width,
    height: generated.height
  });

  await recordAuditLog({
    userId: user.id,
    action: "ARTICLE_IMAGE_CREATED",
    module: "media",
    entityType: "ArticleImage",
    entityId: articleImage.id,
    metadata: {
      articleId: article.id,
      templateType: data.templateType,
      isFeatured: data.isFeatured
    }
  });

  return apiSuccess(
    {
      image: articleImage,
      asset: {
        filename: generated.filename,
        width: generated.width,
        height: generated.height,
        fileSizeBytes: generated.fileSizeBytes
      }
    },
    201
  );
}
