/**
 * Factual Claim & Source Review Engine
 *
 * Implements strict, deterministic factual claim extraction, risk classification,
 * source audit checks, and human-in-the-loop review state management.
 *
 * CRITICAL RULE:
 * An LLM-generated answer is NOT evidence. A claim is UNVERIFIED or UNVERIFIABLE
 * unless verified against an accessible, corroborated, unmanipulated external source.
 * Never fabricate URLs, studies, citations, authors, or dates.
 */

import {
  FactualClaimItem,
  FactualReviewInput,
  FactualReviewReport,
  ClaimCategory,
  RiskLevel,
  VerificationStatus,
  SourceEvaluation
} from "./factual-claim-schemas";
import { validateSafeExternalUrl } from "./safe-url-validator";

const MANDATORY_DISCLAIMER =
  "Claims extracted and classified by internal factual editorial policies. LLM output does not constitute factual proof. External claims require primary source verification by human editors before publication.";

// Heuristics for claim categories
const STATISTICAL_PATTERNS = [
  /\b\d+(\.\d+)?%/i,
  /\b\d+([,.]\d+)?\s*(percent|percentage|users|customers|queries|transactions|nodes|clusters|seconds|milliseconds|ms|gb|tb|mb|kb|hours|days|x\b)/i,
  /\b(increased|decreased|grew|fell|dropped|surpassed|exceeded)\s+by\s+\d+/i
];

const FINANCIAL_PATTERNS = [
  /(\$|€|£|¥)\s*\d+([,.]\d+)?/i,
  /\b(revenue|roi|profit|cost|spend|arr|mrr|valuation|pricing|dollars|euros|cents|budget)\b/i,
  /\b(earns|earning|invest|investment|yield|dividend)\b/i
];

const HEALTH_SAFETY_PATTERNS = [
  /\b(cure|cures|treatment|diagnose|diagnosis|disease|medical|fda|clinical|dosage|vaccine|therapy|symptom|illness|infection)\b/i,
  /\b(toxic|hazardous|safety\s+hazard|poison|lethal|side\s+effects)\b/i
];

const LEGAL_REGULATORY_PATTERNS = [
  /\b(gdpr|ccpa|hipaa|dmca|compliance|lawsuit|illegal|unlawful|statute|regulatory|sec\s+filing|patent|copyright|infringement)\b/i,
  /\b(terms\s+of\s+service|privacy\s+policy|legal\s+liability|prohibited\s+by\s+law)\b/i
];

const DATES_HISTORICAL_PATTERNS = [
  /\b(in\s+(19|20)\d{2})\b/i,
  /\b(since\s+(19|20)\d{2})\b/i,
  /\b(founded\s+in|released\s+in|launched\s+in|created\s+in|published\s+in)\s+\d{4}\b/i,
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(st|nd|rd|th)?(,\s*\d{4})?\b/i
];

const SCIENTIFIC_TECHNICAL_PATTERNS = [
  /\b(benchmark|latency|throughput|p99|p95|qps|algorithm|encryption|aes|sha-256|quantum|protocol|rfc\s*\d+)\b/i,
  /\b(peer-reviewed|laboratory|experiment|reproduced|proven\s+by|scientific\s+study)\b/i
];

const ORG_PERSON_PATTERNS = [
  /\b(google|microsoft|apple|amazon|meta|openai|anthropic|nvidia|oracle|ibm|cloudflare|vercel|gartner|forrester|idc)\b/i,
  /\b(according\s+to|stated\s+by|quoted\s+by|announced\s+by)\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*/
];

// Extraction of markdown citation URLs
const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

/**
 * Extracts sections and sentences with location mapping.
 */
interface TextSegment {
  section: string;
  sentence: string;
}

function segmentContent(markdown: string): TextSegment[] {
  const lines = markdown.split("\n");
  const segments: TextSegment[] = [];
  let currentSection = "Introduction";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("#")) {
      currentSection = trimmed.replace(/^#+\s*/, "");
      continue;
    }

    // Split paragraphs into sentences
    const sentences = trimmed.split(/(?<=[.!?])\s+/);
    for (const s of sentences) {
      const cleanSentence = s.trim();
      if (cleanSentence.length > 20) {
        segments.push({
          section: currentSection,
          sentence: cleanSentence
        });
      }
    }
  }

  return segments;
}

/**
 * Categorizes a sentence based on factual indicators.
 */
function categorizeSentence(sentence: string): {
  category: ClaimCategory;
  riskLevel: RiskLevel;
  explanation: string;
} | null {
  // Check Health & Safety (Critical Risk priority)
  if (HEALTH_SAFETY_PATTERNS.some((p) => p.test(sentence))) {
    return {
      category: "HEALTH_SAFETY",
      riskLevel: "CRITICAL",
      explanation: "Contains health, medical or biological safety assertions that carry direct liability and risk of harm."
    };
  }

  // Check Legal / Regulatory (Critical or High Risk)
  if (LEGAL_REGULATORY_PATTERNS.some((p) => p.test(sentence))) {
    return {
      category: "LEGAL_REGULATORY",
      riskLevel: "CRITICAL",
      explanation: "Contains legal, regulatory or compliance assertions that may mislead readers on statutory obligations."
    };
  }

  // Check Financial claims (High Risk)
  if (FINANCIAL_PATTERNS.some((p) => p.test(sentence)) && /\d+/.test(sentence)) {
    return {
      category: "FINANCIAL",
      riskLevel: "HIGH",
      explanation: "Contains quantitative financial or commercial cost statements that impact consumer or business decisions."
    };
  }

  // Check Statistical & Numerical claims (High Risk)
  if (STATISTICAL_PATTERNS.some((p) => p.test(sentence))) {
    return {
      category: "STATISTICAL_NUMERICAL",
      riskLevel: "HIGH",
      explanation: "Presents specific metrics, percentages or quantifiable statements susceptible to AI hallucination."
    };
  }

  // Check Scientific & Technical claims (Medium or High Risk)
  if (SCIENTIFIC_TECHNICAL_PATTERNS.some((p) => p.test(sentence))) {
    return {
      category: "SCIENTIFIC_TECHNICAL",
      riskLevel: "MEDIUM",
      explanation: "Contains technical architecture, cryptographic, or scientific benchmark specifications."
    };
  }

  // Check Dates and Historical assertions (Medium Risk)
  if (DATES_HISTORICAL_PATTERNS.some((p) => p.test(sentence))) {
    return {
      category: "DATES_HISTORICAL",
      riskLevel: "MEDIUM",
      explanation: "Asserts specific chronology, founding dates or historical milestones."
    };
  }

  // Check Named Organization or Person assertions (Medium Risk)
  if (ORG_PERSON_PATTERNS.some((p) => p.test(sentence))) {
    return {
      category: "ORGANIZATION_PERSON",
      riskLevel: "MEDIUM",
      explanation: "Attributes statements, policies or product details to a named person or corporation."
    };
  }

  return null;
}

/**
 * Deterministically evaluates supplied sources for SSRF, security, and corroboration.
 */
function evaluateSourcesForClaim(
  sources: string[]
): {
  evaluations: SourceEvaluation[];
  status: VerificationStatus;
  reasons: string[];
} {
  const evaluations: SourceEvaluation[] = [];
  const reasons: string[] = [];

  if (!sources || sources.length === 0) {
    return {
      evaluations: [],
      status: "UNVERIFIED",
      reasons: ["No source or citation reference was provided for this claim."]
    };
  }

  const verifiedCount = 0;

  for (const src of sources) {
    const urlValidation = validateSafeExternalUrl(src);

    if (!urlValidation.isSafe) {
      evaluations.push({
        url: src,
        isPrimarySource: false,
        authorityAssessment: "REJECTED_UNSAFE",
        relevanceAssessment: "Unsafe or private network destination",
        supportsClaim: false,
        contradictsClaim: false,
        isOutdated: false,
        isAccessible: false,
        excerptOrEvidence: `URL failed security policy: ${urlValidation.reason}`
      });
      reasons.push(`Source '${src}' rejected: ${urlValidation.reason}`);
      continue;
    }

    const validUrl = urlValidation.normalizedUrl!;
    const parsed = new URL(validUrl);
    const domain = parsed.hostname.toLowerCase();

    // Check domain authority profile
    const isGovOrEdu = domain.endsWith(".gov") || domain.endsWith(".edu") || domain.endsWith(".mil");
    const isMajorDocs = domain.includes("github.com") || domain.includes("google.com") || domain.includes("mozilla.org") || domain.includes("microsoft.com");
    const isPrimary = isGovOrEdu || isMajorDocs;

    evaluations.push({
      url: validUrl,
      title: domain,
      authorOrOrg: domain,
      isPrimarySource: isPrimary,
      authorityAssessment: isPrimary ? "HIGH_AUTHORITY_DOMAIN" : "STANDARD_WEB_SOURCE",
      relevanceAssessment: "Contains topical relevance to the article subject.",
      // Crucial constraint: We do NOT simulate arbitrary web fetches without live HTTP infrastructure.
      // Therefore, unless pre-verified through explicit verified sources list, it remains UNVERIFIED.
      supportsClaim: false,
      contradictsClaim: false,
      isOutdated: false,
      isAccessible: true,
      excerptOrEvidence: "Source address validated as safe external web reference. Requires human editorial audit of specific claim phrasing."
    });

    reasons.push(`Source '${domain}' passed safe URL inspection. Human editor must confirm exact citation passage.`);
  }

  // Under strict Phase F3 rules: External claim without verified live corroboration is UNVERIFIED.
  const status: VerificationStatus = verifiedCount > 0 ? "VERIFIED" : "UNVERIFIED";

  return {
    evaluations,
    status,
    reasons
  };
}

/**
 * Main review function evaluating all factual statements in an article.
 */
export function reviewArticleFactualClaims(input: FactualReviewInput): FactualReviewReport {
  const segments = segmentContent(input.content);
  const claims: FactualClaimItem[] = [];
  const knownSources = input.knownSources ?? [];
  const unverifiedList = new Set((input.unverifiedClaims ?? []).map((c) => c.trim().toLowerCase()));

  // Extract explicit markdown links inside the text as contextual citations
  const embeddedLinks: Array<{ anchor: string; url: string }> = [];
  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = MARKDOWN_LINK_REGEX.exec(input.content)) !== null) {
    embeddedLinks.push({ anchor: linkMatch[1], url: linkMatch[2] });
  }

  let claimIndex = 1;

  for (const seg of segments) {
    const classification = categorizeSentence(seg.sentence);
    if (!classification) continue;

    // Check if this segment contains an embedded link
    const matchingLinks = embeddedLinks.filter((l) =>
      seg.sentence.includes(l.anchor) || seg.sentence.includes(l.url)
    );
    const allSuppliedSources = Array.from(
      new Set([...matchingLinks.map((l) => l.url), ...knownSources])
    );

    const hasCitation = allSuppliedSources.length > 0;
    const { evaluations, status, reasons } = evaluateSourcesForClaim(
      allSuppliedSources
    );

    // Determine if claim was already pre-flagged as unverified
    const isPreFlagged = unverifiedList.has(seg.sentence.trim().toLowerCase());

    const finalStatus: VerificationStatus = isPreFlagged ? "UNVERIFIED" : status;
    const requiresHuman =
      classification.riskLevel === "CRITICAL" ||
      classification.riskLevel === "HIGH" ||
      finalStatus === "UNVERIFIED";

    let recommendedAction = "Review and corroborate with a reliable primary source.";
    if (classification.riskLevel === "CRITICAL") {
      recommendedAction = "MANDATORY EDITORIAL ACTION: Validate claim against statutory/clinical source or remove entirely.";
    } else if (classification.riskLevel === "HIGH") {
      recommendedAction = "Corroborate metrics with official benchmark report or clearly qualify as an estimate.";
    } else if (hasCitation) {
      recommendedAction = "Inspect source link to verify it directly supports the numerical assertion.";
    }

    claims.push({
      id: `claim-${claimIndex++}`,
      claimText: seg.sentence,
      sectionLocation: seg.section,
      category: classification.category,
      riskLevel: classification.riskLevel,
      hasCitation,
      suppliedSources: allSuppliedSources,
      evaluatedSources: evaluations,
      verificationStatus: finalStatus,
      requiresHumanReview: requiresHuman,
      explanation: classification.explanation + " " + reasons.join(" "),
      recommendedAction,
      reviewerDecision: "PENDING"
    });
  }

  // Compute summary metrics
  const totalClaims = claims.length;
  const verifiedCount = claims.filter((c) => c.verificationStatus === "VERIFIED").length;
  const unverifiedCount = claims.filter((c) => c.verificationStatus === "UNVERIFIED").length;
  const unverifiableCount = claims.filter((c) => c.verificationStatus === "UNVERIFIABLE").length;
  const criticalRiskCount = claims.filter((c) => c.riskLevel === "CRITICAL").length;
  const highRiskCount = claims.filter((c) => c.riskLevel === "HIGH").length;
  const mediumRiskCount = claims.filter((c) => c.riskLevel === "MEDIUM").length;
  const lowRiskCount = claims.filter((c) => c.riskLevel === "LOW").length;
  const pendingHumanReviewCount = claims.filter((c) => c.requiresHumanReview && c.reviewerDecision === "PENDING").length;

  const readyForPublishing = criticalRiskCount === 0 && unverifiedCount === 0 && pendingHumanReviewCount === 0;

  return {
    articleId: input.articleId,
    articleTitle: input.title,
    evaluatedAt: new Date().toISOString(),
    summary: {
      totalClaims,
      verifiedCount,
      unverifiedCount,
      unverifiableCount,
      criticalRiskCount,
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
      pendingHumanReviewCount,
      readyForPublishing,
      editorialSummary: `Audited ${totalClaims} factual claims. ${unverifiedCount} require source corroboration. ${criticalRiskCount} critical risk claims require human editorial sign-off.`,
      mandatoryDisclaimer: MANDATORY_DISCLAIMER
    },
    claims
  };
}
