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
import {
  evaluateAdSenseCompliance,
  AdSenseFullAuditInput
} from "@/services/compliance/adsense-compliance-engine";
import { evaluateWebsiteReadiness } from "@/services/compliance/website-readiness-auditor";
import {
  evaluateContentPublishingTransition,
  PublishingLifecycleState
} from "@/services/compliance/publishing-gate-workflow";
import {
  evaluateTrafficQualityProtection,
  GOOGLE_POLICY_REGISTRY
} from "@/services/compliance/traffic-and-policy-monitor";

const complianceAuditRequestSchema = z.object({
  websiteId: z.string().optional(),
  pageUrl: z.string().min(1),
  title: z.string().min(1),
  existingTitlesOnSite: z.array(z.string()).optional(),
  metaDescription: z.string().default(""),
  slug: z.string().min(1),
  searchIntent: z
    .enum(["INFORMATIONAL", "COMMERCIAL", "TRANSACTIONAL", "NAVIGATIONAL"])
    .default("INFORMATIONAL"),
  htmlContent: z.string().min(1),
  canonicalUrl: z.string().optional(),
  httpStatusCode: z.number().optional(),
  redirectChainUrls: z.array(z.string()).optional(),
  robotsTxtContent: z.string().optional(),
  metaRobotsTag: z.string().optional(),
  authorName: z.string().optional(),
  reviewerName: z.string().optional(),
  isYmylTopic: z.boolean().optional(),
  ymylCategory: z
    .enum(["NONE", "FINANCE", "HEALTH", "LEGAL", "INSURANCE"])
    .optional(),
  hasBreadcrumbMarkupOrNav: z.boolean().optional(),
  adSenseIdentity: z
    .object({
      hasAboutUsPage: z.boolean().default(true),
      hasContactUsPage: z.boolean().default(true),
      hasPrivacyPolicyPage: z.boolean().default(true),
      hasTermsAndConditionsPage: z.boolean().default(true),
      hasEditorialPolicyPage: z.boolean().default(true),
      hasClearAuthorAttribution: z.boolean().default(true),
      hasClearSiteNavigation: z.boolean().default(true)
    })
    .optional(),
  adsTxtContent: z.string().optional(),
  publisherId: z.string().optional()
});

const publishingTransitionSchema = z.object({
  articleId: z.string().min(1),
  websiteId: z.string().min(1),
  requestedState: z.enum(["DRAFT", "NEEDS_REVIEW", "APPROVED", "PUBLISHED"]),
  requireHumanApproval: z.boolean().default(true),
  humanApproved: z.boolean().default(false),
  isYmylTopic: z.boolean().default(false),
  qualifiedHumanReviewerName: z.string().optional()
});

/**
 * GET /api/v1/compliance?websiteId=...
 * Returns strictly website-isolated 8-section Compliance Dashboard state:
 * 1. Google Search Compliance
 * 2. AdSense Compliance
 * 3. Technical SEO
 * 4. Content Quality
 * 5. Website Readiness
 * 6. Traffic Quality
 * 7. Policy Updates
 * 8. Publishing Approvals
 */
export async function GET(req: NextRequest) {
  await ensureSystemSeeded();
  const { errorResponse } = await requireApiAuth(req, "content:read");
  if (errorResponse) return errorResponse;

  const db = await getDb();
  const requestedSiteId = req.nextUrl.searchParams.get("websiteId");

  const website = requestedSiteId
    ? await db.website.findUnique({
        where: { id: requestedSiteId },
        include: {
          articles: { orderBy: { updatedAt: "desc" } },
          categories: true
        }
      })
    : await db.website.findFirst({
        include: {
          articles: { orderBy: { updatedAt: "desc" } },
          categories: true
        }
      });

  if (!website) {
    return apiError("WEBSITE_NOT_FOUND", "Target website not found", 404);
  }

  const primaryArticle = website.articles[0];
  const sampleHtml =
    primaryArticle?.content ||
    `<!DOCTYPE html><html lang="en-US"><head><meta name="viewport" content="width=device-width, initial-scale=1" /><link rel="canonical" href="${website.url}/sample" /></head><body><main><article><h1>${
      primaryArticle?.title || website.name
    }</h1><h2>Overview</h2><p>Technical documentation for ${website.name}.</p></article></main></body></html>`;

  const seoCfg = (website.seoConfig || {}) as Record<string, unknown>;
  const pubCfg = (website.publishingConfig || {}) as Record<string, unknown>;

  const adSenseInput: AdSenseFullAuditInput = {
    websiteId: website.id,
    identity: {
      hasAboutUsPage: seoCfg.hasAboutUsPage !== false,
      hasContactUsPage: seoCfg.hasContactUsPage !== false,
      hasPrivacyPolicyPage: seoCfg.hasPrivacyPolicyPage !== false,
      hasTermsAndConditionsPage: seoCfg.hasTermsAndConditionsPage !== false,
      hasEditorialPolicyPage: seoCfg.hasEditorialPolicyPage !== false,
      hasClearAuthorAttribution: true,
      hasClearSiteNavigation: true
    },
    content: {
      htmlContent: sampleHtml
    },
    advertisingAndTechnical: {
      siteUrl: website.url,
      adsTxtContent:
        typeof pubCfg.adsTxtContent === "string" ? pubCfg.adsTxtContent : null,
      publisherId:
        typeof pubCfg.publisherId === "string" ? pubCfg.publisherId : null,
      allowsMediapartnersGoogleCrawler: true,
      hasCmpConsentBannerConfigured: Boolean(pubCfg.hasCmpConsentBannerConfigured)
    }
  };

  const readinessReport = evaluateWebsiteReadiness({
    websiteId: website.id,
    websiteName: website.name,
    websiteUrl: website.url,
    publishedOriginalArticleCount: website.articles.filter(
      (a) => a.status === "PUBLISHED"
    ).length,
    categoryCount: website.categories.length,
    brokenPageCount: 0,
    searchComplianceInput: {
      technical: {
        pageUrl: `${website.url.replace(/\/$/, "")}/${
          primaryArticle?.slug || "index"
        }`,
        canonicalUrl: `${website.url.replace(/\/$/, "")}/${
          primaryArticle?.slug || "index"
        }`,
        htmlContent: sampleHtml
      },
      onPage: {
        title: primaryArticle?.metaTitle || primaryArticle?.title || website.name,
        metaDescription:
          primaryArticle?.metaDescription ||
          primaryArticle?.excerpt ||
          `Official technical articles from ${website.name} covering open-source AI and SEO automation.`,
        slug: primaryArticle?.slug || "self-hosted-seo-guide",
        searchIntent: "INFORMATIONAL",
        htmlContent: sampleHtml,
        hasBreadcrumbMarkupOrNav: true
      },
      qualityAndSpam: {
        title: primaryArticle?.title || website.name,
        htmlContent: sampleHtml,
        authorName: String(seoCfg.defaultAuthor || "Editorial Team")
      },
      pageExperience: {
        htmlContent: sampleHtml
      }
    },
    adSenseComplianceInput: adSenseInput
  });

  const adSenseReport = evaluateAdSenseCompliance(adSenseInput);
  const trafficReport = evaluateTrafficQualityProtection({
    websiteId: website.id,
    logs: []
  });

  return apiSuccess({
    websiteIsolationContext: {
      websiteId: website.id,
      websiteName: website.name,
      websiteUrl: website.url
    },
    sections: {
      googleSearchCompliance: readinessReport.auditMatrix.filter(
        (i) => i.layer === "GOOGLE_SEARCH"
      ),
      adSenseCompliance: adSenseReport,
      technicalSeo: readinessReport.auditMatrix.filter(
        (i) => i.layer === "TECHNICAL_SEO"
      ),
      contentQuality: readinessReport.auditMatrix.filter(
        (i) => i.layer === "CONTENT_QUALITY"
      ),
      websiteReadiness: readinessReport,
      trafficQuality: trafficReport,
      policyUpdates: GOOGLE_POLICY_REGISTRY,
      publishingApprovals: website.articles.map((a) => ({
        articleId: a.id,
        title: a.title,
        slug: a.slug,
        currentState: a.status as PublishingLifecycleState,
        updatedAt: a.updatedAt
      }))
    }
  });
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireApiAuth(req, "content:read");
  if (errorResponse || !user) return errorResponse!;

  const { data, errorResponse: valErr } = await parseAndValidateBody(
    req,
    complianceAuditRequestSchema
  );
  if (valErr || !data) return valErr!;

  const searchReport = evaluateGoogleSearchComplianceGate({
    technical: {
      pageUrl: data.pageUrl,
      httpStatusCode: data.httpStatusCode,
      redirectChainUrls: data.redirectChainUrls,
      canonicalUrl: data.canonicalUrl,
      robotsTxtContent: data.robotsTxtContent,
      metaRobotsTag: data.metaRobotsTag,
      htmlContent: data.htmlContent
    },
    onPage: {
      title: data.title,
      existingTitlesOnSite: data.existingTitlesOnSite,
      metaDescription: data.metaDescription || "",
      slug: data.slug,
      searchIntent: data.searchIntent || "INFORMATIONAL",
      htmlContent: data.htmlContent,
      hasBreadcrumbMarkupOrNav: data.hasBreadcrumbMarkupOrNav
    },
    qualityAndSpam: {
      title: data.title,
      htmlContent: data.htmlContent,
      authorName: data.authorName,
      reviewerName: data.reviewerName,
      isYmylTopic: data.isYmylTopic,
      ymylCategory: data.ymylCategory
    },
    pageExperience: {
      htmlContent: data.htmlContent
    }
  });

  const adSenseReport = evaluateAdSenseCompliance({
    websiteId: data.websiteId || "isolated-website",
    identity: {
      hasAboutUsPage: data.adSenseIdentity?.hasAboutUsPage ?? true,
      hasContactUsPage: data.adSenseIdentity?.hasContactUsPage ?? true,
      hasPrivacyPolicyPage: data.adSenseIdentity?.hasPrivacyPolicyPage ?? true,
      hasTermsAndConditionsPage:
        data.adSenseIdentity?.hasTermsAndConditionsPage ?? true,
      hasEditorialPolicyPage: data.adSenseIdentity?.hasEditorialPolicyPage ?? true,
      hasClearAuthorAttribution:
        data.adSenseIdentity?.hasClearAuthorAttribution ?? Boolean(data.authorName),
      hasClearSiteNavigation: data.adSenseIdentity?.hasClearSiteNavigation ?? true
    },
    content: {
      htmlContent: data.htmlContent
    },
    advertisingAndTechnical: {
      siteUrl: data.pageUrl,
      adsTxtContent: data.adsTxtContent || null,
      publisherId: data.publisherId || null,
      allowsMediapartnersGoogleCrawler: true,
      hasCmpConsentBannerConfigured: true
    }
  });

  await recordAuditLog({
    userId: user.id,
    action: `DUAL_COMPLIANCE_GATE_${searchReport.overallGateStatus}_ADSENSE_${adSenseReport.overallVerdict}`,
    module: "compliance",
    metadata: {
      websiteId: data.websiteId || null,
      pageUrl: data.pageUrl,
      searchGate: searchReport.overallGateStatus,
      adSenseVerdict: adSenseReport.overallVerdict
    }
  });

  return apiSuccess({
    ...searchReport,
    adSenseCompliance: adSenseReport
  });
}

/**
 * PUT /api/v1/compliance
 * Executes a 4-state Publishing Gate transition (DRAFT -> NEEDS_REVIEW -> APPROVED -> PUBLISHED)
 * with mandatory Search + AdSense + YMYL checks.
 */
export async function PUT(req: NextRequest) {
  await ensureSystemSeeded();
  const { user, errorResponse } = await requireApiAuth(req, "content:write");
  if (errorResponse || !user) return errorResponse!;

  const { data, errorResponse: valErr } = await parseAndValidateBody(
    req,
    publishingTransitionSchema
  );
  if (valErr || !data) return valErr!;

  const db = await getDb();
  const article = await db.article.findFirst({
    where: { id: data.articleId, websiteId: data.websiteId },
    include: { website: true }
  });

  if (!article) {
    return apiError(
      "ARTICLE_NOT_FOUND_FOR_WEBSITE",
      "Article not found or belongs to a different isolated website",
      404
    );
  }

  const pageUrl = `${article.website.url.replace(/\/$/, "")}/${article.slug}`;
  const decision = evaluateContentPublishingTransition({
    articleId: article.id,
    websiteId: article.websiteId,
    currentState: (article.status as PublishingLifecycleState) || "DRAFT",
    requestedState: data.requestedState,
    requireHumanApproval: data.requireHumanApproval ?? true,
    humanApprovedByUserId: data.humanApproved ? user.id : null,
    isYmylTopic: data.isYmylTopic ?? false,
    qualifiedHumanReviewerName: data.qualifiedHumanReviewerName || null,
    searchAuditInput: {
      technical: {
        pageUrl,
        canonicalUrl: article.canonicalUrl || pageUrl,
        htmlContent: article.content
      },
      onPage: {
        title: article.metaTitle || article.title,
        metaDescription: article.metaDescription || article.excerpt || "",
        slug: article.slug,
        searchIntent: "INFORMATIONAL",
        htmlContent: article.content,
        hasBreadcrumbMarkupOrNav: true
      },
      qualityAndSpam: {
        title: article.title,
        htmlContent: article.content,
        authorName: user.name,
        reviewerName: data.qualifiedHumanReviewerName,
        isYmylTopic: data.isYmylTopic
      },
      pageExperience: {
        htmlContent: article.content
      }
    },
    adSenseAuditInput: {
      websiteId: article.websiteId,
      identity: {
        hasAboutUsPage: true,
        hasContactUsPage: true,
        hasPrivacyPolicyPage: true,
        hasTermsAndConditionsPage: true,
        hasEditorialPolicyPage: true,
        hasClearAuthorAttribution: true,
        hasClearSiteNavigation: true
      },
      content: {
        htmlContent: article.content
      },
      advertisingAndTechnical: {
        siteUrl: article.website.url,
        allowsMediapartnersGoogleCrawler: true,
        hasCmpConsentBannerConfigured: true
      }
    }
  });

  await db.article.update({
    where: { id: article.id },
    data: {
      status: decision.resultingState,
      ...(decision.resultingState === "PUBLISHED"
        ? { publishedAt: new Date(), publishedUrl: pageUrl }
        : {})
    }
  });

  await recordAuditLog({
    userId: user.id,
    action: `PUBLISHING_GATE_TRANSITION_${decision.resultingState}`,
    module: "compliance",
    entityType: "Article",
    entityId: article.id,
    metadata: {
      websiteId: article.websiteId,
      requestedState: data.requestedState,
      resultingState: decision.resultingState,
      transitionAllowed: decision.transitionAllowed,
      blockReasons: decision.blockReasons
    }
  });

  return apiSuccess(decision);
}
