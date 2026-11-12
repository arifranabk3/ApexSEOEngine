import { ComplianceCheckResult, GateStatus } from "./technical-seo-engine";

export interface OnPageSeoInput {
  title: string;
  existingTitlesOnSite?: string[];
  metaDescription: string;
  slug: string;
  searchIntent: "INFORMATIONAL" | "COMMERCIAL" | "TRANSACTIONAL" | "NAVIGATIONAL";
  htmlContent: string;
  hasBreadcrumbMarkupOrNav?: boolean;
}

/**
 * Validates On-Page SEO against Google's SEO Starter Guide.
 * Strictly DOES NOT enforce arbitrary keyword density percentages or fixed minimum word counts.
 */
export function validateOnPageSeo(input: OnPageSeoInput): ComplianceCheckResult[] {
  const results: ComplianceCheckResult[] = [];

  // 1. Unique, Descriptive Page Title
  const trimmedTitle = input.title.trim();
  const isDuplicateTitle = (input.existingTitlesOnSite || []).some(
    (t) => t.trim().toLowerCase() === trimmedTitle.toLowerCase()
  );
  const titleValid = trimmedTitle.length >= 15 && trimmedTitle.length <= 75 && !isDuplicateTitle;
  results.push({
    id: "ONPAGE_UNIQUE_TITLE",
    module: "ON_PAGE_SEO",
    requirement: "Unique and descriptive <title> element",
    validationMethod: "Title length check and cross-site duplicate title comparison",
    status: isDuplicateTitle ? "BLOCKED" : titleValid ? "PASS" : "WARNING",
    evidence: `Title (${trimmedTitle.length} chars): "${trimmedTitle}"`,
    outstandingIssue: isDuplicateTitle
      ? "Title duplicates an existing page on the same website"
      : titleValid
      ? null
      : "Title is either too brief (<15 chars) or may truncate in SERPs (>75 chars)",
    recommendedFix: isDuplicateTitle
      ? "Assign a distinct title that uniquely describes this specific page's topic"
      : titleValid
      ? null
      : "Write a clear, concise title between 15 and 70 characters"
  });

  // 2. Meta Description Presence & Usefulness
  const desc = input.metaDescription.trim();
  const descOk = desc.length >= 50 && desc.length <= 170;
  results.push({
    id: "ONPAGE_META_DESCRIPTION",
    module: "ON_PAGE_SEO",
    requirement: "Informative meta description summarizing page content",
    validationMethod: "Meta description presence and snippet length check",
    status: desc.length === 0 ? "WARNING" : descOk ? "PASS" : "WARNING",
    evidence: `Meta description length: ${desc.length} chars`,
    outstandingIssue:
      desc.length === 0
        ? "Missing meta description"
        : descOk
        ? null
        : "Meta description outside recommended 50–170 character summary window",
    recommendedFix: descOk
      ? null
      : "Provide a natural 1–2 sentence summary of what the reader will learn or accomplish"
  });

  // 3. Heading Structure (H1 / H2 / H3 Hierarchy)
  const h1Count = (input.htmlContent.match(/<h1[\s>]/gi) || []).length;
  const h2Count = (input.htmlContent.match(/<h2[\s>]/gi) || []).length;
  const headingStatus: GateStatus =
    h1Count === 1 && h2Count >= 1 ? "PASS" : h1Count === 0 ? "BLOCKED" : "WARNING";
  results.push({
    id: "ONPAGE_HEADING_STRUCTURE",
    module: "ON_PAGE_SEO",
    requirement: "Semantic H1/H2/H3 heading hierarchy",
    validationMethod: "HTML heading tag tree parser",
    status: headingStatus,
    evidence: `Detected H1 count: ${h1Count}, H2 count: ${h2Count}`,
    outstandingIssue:
      headingStatus === "PASS"
        ? null
        : h1Count === 0
        ? "Missing primary <h1> heading"
        : "Multiple <h1> tags or missing <h2> section headings",
    recommendedFix:
      headingStatus === "PASS"
        ? null
        : "Use a single descriptive <h1> and organize subtopics with logical <h2> and <h3> headings"
  });

  // 4. Descriptive, Human-Readable URL Slug
  const slugOk = /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(input.slug) && !/^(page|post|id)-\d+$/.test(input.slug);
  results.push({
    id: "ONPAGE_DESCRIPTIVE_URL",
    module: "ON_PAGE_SEO",
    requirement: "Descriptive, human-readable URL slug (SEO Starter Guide)",
    validationMethod: "Slug pattern validation checking for lowercase hyphenated words vs opaque IDs",
    status: slugOk ? "PASS" : "WARNING",
    evidence: `Slug: /${input.slug}`,
    outstandingIssue: slugOk ? null : "URL slug is non-descriptive, single-word, or contains invalid characters",
    recommendedFix: slugOk
      ? null
      : "Use descriptive lowercase words separated by hyphens (e.g., /self-hosted-ai-blog-stack)"
  });

  // 5. Image Alt Text Verification
  const imgTags = Array.from(input.htmlContent.matchAll(/<img\b[^>]*>/gi)).map((m) => m[0]);
  const missingAlt = imgTags.filter((tag) => {
    const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
    return !altMatch || altMatch[1].trim().length < 5;
  });
  results.push({
    id: "ONPAGE_IMAGE_ALT",
    module: "ON_PAGE_SEO",
    requirement: "Descriptive alt attributes on all content images",
    validationMethod: "Inspection of all <img> elements for non-empty alt attributes",
    status: missingAlt.length === 0 ? "PASS" : "WARNING",
    evidence: `Total <img> elements: ${imgTags.length}, missing descriptive alt: ${missingAlt.length}`,
    outstandingIssue:
      missingAlt.length === 0 ? null : `${missingAlt.length} image(s) lack descriptive alt text`,
    recommendedFix:
      missingAlt.length === 0
        ? null
        : "Add concise, contextually accurate alt attributes describing each visual element"
  });

  // 6. Contextual Internal & External Links
  const anchorTags = Array.from(
    input.htmlContent.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)
  );
  const internalLinks = anchorTags.filter(
    (m) => m[1].startsWith("/") || m[1].includes("apextech.example.com")
  );
  const externalLinks = anchorTags.filter(
    (m) => m[1].startsWith("https://") && !m[1].includes("apextech.example.com")
  );
  const genericAnchors = anchorTags.filter((m) =>
    /^(click here|read more|link|here)$/i.test(m[2].replace(/<[^>]+>/g, "").trim())
  );

  results.push({
    id: "ONPAGE_LINKS_AND_REFERENCES",
    module: "ON_PAGE_SEO",
    requirement: "Descriptive internal links and verifiable external references",
    validationMethod: "Anchor href classification and generic anchor text check",
    status:
      genericAnchors.length > 0
        ? "WARNING"
        : internalLinks.length > 0 && externalLinks.length > 0
        ? "PASS"
        : "WARNING",
    evidence: `Internal links: ${internalLinks.length}, External references: ${externalLinks.length}, Generic anchors: ${genericAnchors.length}`,
    outstandingIssue:
      genericAnchors.length > 0
        ? "Contains non-descriptive 'click here' / 'read more' anchor text"
        : internalLinks.length === 0 || externalLinks.length === 0
        ? "Missing contextual internal links or external reference citations"
        : null,
    recommendedFix:
      genericAnchors.length === 0 && internalLinks.length > 0 && externalLinks.length > 0
        ? null
        : "Use descriptive anchor text and link to relevant internal cluster pages and official external documentation"
  });

  // 7. Breadcrumb Navigation Readiness
  const hasBreadcrumbs =
    Boolean(input.hasBreadcrumbMarkupOrNav) ||
    input.htmlContent.includes("BreadcrumbList") ||
    /aria-label=["']breadcrumb["']/i.test(input.htmlContent);
  results.push({
    id: "ONPAGE_BREADCRUMBS",
    module: "ON_PAGE_SEO",
    requirement: "Breadcrumb navigation or BreadcrumbList hierarchy support",
    validationMethod: "Detection of aria-label='breadcrumb' or BreadcrumbList JSON-LD",
    status: hasBreadcrumbs ? "PASS" : "WARNING",
    evidence: hasBreadcrumbs ? "Breadcrumb navigation/schema detected" : "No breadcrumb trail detected",
    outstandingIssue: hasBreadcrumbs ? null : "Breadcrumb hierarchy not present in page markup",
    recommendedFix: hasBreadcrumbs
      ? null
      : "Include visible breadcrumb navigation and matching BreadcrumbList structured data"
  });

  return results;
}

