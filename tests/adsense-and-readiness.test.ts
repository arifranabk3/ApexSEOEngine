import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import {
  validateAdsTxtRecord,
  evaluateAdSenseCompliance
} from "@/services/compliance/adsense-compliance-engine";
import { evaluateWebsiteReadiness } from "@/services/compliance/website-readiness-auditor";
import { evaluateContentPublishingTransition } from "@/services/compliance/publishing-gate-workflow";
import {
  evaluateTrafficQualityProtection,
  GOOGLE_POLICY_REGISTRY
} from "@/services/compliance/traffic-and-policy-monitor";
import { GET as complianceGet } from "@/app/api/v1/compliance/route";
import { getDb } from "@/lib/db";
import { ensureSystemSeeded } from "@/lib/seed-service";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

const CLEAN_HTML = `<!DOCTYPE html>
<html lang="en-US">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="canonical" href="https://apextech.example.com/guide" />
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"TechArticle","headline":"Enterprise Guide to Self-Hosted AI Workflows"}
  </script>
</head>
<body>
  <main>
    <nav aria-label="breadcrumb"><a href="/">Home</a></nav>
    <article>
      <h1>Enterprise Guide to Self-Hosted AI Workflows</h1>
      <p>Building a private AI workflow stack requires container isolation, database persistence, and structured output validation.</p>
      <p>Every component runs inside an isolated Docker network so credentials never leave your server environment.</p>
      <figure><img src="/images/diagram.webp" alt="Architecture diagram of self-hosted containers" width="1200" height="630" fetchpriority="high" decoding="async" /></figure>
      <h2>Step 1: Configure PostgreSQL Persistence</h2>
      <p>Store every draft and revision in PostgreSQL 16 so editors can verify changes before publication.</p>
      <pre><code>docker compose up -d</code></pre>
      <p>See our <a href="/companion-guide">companion setup guide</a> and the <a href="https://docs.n8n.io" target="_blank" rel="noopener noreferrer">official n8n documentation</a>.</p>
      <h2>Step 2: Enforce Pre-Publish Quality Gates</h2>
      <p>Always run automated technical and editorial checks before pushing drafts to your production CMS.</p>
      <p>Human editors review each flagged warning to ensure genuine helpfulness for readers.</p>
    </article>
  </main>
</body>
</html>`;

describe("Enterprise Google Search + AdSense Compliance Suite (Modules 1-10)", () => {
  let adminToken = "";

  beforeAll(async () => {
    await ensureSystemSeeded();
    const db = await getDb();
    const admin = await db.user.findUnique({
      where: { email: "admin@apexseo.local" },
      include: { role: { include: { permissions: true } } }
    });
    adminToken = await createSessionToken({
      id: admin!.id,
      email: admin!.email,
      name: admin!.name,
      roleName: admin!.role.name,
      permissions: admin!.role.permissions.map((p) => p.code)
    });
  });

  it("Module 3D: validates ads.txt records and Publisher IDs (PASS, FAIL, NOT_VERIFIED)", () => {
    const unconfigured = validateAdsTxtRecord(null, null);
    expect(unconfigured.verdict).toBe("NOT_VERIFIED");

    const badPubId = validateAdsTxtRecord(
      "google.com, pub-123, DIRECT, f08c47fec0942fa0",
      "pub-123"
    );
    expect(badPubId.verdict).toBe("FAIL");

    const validAdsTxt = validateAdsTxtRecord(
      "# Authorized Digital Sellers\ngoogle.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0",
      "pub-1234567890123456"
    );
    expect(validAdsTxt.valid).toBe(true);
    expect(validAdsTxt.verdict).toBe("PASS");
  });

  it("Module 3: evaluates AdSense compliance (trust pages, prohibited content, artificial clicks/impressions)", () => {
    const passingAdSense = evaluateAdSenseCompliance({
      websiteId: "site-1",
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
        htmlContent: CLEAN_HTML
      },
      advertisingAndTechnical: {
        siteUrl: "https://apextech.example.com",
        adsTxtContent: "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0",
        publisherId: "pub-1234567890123456",
        allowsMediapartnersGoogleCrawler: true,
        hasCmpConsentBannerConfigured: true
      }
    });

    expect(passingAdSense.overallVerdict).toBe("PASS");
    expect(passingAdSense.adSenseReady).toBe(true);

    const failingAdSense = evaluateAdSenseCompliance({
      websiteId: "site-1",
      identity: {
        hasAboutUsPage: false,
        hasContactUsPage: false,
        hasPrivacyPolicyPage: false,
        hasTermsAndConditionsPage: true,
        hasEditorialPolicyPage: false,
        hasClearAuthorAttribution: false,
        hasClearSiteNavigation: true
      },
      content: {
        htmlContent: "<p>Download cracked software keygen download and click our sponsors below!</p>",
        hasCopyrightedScrapedMaterial: true
      },
      advertisingAndTechnical: {
        siteUrl: "http://apextech.example.com",
        attemptsAutoClickOrRefreshAds: true,
        hasMisleadingAdLabels: true
      }
    });

    expect(failingAdSense.overallVerdict).toBe("FAIL");
    expect(failingAdSense.adSenseReady).toBe(false);
    expect(failingAdSense.summary.fail).toBeGreaterThanOrEqual(4);
  });

  it("Module 4 & Final CTO Rule: proves Google Search compliance and AdSense compliance are independent layers", () => {
    // Case A: Passes Technical/Search SEO, but FAILS AdSense (missing Privacy/Contact pages & ads.txt)
    const readiness = evaluateWebsiteReadiness({
      websiteId: "site-1",
      websiteName: "Apex Tech Journal",
      websiteUrl: "https://apextech.example.com",
      publishedOriginalArticleCount: 15,
      categoryCount: 3,
      brokenPageCount: 0,
      searchComplianceInput: {
        technical: {
          pageUrl: "https://apextech.example.com/guide",
          httpStatusCode: 200,
          htmlContent: CLEAN_HTML
        },
        onPage: {
          title: "Enterprise Guide to Self-Hosted AI Workflows",
          metaDescription:
            "Complete engineering guide to building a private AI workflow stack with Docker Compose and PostgreSQL 16.",
          slug: "enterprise-guide-self-hosted-ai-workflows",
          searchIntent: "INFORMATIONAL",
          htmlContent: CLEAN_HTML,
          hasBreadcrumbMarkupOrNav: true
        },
        qualityAndSpam: {
          title: "Enterprise Guide to Self-Hosted AI Workflows",
          htmlContent: CLEAN_HTML,
          authorName: "Principal Architect"
        },
        pageExperience: {
          htmlContent: CLEAN_HTML
        }
      },
      adSenseComplianceInput: {
        websiteId: "site-1",
        identity: {
          hasAboutUsPage: true,
          hasContactUsPage: false, // Missing Contact Us!
          hasPrivacyPolicyPage: false, // Missing Privacy Policy!
          hasTermsAndConditionsPage: true,
          hasEditorialPolicyPage: true,
          hasClearAuthorAttribution: true,
          hasClearSiteNavigation: true
        },
        content: { htmlContent: CLEAN_HTML },
        advertisingAndTechnical: {
          siteUrl: "https://apextech.example.com",
          adsTxtContent: "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0",
          publisherId: "pub-1234567890123456",
          allowsMediapartnersGoogleCrawler: true,
          hasCmpConsentBannerConfigured: true
        }
      }
    });

    expect(readiness.searchComplianceVerdict).toBe("PASS");
    expect(readiness.readyForOrganicSearchIndexation).toBe(true);
    expect(readiness.adSenseComplianceVerdict).toBe("FAIL");
    expect(readiness.readyForAdSenseApplication).toBe(false);
  });

  it("Module 5: enforces 4-state Publishing Gate (DRAFT -> NEEDS_REVIEW -> APPROVED -> PUBLISHED) and blocks unreviewed YMYL or policy violations", () => {
    // 1. Blocked YMYL transition without qualified human reviewer
    const blockedYmyl = evaluateContentPublishingTransition({
      articleId: "art-1",
      websiteId: "site-1",
      currentState: "DRAFT",
      requestedState: "PUBLISHED",
      requireHumanApproval: true,
      humanApprovedByUserId: null,
      isYmylTopic: true,
      qualifiedHumanReviewerName: null,
      searchAuditInput: {
        technical: { pageUrl: "https://apextech.example.com/guide", htmlContent: CLEAN_HTML },
        onPage: {
          title: "Enterprise Guide to Self-Hosted AI Workflows",
          metaDescription:
            "Complete engineering guide to building a private AI workflow stack with Docker Compose and PostgreSQL 16.",
          slug: "enterprise-guide-self-hosted-ai-workflows",
          searchIntent: "INFORMATIONAL",
          htmlContent: CLEAN_HTML
        },
        qualityAndSpam: {
          title: "Enterprise Guide to Self-Hosted AI Workflows",
          htmlContent: CLEAN_HTML,
          isYmylTopic: true,
          ymylCategory: "FINANCE"
        },
        pageExperience: { htmlContent: CLEAN_HTML }
      },
      adSenseAuditInput: {
        websiteId: "site-1",
        identity: {
          hasAboutUsPage: true,
          hasContactUsPage: true,
          hasPrivacyPolicyPage: true,
          hasTermsAndConditionsPage: true,
          hasEditorialPolicyPage: true,
          hasClearAuthorAttribution: true,
          hasClearSiteNavigation: true
        },
        content: { htmlContent: CLEAN_HTML },
        advertisingAndTechnical: {
          siteUrl: "https://apextech.example.com",
          adsTxtContent: "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0",
          publisherId: "pub-1234567890123456",
          allowsMediapartnersGoogleCrawler: true,
          hasCmpConsentBannerConfigured: true
        }
      }
    });

    expect(blockedYmyl.transitionAllowed).toBe(false);
    expect(blockedYmyl.resultingState).toBe("NEEDS_REVIEW");
    expect(blockedYmyl.blockReasons.length).toBeGreaterThanOrEqual(2);

    // 2. Allowed non-YMYL transition when all 7 audits pass and human approval is provided
    const allowedTransition = evaluateContentPublishingTransition({
      articleId: "art-2",
      websiteId: "site-1",
      currentState: "APPROVED",
      requestedState: "PUBLISHED",
      requireHumanApproval: true,
      humanApprovedByUserId: "usr-admin",
      isYmylTopic: false,
      searchAuditInput: {
        technical: { pageUrl: "https://apextech.example.com/guide", htmlContent: CLEAN_HTML },
        onPage: {
          title: "Enterprise Guide to Self-Hosted AI Workflows",
          metaDescription:
            "Complete engineering guide to building a private AI workflow stack with Docker Compose and PostgreSQL 16.",
          slug: "enterprise-guide-self-hosted-ai-workflows",
          searchIntent: "INFORMATIONAL",
          htmlContent: CLEAN_HTML,
          hasBreadcrumbMarkupOrNav: true
        },
        qualityAndSpam: {
          title: "Enterprise Guide to Self-Hosted AI Workflows",
          htmlContent: CLEAN_HTML,
          authorName: "Principal Architect"
        },
        pageExperience: { htmlContent: CLEAN_HTML }
      },
      adSenseAuditInput: {
        websiteId: "site-1",
        identity: {
          hasAboutUsPage: true,
          hasContactUsPage: true,
          hasPrivacyPolicyPage: true,
          hasTermsAndConditionsPage: true,
          hasEditorialPolicyPage: true,
          hasClearAuthorAttribution: true,
          hasClearSiteNavigation: true
        },
        content: { htmlContent: CLEAN_HTML },
        advertisingAndTechnical: {
          siteUrl: "https://apextech.example.com",
          adsTxtContent: "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0",
          publisherId: "pub-1234567890123456",
          allowsMediapartnersGoogleCrawler: true,
          hasCmpConsentBannerConfigured: true
        }
      }
    });

    expect(allowedTransition.transitionAllowed).toBe(true);
    expect(allowedTransition.resultingState).toBe("PUBLISHED");
  });

  it("Module 6 & 7: detects Invalid Traffic (IVT), suspicious referrers, single-IP click bursts, and maintains Policy Update Registry", () => {
    const emptyTraffic = evaluateTrafficQualityProtection({
      websiteId: "site-1",
      logs: []
    });
    expect(emptyTraffic.overallVerdict).toBe("NOT_VERIFIED");

    const attackedTraffic = evaluateTrafficQualityProtection({
      websiteId: "site-1",
      logs: [
        {
          timestamp: "2026-11-12T10:00:00Z",
          ipHash: "ip_attacker_99",
          userAgent: "HeadlessChrome/120.0",
          referrer: "https://hitleap.com/traffic-exchange",
          countryCode: "US",
          path: "/guide",
          adClickRecorded: true
        },
        {
          timestamp: "2026-11-12T10:00:02Z",
          ipHash: "ip_attacker_99",
          userAgent: "HeadlessChrome/120.0",
          referrer: "https://10khits.com/autosurf",
          countryCode: "US",
          path: "/guide",
          adClickRecorded: true
        },
        {
          timestamp: "2026-11-12T10:00:04Z",
          ipHash: "ip_attacker_99",
          userAgent: "HeadlessChrome/120.0",
          referrer: "https://10khits.com/autosurf",
          countryCode: "US",
          path: "/guide",
          adClickRecorded: true
        }
      ]
    });

    expect(attackedTraffic.overallVerdict).toBe("FAIL");
    expect(attackedTraffic.invalidClickSpikeDetected).toBe(true);
    expect(attackedTraffic.suspiciousReferrers.length).toBe(2);
    expect(GOOGLE_POLICY_REGISTRY.length).toBeGreaterThanOrEqual(6);
  });

  it("Module 8 & 9: enforces strict multi-website isolation on GET /api/v1/compliance", async () => {
    const db = await getDb();
    const sites = await db.website.findMany({ take: 2 });
    expect(sites.length).toBeGreaterThanOrEqual(1);

    const req = new NextRequest(
      `http://localhost:3000/api/v1/compliance?websiteId=${sites[0].id}`,
      {
        method: "GET",
        headers: new Headers({
          Cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
          Authorization: `Bearer ${adminToken}`
        })
      }
    );

    const res = await complianceGet(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.websiteIsolationContext.websiteId).toBe(sites[0].id);
    expect(Object.keys(json.data.sections)).toEqual([
      "googleSearchCompliance",
      "adSenseCompliance",
      "technicalSeo",
      "contentQuality",
      "websiteReadiness",
      "trafficQuality",
      "policyUpdates",
      "publishingApprovals"
    ]);
  });
});

