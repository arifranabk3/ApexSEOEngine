import { describe, it, expect } from "vitest";
import {
  validateTechnicalSeo,
  generateXmlSitemap
} from "@/services/compliance/technical-seo-engine";
import { validateOnPageSeo } from "@/services/compliance/onpage-seo-engine";
import {
  validateContentQualitySpamAndYmyl,
  generateWordShingles
} from "@/services/compliance/content-quality-and-spam-engine";
import {
  validatePageExperience,
  buildCompliantStructuredDataGraph,
  validateStructuredDataParity
} from "@/services/compliance/page-experience-and-schema-engine";
import {
  evaluateGoogleSearchComplianceGate,
  OFFICIAL_GOOGLE_API_QUOTAS
} from "@/services/compliance/seo-quality-gate";

const COMPLIANT_ARTICLE_HTML = `<!DOCTYPE html>
<html lang="en-US">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="canonical" href="https://apextech.example.com/self-hosted-ai-blog-automation-n8n-ollama-docker" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        "headline": "How to Build a Self-Hosted AI Blog Automation Stack with n8n, Ollama & PostgreSQL",
        "description": "Complete engineering guide to running n8n, Ollama, and PostgreSQL in Docker Compose."
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://apextech.example.com" }
        ]
      }
    ]
  }
  </script>
</head>
<body>
  <main>
    <nav aria-label="breadcrumb"><a href="/guides">Guides</a></nav>
    <article>
      <h1>How to Build a Self-Hosted AI Blog Automation Stack with n8n, Ollama &amp; PostgreSQL</h1>
      <p>Combining self-hosted n8n Community Edition with local Ollama models and PostgreSQL 16 eliminates recurring cloud token fees while preserving editorial governance.</p>
      <p>Every container communicates over an isolated bridge subnet so database credentials and local language model endpoints remain completely private.</p>
      <figure>
        <img src="/images/architecture.webp" alt="Architecture diagram of n8n, Ollama, and PostgreSQL inside Docker Compose" width="1200" height="630" fetchpriority="high" decoding="async" />
      </figure>
      <h2>Step 1: Configure the Docker Compose Network</h2>
      <p>Place each service on an isolated bridge network so internal containers resolve each other by service name without exposing database ports.</p>
      <pre><code>docker compose up -d</code></pre>
      <p>Read our companion tutorial on <a href="/fix-n8n-ollama-connection-refused">fixing port 11434 connection errors</a> and consult the <a href="https://docs.n8n.io/hosting/" target="_blank" rel="noopener noreferrer">official n8n hosting documentation</a>.</p>
      <h2>Step 2: Validate Structured Outputs Before Publishing</h2>
      <p>Always pass a JSON schema to the local model endpoint so every response adheres to your database structure before creating a WordPress draft.</p>
      <p>By storing each revision snapshot in PostgreSQL before calling the WordPress REST API, editors can review and verify every technical tutorial before publication.</p>
    </article>
  </main>
</body>
</html>`;

describe("Google Search Compliance Engine & Publishing Quality Gate Suite", () => {
  it("1. Technical SEO Engine: validates HTTPS, HTTP 200, robots.txt, meta robots, canonicals, broken links, and XML sitemap", () => {
    const passing = validateTechnicalSeo({
      pageUrl:
        "https://apextech.example.com/self-hosted-ai-blog-automation-n8n-ollama-docker",
      httpStatusCode: 200,
      htmlContent: COMPLIANT_ARTICLE_HTML
    });
    expect(passing.every((c) => c.status === "PASS")).toBe(true);

    const failing = validateTechnicalSeo({
      pageUrl: "http://apextech.example.com/bad-page",
      httpStatusCode: 404,
      redirectChainUrls: ["http://a.com", "http://b.com", "http://a.com"],
      robotsTxtContent: "User-agent: *\nDisallow: /",
      metaRobotsTag: "noindex, nofollow",
      htmlContent: `<a href="javascript:void(0)">Broken</a>`
    });
    const blockedIds = failing.filter((c) => c.status === "BLOCKED").map((c) => c.id);
    expect(blockedIds).toContain("TECH_HTTPS");
    expect(blockedIds).toContain("TECH_HTTP_STATUS");
    expect(blockedIds).toContain("TECH_REDIRECTS");
    expect(blockedIds).toContain("TECH_ROBOTS_TXT");
    expect(blockedIds).toContain("TECH_INDEXABILITY");
    expect(blockedIds).toContain("TECH_BROKEN_LINKS");
    expect(blockedIds).toContain("TECH_JS_RENDERING");

    const xml = generateXmlSitemap([
      {
        url: "https://apextech.example.com/self-hosted-ai-blog-automation-n8n-ollama-docker",
        lastModIso: "2026-11-12"
      }
    ]);
    expect(xml).toContain("<loc>https://apextech.example.com/self-hosted-ai-blog-automation-n8n-ollama-docker</loc>");
  });

  it("2. On-Page SEO Engine: validates unique titles, H1/H2 hierarchy, descriptive slugs, alt text, and breadcrumbs without arbitrary density quotas", () => {
    const results = validateOnPageSeo({
      title: "Self-Hosted AI Blog Automation: n8n, Ollama & Docker",
      existingTitlesOnSite: ["Unrelated Existing Article Title"],
      metaDescription:
        "Learn how to build a self-hosted AI blog automation stack using Docker Compose, n8n Community Edition, local Ollama LLMs, and PostgreSQL.",
      slug: "self-hosted-ai-blog-automation-n8n-ollama-docker",
      searchIntent: "INFORMATIONAL",
      htmlContent: COMPLIANT_ARTICLE_HTML,
      hasBreadcrumbMarkupOrNav: true
    });
    expect(results.every((r) => r.status === "PASS")).toBe(true);

    const duplicateTitleResult = validateOnPageSeo({
      title: "Duplicate Title",
      existingTitlesOnSite: ["Duplicate Title"],
      metaDescription: "Short",
      slug: "post-123",
      searchIntent: "INFORMATIONAL",
      htmlContent: "<p>No H1 heading here</p><img src='/test.jpg' />"
    });
    expect(
      duplicateTitleResult.find((r) => r.id === "ONPAGE_UNIQUE_TITLE")?.status
    ).toBe("BLOCKED");
    expect(
      duplicateTitleResult.find((r) => r.id === "ONPAGE_HEADING_STRUCTURE")?.status
    ).toBe("BLOCKED");
  });

  it("3 & 4 & 8. Content Quality, Google Spam Policy & YMYL Protection Engine: blocks duplicate content, hidden text, keyword stuffing, cloaking, and unverified YMYL claims", () => {
    const cleanResults = validateContentQualitySpamAndYmyl({
      title: "How to Build a Self-Hosted AI Blog Automation Stack",
      htmlContent: COMPLIANT_ARTICLE_HTML,
      authorName: "Principal SEO Architect"
    });
    expect(cleanResults.every((r) => r.status === "PASS")).toBe(true);

    // Test Spam & YMYL Violations
    const existingShingles = [generateWordShingles(COMPLIANT_ARTICLE_HTML, 4)];
    const spamHtml = `
      <div style="font-size:0px; display:none">keyword hidden text</div>
      <p>Medical diagnosis and prescribe dosage for guaranteed investment return! 100% guaranteed secret loophole!</p>
      <p>${"forex ".repeat(65)}</p>
    `;

    const spamAndYmylResults = validateContentQualitySpamAndYmyl({
      title: "Spam & YMYL Test",
      htmlContent: spamHtml,
      isYmylTopic: true,
      ymylCategory: "HEALTH",
      existingSiteArticleShingles: existingShingles,
      serverRenderedHtml: "<h1>Version A for Googlebot</h1>",
      userAgentRenderedHtml: "<h1>Version B for Users</h1>"
    });

    const blocked = spamAndYmylResults
      .filter((r) => r.status === "BLOCKED")
      .map((r) => r.id);

    expect(blocked).toContain("QUALITY_FACTUAL_SOURCES");
    expect(blocked).toContain("SPAM_HIDDEN_TEXT");
    expect(blocked).toContain("SPAM_KEYWORD_STUFFING");
    expect(blocked).toContain("SPAM_CLOAKING");
    expect(blocked).toContain("YMYL_PROTECTION_GATE");
  });

  it("5 & 6. Page Experience & Structured Data Engine: validates CWV readiness, never fabricates scores, and enforces JSON-LD visible content parity", () => {
    const expStatic = validatePageExperience({
      htmlContent: COMPLIANT_ARTICLE_HTML
    });
    expect(expStatic.every((r) => r.status === "PASS")).toBe(true);

    const expRealPoor = validatePageExperience({
      htmlContent: COMPLIANT_ARTICLE_HTML,
      realTelemetry: {
        lcpMs: 4800,
        inpMs: 600,
        clsScore: 0.35,
        source: "PAGESPEED_INSIGHTS_API"
      }
    });
    expect(expRealPoor.find((r) => r.id === "EXP_CORE_WEB_VITALS")?.status).toBe(
      "BLOCKED"
    );

    const schemaGraph = buildCompliantStructuredDataGraph({
      schemaType: "TechArticle",
      headline: "How to Build a Self-Hosted AI Blog Automation Stack",
      description: "Guide description",
      canonicalUrl: "https://apextech.example.com/guide",
      datePublishedIso: "2026-11-12T00:00:00Z",
      dateModifiedIso: "2026-11-12T00:00:00Z",
      authorName: "Apex Tech Journal",
      organizationName: "Apex Tech Journal",
      organizationUrl: "https://apextech.example.com",
      breadcrumbs: [{ name: "Home", url: "https://apextech.example.com" }]
    });
    expect(schemaGraph["@graph"].length).toBe(4);

    const misleadingSchemaHtml = `
      <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Article","headline":"Completely Different Unseen Headline"}
      </script>
      <h1>Actual Visible Page Heading</h1>
    `;
    const parityCheck = validateStructuredDataParity(misleadingSchemaHtml);
    expect(parityCheck[0].status).toBe("BLOCKED");
  });

  it("7 & 9. Google Integrations & Master SEO Quality Gate: returns PASS for compliant articles and BLOCKED when critical issues exist", () => {
    expect(OFFICIAL_GOOGLE_API_QUOTAS.URL_INSPECTION_API.dailyLimitPerProperty).toBe(2000);
    expect(OFFICIAL_GOOGLE_API_QUOTAS.URL_INSPECTION_API.simulatesIndexing).toBe(false);

    const passReport = evaluateGoogleSearchComplianceGate({
      technical: {
        pageUrl:
          "https://apextech.example.com/self-hosted-ai-blog-automation-n8n-ollama-docker",
        httpStatusCode: 200,
        htmlContent: COMPLIANT_ARTICLE_HTML
      },
      onPage: {
        title: "Self-Hosted AI Blog Automation: n8n, Ollama & Docker",
        metaDescription:
          "Learn how to build a self-hosted AI blog automation stack using Docker Compose, n8n Community Edition, local Ollama LLMs, and PostgreSQL.",
        slug: "self-hosted-ai-blog-automation-n8n-ollama-docker",
        searchIntent: "INFORMATIONAL",
        htmlContent: COMPLIANT_ARTICLE_HTML,
        hasBreadcrumbMarkupOrNav: true
      },
      qualityAndSpam: {
        title: "Self-Hosted AI Blog Automation: n8n, Ollama & Docker",
        htmlContent: COMPLIANT_ARTICLE_HTML,
        authorName: "Principal SEO Architect"
      },
      pageExperience: {
        htmlContent: COMPLIANT_ARTICLE_HTML
      }
    });

    expect(passReport.overallGateStatus).toBe("PASS");
    expect(passReport.canAutoPublish).toBe(true);
    expect(passReport.summaryCounts.blocked).toBe(0);
    expect(passReport.disclaimer).toContain("does not represent official Google approval");
  });
});
