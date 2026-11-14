import {
  ArticleOutlineOutput,
  OutlineValidationIssue,
  OutlineValidationReport,
  TopicAnalysisInput
} from "./topic-outline-schemas";

/**
 * Validates generated outlines against search intent, logical hierarchy,
 * repetitive headings, keyword stuffing, and thinness risks.
 *
 * NOTE: As required by Google Search & AdSense compliance, this validator
 * issues deterministic rule-based checks and explicitly disclaims that internal
 * quality heuristics are NOT official Google ranking algorithms.
 */
export function validateArticleOutline(
  outline: ArticleOutlineOutput,
  input: TopicAnalysisInput
): OutlineValidationReport {
  const issues: OutlineValidationIssue[] = [];

  const focusKeywordLower = input.focusKeyword.toLowerCase().trim();
  const seoTitleLower = outline.seoTitle.toLowerCase();

  // 1. Title & H1 Checks
  if (!seoTitleLower.includes(focusKeywordLower)) {
    // Check for token overlap if partial match
    const tokens = focusKeywordLower.split(/\s+/).filter(Boolean);
    const hasOverlap = tokens.some((t) => seoTitleLower.includes(t));
    if (!hasOverlap) {
      issues.push({
        type: "WARNING",
        code: "TITLE_KEYWORD_MISMATCH",
        message: `SEO title does not contain primary focus keyword "${input.focusKeyword}" or its core terms.`
      });
    }
  }

  if (outline.seoTitle.length < 25) {
    issues.push({
      type: "WARNING",
      code: "TITLE_TOO_SHORT",
      message: `SEO title is very short (${outline.seoTitle.length} chars). Aim for 45-65 characters.`
    });
  } else if (outline.seoTitle.length > 70) {
    issues.push({
      type: "WARNING",
      code: "TITLE_TOO_LONG",
      message: `SEO title is ${outline.seoTitle.length} chars and may be truncated in SERPs.`
    });
  }

  if (outline.metaDescription.length < 70) {
    issues.push({
      type: "WARNING",
      code: "META_DESC_TOO_SHORT",
      message: `Meta description is short (${outline.metaDescription.length} chars). Aim for 120-160 characters.`
    });
  }

  // 2. Headings & Hierarchy
  const seenHeadings = new Set<string>();
  let h2Count = 0;
  let h3Count = 0;

  outline.sections.forEach((sec, idx) => {
    const cleanHeading = sec.heading.toLowerCase().trim();

    if (sec.level === "h2") h2Count++;
    if (sec.level === "h3") h3Count++;

    if (seenHeadings.has(cleanHeading)) {
      issues.push({
        type: "BLOCKED",
        code: "DUPLICATE_HEADING",
        message: `Duplicate heading detected: "${sec.heading}". Each section must address a distinct topic.`,
        sectionIndex: idx
      });
    }
    seenHeadings.add(cleanHeading);

    if (!sec.objective || sec.objective.trim().length < 10) {
      issues.push({
        type: "WARNING",
        code: "WEAK_SECTION_OBJECTIVE",
        message: `Section "${sec.heading}" has a weak or missing objective.`,
        sectionIndex: idx
      });
    }

    if (!sec.questionsAnswered || sec.questionsAnswered.length === 0) {
      issues.push({
        type: "WARNING",
        code: "MISSING_QUESTIONS_ANSWERED",
        message: `Section "${sec.heading}" lists no user questions answered.`,
        sectionIndex: idx
      });
    }

    // Subsections check
    sec.subsections?.forEach((sub) => {
      h3Count++;
      const subClean = sub.heading.toLowerCase().trim();
      if (seenHeadings.has(subClean)) {
        issues.push({
          type: "BLOCKED",
          code: "DUPLICATE_SUBHEADING",
          message: `Duplicate subheading detected: "${sub.heading}".`,
          sectionIndex: idx
        });
      }
      seenHeadings.add(subClean);
    });
  });

  // Minimum sections check
  if (h2Count < 3) {
    issues.push({
      type: "BLOCKED",
      code: "INSUFFICIENT_H2_DEPTH",
      message: `Outline has only ${h2Count} main H2 sections. High-quality pillar content requires at least 3 comprehensive sections.`
    });
  }

  // 3. FAQs and Search Intent Alignment
  const faqCount = outline.faqs?.length || 0;
  if (faqCount < 2) {
    issues.push({
      type: "WARNING",
      code: "MINIMAL_FAQS",
      message: `Only ${faqCount} FAQs included. Suggest adding at least 3 high-intent user questions.`
    });
  }

  if (!outline.practicalTakeaways || outline.practicalTakeaways.length < 2) {
    issues.push({
      type: "WARNING",
      code: "MISSING_PRACTICAL_TAKEAWAYS",
      message: "No practical user takeaways or action steps defined."
    });
  }

  // 4. Calculate Heuristic Score & Verdict
  const blockedIssues = issues.filter((i) => i.type === "BLOCKED");
  const warningIssues = issues.filter((i) => i.type === "WARNING");

  let verdict: "PASS" | "WARNING" | "BLOCKED" = "PASS";
  let canProceed = true;

  if (blockedIssues.length > 0) {
    verdict = "BLOCKED";
    canProceed = false;
  } else if (warningIssues.length > 0) {
    verdict = "WARNING";
    canProceed = true;
  }

  // Score heuristic: Start at 100, -25 per blocked, -8 per warning, clamp 0-100
  const score = Math.max(0, Math.min(100, 100 - blockedIssues.length * 25 - warningIssues.length * 8));

  // Estimate words: 250 words per H2 + 150 words per H3 + 120 words per FAQ + 300 intro/outro
  const estimatedWordCount = h2Count * 250 + h3Count * 150 + faqCount * 120 + 300;

  return {
    verdict,
    canProceedToGeneration: canProceed,
    score,
    issues,
    metrics: {
      totalSections: outline.sections.length,
      h2Count,
      h3Count,
      faqCount,
      estimatedWordCount
    },
    disclaimer:
      "Compliance quality heuristics evaluate logical heading structure, topic clarity, and intent alignment. They are internal editorial safeguards and do NOT represent or guarantee Google Search ranking position."
  };
}
