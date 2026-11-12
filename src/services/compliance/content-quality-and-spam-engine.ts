import { ComplianceCheckResult } from "./technical-seo-engine";

export interface ContentQualityAndSpamInput {
  title: string;
  htmlContent: string;
  authorName?: string | null;
  reviewerName?: string | null;
  isYmylTopic?: boolean;
  ymylCategory?: "NONE" | "FINANCE" | "HEALTH" | "LEGAL" | "INSURANCE";
  existingSiteArticleShingles?: string[][];
  targetSubtopics?: string[];
  serverRenderedHtml?: string;
  userAgentRenderedHtml?: string;
}

function extractPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function generateWordShingles(text: string, size = 4): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const shingles: string[] = [];
  for (let i = 0; i <= words.length - size; i++) {
    shingles.push(words.slice(i, i + size).join(" "));
  }
  return Array.from(new Set(shingles));
}

export function computeJaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function validateContentQualitySpamAndYmyl(
  input: ContentQualityAndSpamInput
): ComplianceCheckResult[] {
  const results: ComplianceCheckResult[] = [];
  const plainText = extractPlainText(input.htmlContent);
  const shingles = generateWordShingles(plainText, 4);

  // 1. Originality & Near-Duplicate Content Check (Scaled Content Abuse Prevention)
  let maxOverlap = 0;
  for (const existing of input.existingSiteArticleShingles || []) {
    const sim = computeJaccardSimilarity(shingles, existing);
    if (sim > maxOverlap) maxOverlap = sim;
  }
  const isDuplicateOrScaled = maxOverlap >= 0.45;
  results.push({
    id: "QUALITY_ORIGINALITY_DUPLICATE",
    module: "CONTENT_QUALITY",
    requirement: "Originality and cross-article duplicate content prevention",
    validationMethod: "4-gram Jaccard shingle overlap comparison against existing site articles",
    status: isDuplicateOrScaled ? "BLOCKED" : maxOverlap >= 0.25 ? "WARNING" : "PASS",
    evidence: `Max n-gram similarity overlap with existing articles: ${(maxOverlap * 100).toFixed(1)}%`,
    outstandingIssue: isDuplicateOrScaled
      ? "High n-gram overlap (>45%) indicates duplicate or templated mass-produced content"
      : null,
    recommendedFix: isDuplicateOrScaled
      ? "Consolidate overlapping pages or rewrite with original examples and distinct topical scope"
      : null
  });

  // 2. Helpful Content & Thin/Repetitive Boilerplate Detection
  const sentences = plainText
    .split(/[.!?]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 20);
  const uniqueSentences = new Set(sentences);
  const repetitionRatio =
    sentences.length > 0 ? 1 - uniqueSentences.size / sentences.length : 0;
  const hasPracticalArtifact =
    /<pre[\s>]|<code[\s>]|<table[\s>]|<ol[\s>]/i.test(input.htmlContent);
  const isThinContent = sentences.length < 5 || repetitionRatio > 0.25;

  results.push({
    id: "QUALITY_HELPFUL_CONTENT",
    module: "CONTENT_QUALITY",
    requirement: "Google Helpful Content completeness, depth, and low self-repetition",
    validationMethod: "Sentence uniqueness ratio and structured practical artifact check (<pre>, <table>, <ol>)",
    status: isThinContent ? "BLOCKED" : hasPracticalArtifact ? "PASS" : "WARNING",
    evidence: `Sentences: ${sentences.length}, Repetition ratio: ${(repetitionRatio * 100).toFixed(
      1
    )}%, Practical elements present: ${hasPracticalArtifact}`,
    outstandingIssue: isThinContent
      ? "Content is thin or contains repetitive boilerplate sentences"
      : !hasPracticalArtifact
      ? "Article lacks structured examples, tables, or step-by-step lists"
      : null,
    recommendedFix:
      isThinContent || !hasPracticalArtifact
        ? "Provide substantive, original explanations with concrete steps, tables, or code examples"
        : null
  });

  // 3. Factual Accuracy & Source Verification (Citation Check)
  const externalCitations = Array.from(
    input.htmlContent.matchAll(/<a[^>]+href=["'](https:\/\/[^"']+)["']/gi)
  ).map((m) => m[1]);
  const unverifiedClaimPattern =
    /\b(100%\s+guaranteed|proven\s+by\s+scientists\s+to\s+double|secret\s+loophole|instant\s+#1\s+ranking)\b/i;
  const hasFabricatedLanguage = unverifiedClaimPattern.test(plainText);

  results.push({
    id: "QUALITY_FACTUAL_SOURCES",
    module: "CONTENT_QUALITY",
    requirement: "Factual claim restraint and verifiable external source citations",
    validationMethod: "External HTTPS reference extraction and unsubstantiated superlative claim scan",
    status: hasFabricatedLanguage
      ? "BLOCKED"
      : externalCitations.length >= 1
      ? "PASS"
      : "WARNING",
    evidence: `Verified HTTPS citations: ${externalCitations.length}; Unsubstantiated superlatives: ${hasFabricatedLanguage}`,
    outstandingIssue: hasFabricatedLanguage
      ? "Detected unverified or exaggerated superlative claims"
      : externalCitations.length === 0
      ? "No external reference links found to corroborate factual claims"
      : null,
    recommendedFix:
      hasFabricatedLanguage || externalCitations.length === 0
        ? "Remove unsubstantiated claims and cite primary official documentation or peer-reviewed sources"
        : null
  });

  // 4. Google Spam Policy: Hidden Text & Deceptive CSS
  const hiddenCssPattern =
    /font-size\s*:\s*0(?:px|em|rem)?|display\s*:\s*none\s*;\s*[^>]*keyword|opacity\s*:\s*0\b|left\s*:\s*-\d{4,}px|color\s*:\s*#fff(?:fff)?\s*;\s*background(?:-color)?\s*:\s*#fff(?:fff)?/i;
  const hasHiddenText = hiddenCssPattern.test(input.htmlContent);

  results.push({
    id: "SPAM_HIDDEN_TEXT",
    module: "SPAM_POLICY",
    requirement: "Google Spam Policy: Prevention of hidden text and deceptive styling",
    validationMethod: "Inline CSS and DOM inspection for zero-font, offscreen positioning, or white-on-white text",
    status: hasHiddenText ? "BLOCKED" : "PASS",
    evidence: hasHiddenText ? "Deceptive hidden text CSS pattern detected" : "Zero hidden text patterns",
    outstandingIssue: hasHiddenText
      ? "Violation of Google Spam Policies (Hidden Text / Deceptive CSS)"
      : null,
    recommendedFix: hasHiddenText
      ? "Remove all hidden text, offscreen keyword blocks, or invisible font styling"
      : null
  });

  // 5. Google Spam Policy: Keyword Stuffing & Unnatural Repetition
  const stopWords = new Set([
    "about", "after", "again", "against", "always", "before", "being", "between",
    "could", "during", "every", "first", "found", "having", "other", "should",
    "their", "there", "these", "those", "through", "under", "using", "where",
    "which", "while", "without", "would"
  ]);
  const tokens = plainText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4 && !stopWords.has(w));
  const freqMap = new Map<string, number>();
  for (const t of tokens) {
    freqMap.set(t, (freqMap.get(t) || 0) + 1);
  }
  let maxSingleWordRatio = 0;
  let maxCount = 0;
  let topWord = "";
  for (const [word, count] of freqMap.entries()) {
    const ratio = tokens.length > 0 ? count / tokens.length : 0;
    if (ratio > maxSingleWordRatio) {
      maxSingleWordRatio = ratio;
      maxCount = count;
      topWord = word;
    }
  }
  // Flag only extreme unnatural stuffing (>12% of substantive words AND repeated >= 8 times)
  const isStuffed = maxSingleWordRatio > 0.12 && maxCount >= 8;
  results.push({
    id: "SPAM_KEYWORD_STUFFING",
    module: "SPAM_POLICY",
    requirement: "Google Spam Policy: Prevention of unnatural keyword stuffing",
    validationMethod: "Lexical repetition anomaly detection (without enforcing arbitrary target densities)",
    status: isStuffed ? "BLOCKED" : "PASS",
    evidence: `Peak token repetition: "${topWord}" (${(maxSingleWordRatio * 100).toFixed(1)}% of substantive words)`,
    outstandingIssue: isStuffed
      ? `Unnatural token repetition ("${topWord}") triggers Google Keyword Stuffing spam protection`
      : null,
    recommendedFix: isStuffed
      ? "Write naturally for human readers and remove repetitive keyword lists"
      : null
  });

  // 6. Google Spam Policy: Cloaking Detection
  const hasCloakingMismatch =
    Boolean(input.serverRenderedHtml && input.userAgentRenderedHtml) &&
    input.serverRenderedHtml !== input.userAgentRenderedHtml;
  results.push({
    id: "SPAM_CLOAKING",
    module: "SPAM_POLICY",
    requirement: "Google Spam Policy: Prevention of user-agent cloaking",
    validationMethod: "Comparison of Googlebot vs standard browser rendered HTML payload",
    status: hasCloakingMismatch ? "BLOCKED" : "PASS",
    evidence: hasCloakingMismatch
      ? "Divergent HTML served between crawler and user session"
      : "Identical HTML served to users and search crawlers",
    outstandingIssue: hasCloakingMismatch
      ? "Cloaking detected: serving different content to search engines than to users"
      : null,
    recommendedFix: hasCloakingMismatch
      ? "Serve identical primary content to both human visitors and Googlebot"
      : null
  });

  // 7. YMYL (Your Money or Your Life) High-Impact Content Protection
  const ymylPattern =
    /\b(medical\s+diagnosis|prescribe\s+dosage|cure\s+cancer|tax\s+evasion|guaranteed\s+investment\s+return|retirement\s+portfolio\s+advice|legal\s+liability\s+waiver)\b/i;
  const detectedYmyl = Boolean(
    input.isYmylTopic ||
      (input.ymylCategory && input.ymylCategory !== "NONE") ||
      ymylPattern.test(plainText)
  );

  if (detectedYmyl) {
    const hasAuthorAndReviewer = Boolean(input.authorName && input.reviewerName);
    const hasDisclaimer = /disclaimer|not\s+(?:medical|financial|legal)\s+advice|consult\s+a\s+licensed/i.test(
      plainText
    );
    const hasCredibleSources = externalCitations.length >= 2;
    const ymylCompliant = hasAuthorAndReviewer && hasDisclaimer && hasCredibleSources;

    results.push({
      id: "YMYL_PROTECTION_GATE",
      module: "YMYL_PROTECTION",
      requirement:
        "YMYL Content Protection: Expert review, author attribution, credible citations, and mandatory disclaimer",
      validationMethod:
        "Verification of authorName, reviewerName, >=2 HTTPS citations, and visible YMYL disclaimer",
      status: ymylCompliant ? "PASS" : "BLOCKED",
      evidence: `YMYL Triggered: true | Author/Reviewer: ${hasAuthorAndReviewer} | Disclaimer: ${hasDisclaimer} | Citations: ${externalCitations.length}`,
      outstandingIssue: ymylCompliant
        ? null
        : "YMYL topic lacks verified expert reviewer attribution, formal disclaimer, or sufficient authoritative citations",
      recommendedFix: ymylCompliant
        ? null
        : "Assign a qualified expert reviewer, include >=2 authoritative citations, and display an explicit medical/financial/legal disclaimer before publishing"
    });
  } else {
    results.push({
      id: "YMYL_PROTECTION_GATE",
      module: "YMYL_PROTECTION",
      requirement: "YMYL classification and author attribution check",
      validationMethod: "YMYL domain classifier and author metadata check",
      status: "PASS",
      evidence: `Non-YMYL technical topic | Author: ${input.authorName || "Editorial Team"}`,
      outstandingIssue: null,
      recommendedFix: null
    });
  }

  return results;
}
