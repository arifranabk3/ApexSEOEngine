export type GateStatus = "PASS" | "WARNING" | "BLOCKED";

export interface ComplianceCheckResult {
  id: string;
  module:
    | "TECHNICAL_SEO"
    | "ON_PAGE_SEO"
    | "CONTENT_QUALITY"
    | "SPAM_POLICY"
    | "PAGE_EXPERIENCE"
    | "STRUCTURED_DATA"
    | "GOOGLE_INTEGRATIONS"
    | "YMYL_PROTECTION";
  requirement: string;
  validationMethod: string;
  status: GateStatus;
  evidence: string;
  outstandingIssue: string | null;
  recommendedFix: string | null;
}

export interface TechnicalSeoInput {
  pageUrl: string;
  httpStatusCode?: number;
  redirectChainUrls?: string[];
  canonicalUrl?: string | null;
  robotsTxtContent?: string;
  metaRobotsTag?: string | null;
  xRobotsTagHeader?: string | null;
  htmlContent: string;
  requiresClientJsForMainContent?: boolean;
  knownSiteUrls?: string[];
}

export function validateTechnicalSeo(input: TechnicalSeoInput): ComplianceCheckResult[] {
  const results: ComplianceCheckResult[] = [];

  // 1. HTTPS Verification
  let isHttps = false;
  try {
    const parsed = new URL(input.pageUrl);
    isHttps = parsed.protocol === "https:";
  } catch {
    isHttps = false;
  }
  results.push({
    id: "TECH_HTTPS",
    module: "TECHNICAL_SEO",
    requirement: "HTTPS protocol verification",
    validationMethod: "URL scheme parser check for https://",
    status: isHttps ? "PASS" : "BLOCKED",
    evidence: `Target URL: ${input.pageUrl}`,
    outstandingIssue: isHttps ? null : "Page URL does not use encrypted HTTPS protocol",
    recommendedFix: isHttps ? null : "Serve all canonical URLs over https:// with valid TLS"
  });

  // 2. HTTP Status Validation
  const statusCode = input.httpStatusCode ?? 200;
  const httpStatusOk = statusCode === 200;
  results.push({
    id: "TECH_HTTP_STATUS",
    module: "TECHNICAL_SEO",
    requirement: "HTTP 200 status validation for indexable pages",
    validationMethod: "HTTP response status code inspection",
    status: httpStatusOk ? "PASS" : "BLOCKED",
    evidence: `HTTP Status: ${statusCode}`,
    outstandingIssue: httpStatusOk ? null : `Non-200 HTTP status code (${statusCode}) prevents indexing`,
    recommendedFix: httpStatusOk ? null : "Ensure indexable target pages return HTTP 200 OK"
  });

  // 3. Redirect Chain Validation
  const hops = input.redirectChainUrls?.length ?? 0;
  const hasLoop =
    input.redirectChainUrls &&
    new Set(input.redirectChainUrls).size !== input.redirectChainUrls.length;
  let redirectStatus: GateStatus = "PASS";
  if (hasLoop || hops > 2) redirectStatus = "BLOCKED";
  else if (hops > 0) redirectStatus = "WARNING";

  results.push({
    id: "TECH_REDIRECTS",
    module: "TECHNICAL_SEO",
    requirement: "Redirect chain and loop validation",
    validationMethod: "Hop count and circular URL detection across redirect chain",
    status: redirectStatus,
    evidence: `Redirect hops: ${hops}${hasLoop ? " (Loop detected)" : ""}`,
    outstandingIssue:
      redirectStatus === "PASS"
        ? null
        : hasLoop
        ? "Infinite redirect loop detected"
        : `Redirect chain contains ${hops} hop(s)`,
    recommendedFix:
      redirectStatus === "PASS"
        ? null
        : "Link directly to the final destination URL and eliminate multi-hop redirect chains"
  });

  // 4. Robots.txt Crawlability Validation
  const robotsTxt = input.robotsTxtContent ?? "User-agent: *\nAllow: /";
  const blocksAll = /Disallow:\s*\/\s*$/m.test(robotsTxt);
  results.push({
    id: "TECH_ROBOTS_TXT",
    module: "TECHNICAL_SEO",
    requirement: "Robots.txt crawlability check",
    validationMethod: "Directive parser checking for root Disallow: / blocks",
    status: blocksAll ? "BLOCKED" : "PASS",
    evidence: blocksAll ? "Found 'Disallow: /' in robots.txt" : "Googlebot allowed to crawl path",
    outstandingIssue: blocksAll ? "robots.txt blocks crawling of the entire site" : null,
    recommendedFix: blocksAll ? "Remove 'Disallow: /' so Googlebot can crawl public pages" : null
  });

  // 5. Meta Robots & X-Robots-Tag Indexability Validation
  const combinedRobots = `${input.metaRobotsTag || ""} ${input.xRobotsTagHeader || ""}`.toLowerCase();
  const hasNoindex = combinedRobots.includes("noindex");
  results.push({
    id: "TECH_INDEXABILITY",
    module: "TECHNICAL_SEO",
    requirement: "Meta robots and X-Robots-Tag indexability validation",
    validationMethod: "Inspection of meta[name=robots] and X-Robots-Tag for noindex directives",
    status: hasNoindex ? "BLOCKED" : "PASS",
    evidence: hasNoindex ? `Detected directive: ${combinedRobots.trim()}` : "Indexable (no noindex directive)",
    outstandingIssue: hasNoindex ? "Page contains 'noindex' directive blocking Google Search indexing" : null,
    recommendedFix: hasNoindex ? "Remove 'noindex' from meta robots and HTTP headers before publishing" : null
  });

  // 6. Canonical URL Validation
  const canonicalInHtml =
    input.htmlContent.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ||
    input.canonicalUrl;
  const canonicalValid = Boolean(canonicalInHtml && canonicalInHtml.startsWith("https://"));
  results.push({
    id: "TECH_CANONICAL",
    module: "TECHNICAL_SEO",
    requirement: "Canonical URL presence and HTTPS format validation",
    validationMethod: "HTML <link rel='canonical'> extraction and absolute URL verification",
    status: canonicalValid ? "PASS" : "WARNING",
    evidence: canonicalInHtml ? `Canonical: ${canonicalInHtml}` : "No canonical link element found",
    outstandingIssue: canonicalValid ? null : "Missing or non-HTTPS self-referencing canonical URL",
    recommendedFix: canonicalValid
      ? null
      : "Include an absolute https:// <link rel='canonical' href='...' /> tag in <head>"
  });

  // 7. Broken Link Detection (Anchor href inspection)
  const hrefMatches = Array.from(input.htmlContent.matchAll(/<a[^>]+href=["']([^"']*)["']/gi)).map(
    (m) => m[1].trim()
  );
  const brokenHrefs = hrefMatches.filter(
    (h) =>
      !h ||
      h === "#" ||
      h.toLowerCase().startsWith("javascript:") ||
      h.includes("undefined") ||
      h.includes("null")
  );
  results.push({
    id: "TECH_BROKEN_LINKS",
    module: "TECHNICAL_SEO",
    requirement: "Crawlable anchor links and broken link detection",
    validationMethod: "DOM <a href> extraction checking for empty, javascript:, or malformed URLs",
    status: brokenHrefs.length === 0 ? "PASS" : "BLOCKED",
    evidence: `Inspected ${hrefMatches.length} link(s); ${brokenHrefs.length} invalid/broken link(s)`,
    outstandingIssue:
      brokenHrefs.length === 0
        ? null
        : `Found ${brokenHrefs.length} non-crawlable or broken anchor href(s): ${brokenHrefs.join(", ")}`,
    recommendedFix:
      brokenHrefs.length === 0
        ? null
        : "Use standard <a href='https://...'> or valid relative paths per Google Search Essentials"
  });

  // 8. Mobile Responsiveness Check
  const hasViewport = /<meta[^>]+name=["']viewport["'][^>]+content=["'][^"']*width=device-width/i.test(
    input.htmlContent
  );
  results.push({
    id: "TECH_MOBILE_VIEWPORT",
    module: "TECHNICAL_SEO",
    requirement: "Mobile responsiveness viewport configuration",
    validationMethod: "HTML <meta name='viewport' content='width=device-width...'> verification",
    status: hasViewport ? "PASS" : "WARNING",
    evidence: hasViewport ? "Responsive viewport meta tag present" : "Missing responsive viewport meta tag",
    outstandingIssue: hasViewport ? null : "Missing viewport meta tag for mobile-first indexing",
    recommendedFix: hasViewport
      ? null
      : "Add <meta name='viewport' content='width=device-width, initial-scale=1' />"
  });

  // 9. JavaScript Rendering Check (SSR / Static HTML Primary Content)
  const bodyText = input.htmlContent
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const jsDependent = Boolean(input.requiresClientJsForMainContent || bodyText.length < 120);
  results.push({
    id: "TECH_JS_RENDERING",
    module: "TECHNICAL_SEO",
    requirement: "Server-side rendered HTML availability without client-side JS dependency",
    validationMethod: "Static HTML text extraction excluding <script> tags",
    status: jsDependent ? "BLOCKED" : "PASS",
    evidence: `Static server-rendered text length: ${bodyText.length} chars`,
    outstandingIssue: jsDependent
      ? "Core article content is not present in initial server-rendered HTML"
      : null,
    recommendedFix: jsDependent
      ? "Render primary article text and headings in static/SSR HTML rather than client-only JS"
      : null
  });

  return results;
}

/**
 * Generates a standards-compliant XML Sitemap for indexable website URLs.
 */
export function generateXmlSitemap(
  entries: Array<{ url: string; lastModIso?: string }>
): string {
  const urlNodes = entries
    .filter((e) => e.url.startsWith("https://"))
    .map(
      (e) => `  <url>
    <loc>${e.url.replace(/&/g, "&amp;")}</loc>
    <lastmod>${(e.lastModIso || new Date().toISOString()).slice(0, 10)}</lastmod>
  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlNodes}
</urlset>`;
}

