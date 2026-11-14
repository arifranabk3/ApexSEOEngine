import {
  ArticleQualityEvaluationInput,
  ArticleQualityEvaluationReport,
  CategoryScoreResult,
  QualityIssue,
  SearchIntent,
  extractHeadings,
  computeFleschReadingEase,
  detectRepetition
} from "./seo-quality-schemas";

/**
 * Enterprise SEO Quality Analysis Engine.
 * Evaluates articles across 14 deterministic editorial, technical, and structural dimensions.
 *
 * NOTE: As required by Google Search & AdSense compliance, this score is an internal
 * editorial quality measure and does NOT represent or guarantee Google Search ranking position.
 */
export function evaluateArticleQuality(
  input: ArticleQualityEvaluationInput
): ArticleQualityEvaluationReport {
  const issues: QualityIssue[] = [];
  const categoryScores: Record<string, CategoryScoreResult> = {};

  const cleanContent = (input.content || "").trim();
  const words = cleanContent.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const focusKeyword = (input.focusKeyword || "").toLowerCase().trim();
  const secondaryKeywords = (input.secondaryKeywords || []).map((k) => k.toLowerCase().trim());
  const intent: SearchIntent = input.searchIntent || "INFORMATIONAL";

  const effectiveTitle = (input.metaTitle || input.title || "").trim();
  const effectiveDesc = (input.metaDescription || "").trim();

  // 1. SEO Title Quality (Weight: 10%)
  {
    const catIssues: QualityIssue[] = [];
    let score = 100;
    const titleLen = effectiveTitle.length;

    if (!effectiveTitle) {
      score = 0;
      catIssues.push({
        category: "title",
        severity: "BLOCKER",
        code: "TITLE_EMPTY",
        message: "Article title is completely missing.",
        recommendation: "Provide a descriptive title between 45 and 65 characters."
      });
    } else {
      if (titleLen < 25) {
        score -= 40;
        catIssues.push({
          category: "title",
          severity: "WARNING",
          code: "TITLE_TOO_SHORT",
          message: `Title is too brief (${titleLen} chars). May underperform in SERP visibility.`,
          recommendation: "Expand title to 45-65 characters incorporating user intent."
        });
      } else if (titleLen > 70) {
        score -= 25;
        catIssues.push({
          category: "title",
          severity: "WARNING",
          code: "TITLE_TOO_LONG",
          message: `Title is ${titleLen} chars and will be truncated in search snippets.`,
          recommendation: "Shorten title to under 65 characters."
        });
      }

      if (focusKeyword && !effectiveTitle.toLowerCase().includes(focusKeyword)) {
        const tokens = focusKeyword.split(/\s+/);
        const hasToken = tokens.some((t) => effectiveTitle.toLowerCase().includes(t));
        if (!hasToken) {
          score -= 35;
          catIssues.push({
            category: "title",
            severity: "BLOCKER",
            code: "TITLE_KEYWORD_ABSENT",
            message: `Title does not contain the focus keyword "${input.focusKeyword}".`,
            recommendation: `Include primary keyword "${input.focusKeyword}" near the beginning of the title.`
          });
        } else {
          score -= 10;
          catIssues.push({
            category: "title",
            severity: "SUGGESTION",
            code: "TITLE_PARTIAL_KEYWORD",
            message: `Title contains partial keyword tokens rather than exact match.`,
            recommendation: "Place the exact focus keyword for clearer searcher relevance."
          });
        }
      }
    }

    score = Math.max(0, Math.min(100, score));
    categoryScores["title"] = {
      category: "SEO Title Quality",
      score,
      weight: 0.10,
      evidence: `Length: ${titleLen} characters. Contains focus keyword: ${
        focusKeyword ? effectiveTitle.toLowerCase().includes(focusKeyword) : "N/A"
      }.`,
      issues: catIssues
    };
    issues.push(...catIssues);
  }

  // 2. Meta Description Quality (Weight: 8%)
  {
    const catIssues: QualityIssue[] = [];
    let score = 100;
    const descLen = effectiveDesc.length;

    if (!effectiveDesc) {
      score = 0;
      catIssues.push({
        category: "metaDescription",
        severity: "BLOCKER",
        code: "META_DESC_MISSING",
        message: "Meta description is missing.",
        recommendation: "Write an engaging meta description between 120 and 160 characters."
      });
    } else {
      if (descLen < 70) {
        score -= 40;
        catIssues.push({
          category: "metaDescription",
          severity: "WARNING",
          code: "META_DESC_TOO_SHORT",
          message: `Meta description is very short (${descLen} chars). Search engines may auto-generate snippets instead.`,
          recommendation: "Expand meta description to 120-160 characters."
        });
      } else if (descLen > 170) {
        score -= 20;
        catIssues.push({
          category: "metaDescription",
          severity: "SUGGESTION",
          code: "META_DESC_TOO_LONG",
          message: `Meta description is ${descLen} chars and will be truncated on mobile viewports.`,
          recommendation: "Keep meta description under 160 characters."
        });
      }

      if (focusKeyword && !effectiveDesc.toLowerCase().includes(focusKeyword)) {
        score -= 20;
        catIssues.push({
          category: "metaDescription",
          severity: "SUGGESTION",
          code: "META_DESC_NO_KEYWORD",
          message: `Meta description does not mention the focus keyword.`,
          recommendation: "Include the primary keyword naturally in the meta description."
        });
      }
    }

    score = Math.max(0, Math.min(100, score));
    categoryScores["metaDescription"] = {
      category: "Meta Description Quality",
      score,
      weight: 0.08,
      evidence: `Length: ${descLen} chars. Mention keyword: ${
        focusKeyword ? effectiveDesc.toLowerCase().includes(focusKeyword) : "N/A"
      }.`,
      issues: catIssues
    };
    issues.push(...catIssues);
  }

  // 3. Heading Structure & Hierarchy (Weight: 12%)
  const headings = extractHeadings(cleanContent);
  const h1s = headings.filter((h) => h.level === 1);
  const h2s = headings.filter((h) => h.level === 2);
  const h3s = headings.filter((h) => h.level === 3);

  {
    const catIssues: QualityIssue[] = [];
    let score = 100;

    if (h1s.length === 0) {
      score -= 50;
      catIssues.push({
        category: "headings",
        severity: "BLOCKER",
        code: "NO_H1_HEADING",
        message: "Article has no H1 heading in content.",
        recommendation: "Add exactly one descriptive # H1 heading."
      });
    } else if (h1s.length > 1) {
      score -= 30;
      catIssues.push({
        category: "headings",
        severity: "WARNING",
        code: "MULTIPLE_H1_HEADINGS",
        message: `Found ${h1s.length} H1 headings. Standard SEO hierarchy expects exactly one H1.`,
        recommendation: "Demote secondary H1 headings to ## H2."
      });
    }

    if (h2s.length < 3) {
      score -= 40;
      catIssues.push({
        category: "headings",
        severity: "BLOCKER",
        code: "INSUFFICIENT_H2_DEPTH",
        message: `Article has only ${h2s.length} H2 sections. Comprehensive content requires at least 3 main sections.`,
        recommendation: "Divide content into at least 3 distinct ## H2 thematic sections."
      });
    }

    // Check duplicate headings
    const seenHeadings = new Set<string>();
    for (const h of headings) {
      const norm = h.text.toLowerCase();
      if (seenHeadings.has(norm)) {
        score -= 25;
        catIssues.push({
          category: "headings",
          severity: "BLOCKER",
          code: "DUPLICATE_HEADING_TEXT",
          message: `Duplicate heading found: "${h.text}". Every section must cover a unique topic.`,
          recommendation: "Rename or merge duplicate headings."
        });
        break;
      }
      seenHeadings.add(norm);
    }

    score = Math.max(0, Math.min(100, score));
    categoryScores["headings"] = {
      category: "Heading Hierarchy",
      score,
      weight: 0.12,
      evidence: `Found ${h1s.length} H1, ${h2s.length} H2, and ${h3s.length} H3 elements.`,
      issues: catIssues
    };
    issues.push(...catIssues);
  }

  // 4. Focus Keyword Coverage (Weight: 10%)
  let keywordCount = 0;
  {
    const catIssues: QualityIssue[] = [];
    let score = 100;

    if (!focusKeyword) {
      score = 50;
      catIssues.push({
        category: "focusKeyword",
        severity: "WARNING",
        code: "NO_FOCUS_KEYWORD_DEFINED",
        message: "No focus keyword is assigned to this article.",
        recommendation: "Assign a primary target keyword in article settings."
      });
    } else {
      const lowerBody = cleanContent.toLowerCase();
      const escaped = focusKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const matches = lowerBody.match(new RegExp(`\\b${escaped}\\b`, "g"));
      keywordCount = matches ? matches.length : 0;

      if (keywordCount === 0) {
        score -= 60;
        catIssues.push({
          category: "focusKeyword",
          severity: "BLOCKER",
          code: "FOCUS_KEYWORD_ABSENT",
          message: `Focus keyword "${input.focusKeyword}" does not appear anywhere in the body.`,
          recommendation: `Incorporate "${input.focusKeyword}" naturally into the content.`
        });
      } else {
        // Evaluate density naturally without artificial limits:
        const density = (keywordCount * focusKeyword.split(" ").length) / Math.max(1, wordCount);
        if (density > 0.035) {
          score -= 30;
          catIssues.push({
            category: "focusKeyword",
            severity: "WARNING",
            code: "POTENTIAL_KEYWORD_STUFFING",
            message: `Focus keyword appears ${keywordCount} times (~${(density * 100).toFixed(1)}% density). This may indicate repetitive keyword stuffing.`,
            recommendation: "Replace repetitive occurrences with synonyms and conceptual explanations."
          });
        }
      }
    }

    score = Math.max(0, Math.min(100, score));
    categoryScores["focusKeyword"] = {
      category: "Focus Keyword Coverage",
      score,
      weight: 0.10,
      evidence: `Occurrences: ${keywordCount} times in ${wordCount} words.`,
      issues: catIssues
    };
    issues.push(...catIssues);
  }

  // 5. Secondary Keyword Coverage (Weight: 8%)
  {
    const catIssues: QualityIssue[] = [];
    let score = 100;

    if (secondaryKeywords.length > 0) {
      const lowerBody = cleanContent.toLowerCase();
      const matched = secondaryKeywords.filter((sec) => lowerBody.includes(sec));
      const coverageRatio = matched.length / secondaryKeywords.length;

      if (coverageRatio < 0.4) {
        score = 40;
        catIssues.push({
          category: "secondaryKeywords",
          severity: "WARNING",
          code: "LOW_SECONDARY_COVERAGE",
          message: `Only ${matched.length}/${secondaryKeywords.length} secondary keywords are covered.`,
          recommendation: `Incorporate missed secondary concepts: ${secondaryKeywords
            .filter((s) => !matched.includes(s))
            .slice(0, 3)
            .join(", ")}.`
        });
      } else if (coverageRatio < 0.75) {
        score = 75;
      }
    } else {
      score = 90; // Neutral if no secondaries supplied
    }

    score = Math.max(0, Math.min(100, score));
    categoryScores["secondaryKeywords"] = {
      category: "Secondary Keyword Coverage",
      score,
      weight: 0.08,
      evidence: `${secondaryKeywords.length} secondary keywords tracked.`,
      issues: catIssues
    };
    issues.push(...catIssues);
  }

  // 6. Topic Completeness & Length (Weight: 12%)
  {
    const catIssues: QualityIssue[] = [];
    let score = 100;

    if (wordCount < 300) {
      score = 15;
      catIssues.push({
        category: "completeness",
        severity: "BLOCKER",
        code: "THIN_CONTENT",
        message: `Content is extremely thin (${wordCount} words). High risk of unhelpful content classification.`,
        recommendation: "Expand article to thoroughly answer core user questions with detailed guidance."
      });
    } else if (wordCount < 600) {
      score = 65;
      catIssues.push({
        category: "completeness",
        severity: "WARNING",
        code: "BELOW_RECOMMENDED_DEPTH",
        message: `Word count (${wordCount}) is below recommended comprehensive guide threshold (~800+ words).`,
        recommendation: "Add practical steps, technical context, or code examples."
      });
    }

    score = Math.max(0, Math.min(100, score));
    categoryScores["completeness"] = {
      category: "Topic Completeness",
      score,
      weight: 0.12,
      evidence: `Total word count: ${wordCount} words.`,
      issues: catIssues
    };
    issues.push(...catIssues);
  }

  // 7. Search Intent Satisfaction (Weight: 10%)
  let isIntentSatisfied = true;
  let intentEvidence = "";
  {
    const catIssues: QualityIssue[] = [];
    let score = 100;
    const lowerBody = cleanContent.toLowerCase();

    switch (intent) {
      case "INFORMATIONAL":
        // Expects explanations, definitions, tutorials ("how to", "guide", "steps", "why", "what is")
        const infoPatterns = ["how to", "step", "guide", "what is", "why", "example", "overview", "explanation"];
        const infoHits = infoPatterns.filter((p) => lowerBody.includes(p));
        if (infoHits.length < 2) {
          score -= 35;
          isIntentSatisfied = false;
          catIssues.push({
            category: "searchIntent",
            severity: "WARNING",
            code: "WEAK_INFORMATIONAL_STRUCTURE",
            message: "Content lacks common explanatory cues or step-by-step guidance for informational search intent.",
            recommendation: "Include clear definitions, step-by-step instructions, or architectural walkthroughs."
          });
        }
        intentEvidence = `Informational intent: found ${infoHits.length} explanatory markers (${infoHits.join(", ")}).`;
        break;

      case "COMMERCIAL":
        // Expects comparisons, reviews, benchmarks, pros/cons, alternatives
        const commPatterns = ["vs", "compare", "alternative", "benchmark", "pros", "cons", "best", "review"];
        const commHits = commPatterns.filter((p) => lowerBody.includes(p));
        if (commHits.length < 2) {
          score -= 35;
          isIntentSatisfied = false;
          catIssues.push({
            category: "searchIntent",
            severity: "WARNING",
            code: "WEAK_COMMERCIAL_STRUCTURE",
            message: "Commercial intent requires comparative analysis, feature evaluation, or pros/cons.",
            recommendation: "Add feature comparisons, benchmark metrics, or trade-off analysis."
          });
        }
        intentEvidence = `Commercial intent: found ${commHits.length} comparison markers (${commHits.join(", ")}).`;
        break;

      case "TRANSACTIONAL":
        // Expects setup, installation, command snippets, downloads, templates
        const transPatterns = ["install", "download", "command", "config", "setup", "run", "npm", "docker"];
        const transHits = transPatterns.filter((p) => lowerBody.includes(p));
        if (transHits.length < 2) {
          score -= 35;
          isIntentSatisfied = false;
          catIssues.push({
            category: "searchIntent",
            severity: "WARNING",
            code: "WEAK_TRANSACTIONAL_STRUCTURE",
            message: "Transactional intent requires actionable setup instructions or command examples.",
            recommendation: "Provide configuration examples or terminal execution commands."
          });
        }
        intentEvidence = `Transactional intent: found ${transHits.length} actionable setup cues (${transHits.join(", ")}).`;
        break;

      case "NAVIGATIONAL":
      default:
        intentEvidence = `Navigational intent: target resource guidance validated.`;
        break;
    }

    score = Math.max(0, Math.min(100, score));
    categoryScores["searchIntent"] = {
      category: "Search Intent Satisfaction",
      score,
      weight: 0.10,
      evidence: intentEvidence,
      issues: catIssues
    };
    issues.push(...catIssues);
  }

  // 8. Introduction Quality (Weight: 6%)
  {
    const catIssues: QualityIssue[] = [];
    let score = 100;
    const firstParagraph = cleanContent.split("\n\n")[0] || "";

    if (firstParagraph.length < 50) {
      score -= 40;
      catIssues.push({
        category: "introduction",
        severity: "WARNING",
        code: "WEAK_INTRODUCTION",
        message: "Opening section is very short and does not establish a clear hook or problem statement.",
        recommendation: "Expand the introduction to introduce the core problem, why it matters, and what the reader will learn."
      });
    }

    if (focusKeyword && !firstParagraph.toLowerCase().includes(focusKeyword)) {
      score -= 20;
      catIssues.push({
        category: "introduction",
        severity: "SUGGESTION",
        code: "KEYWORD_NOT_IN_INTRO",
        message: "Focus keyword is not mentioned in the opening paragraph.",
        recommendation: "Mention the primary keyword within the first 100 words for instant topic relevance."
      });
    }

    score = Math.max(0, Math.min(100, score));
    categoryScores["introduction"] = {
      category: "Introduction Quality",
      score,
      weight: 0.06,
      evidence: `Opening paragraph length: ${firstParagraph.length} chars.`,
      issues: catIssues
    };
    issues.push(...catIssues);
  }

  // 9. Conclusion Quality & Actionability (Weight: 6%)
  {
    const catIssues: QualityIssue[] = [];
    let score = 100;
    const hasConclusionHeading = h2s.some((h) =>
      h.text.toLowerCase().includes("conclusion") ||
      h.text.toLowerCase().includes("summary") ||
      h.text.toLowerCase().includes("key takeaway") ||
      h.text.toLowerCase().includes("next step")
    );

    if (!hasConclusionHeading) {
      score -= 40;
      catIssues.push({
        category: "conclusion",
        severity: "WARNING",
        code: "NO_CONCLUSION_SECTION",
        message: "No dedicated conclusion or summary section found.",
        recommendation: "Add a ## Conclusion or ## Key Takeaways section to summarize practical outcomes."
      });
    }

    score = Math.max(0, Math.min(100, score));
    categoryScores["conclusion"] = {
      category: "Conclusion Quality",
      score,
      weight: 0.06,
      evidence: `Conclusion heading detected: ${hasConclusionHeading}.`,
      issues: catIssues
    };
    issues.push(...catIssues);
  }

  // 10. FAQ Usefulness (Weight: 6%)
  let faqCount = 0;
  {
    const catIssues: QualityIssue[] = [];
    let score = 100;
    const hasFaqHeading = headings.some((h) =>
      h.text.toLowerCase().includes("frequently asked") || h.text.toLowerCase().includes("faq")
    );

    // Count questions by checking question marks inside headings or bullet items
    const questionMatches = cleanContent.match(/###\s*[^?\n]+\?/g);
    faqCount = questionMatches ? questionMatches.length : 0;

    if (!hasFaqHeading || faqCount < 2) {
      score = 60;
      catIssues.push({
        category: "faqs",
        severity: "SUGGESTION",
        code: "FEW_FAQS",
        message: `Found ${faqCount} FAQ items. Adding high-intent FAQs improves SERP People Also Ask and Rich Snippet readiness.`,
        recommendation: "Add at least 2-3 specific FAQs addressing common searcher objections."
      });
    }

    score = Math.max(0, Math.min(100, score));
    categoryScores["faqs"] = {
      category: "FAQ Section Usefulness",
      score,
      weight: 0.06,
      evidence: `FAQ section present: ${hasFaqHeading}. Detected questions: ${faqCount}.`,
      issues: catIssues
    };
    issues.push(...catIssues);
  }

  // 11. Readability & Sentence Flow (Weight: 6%)
  const { readingEase, gradeLevel } = computeFleschReadingEase(cleanContent);
  {
    const catIssues: QualityIssue[] = [];
    let score = 100;

    // Ideal technical writing ease: 45 to 75 (Grade level 7 to 12)
    if (readingEase < 30) {
      score -= 30;
      catIssues.push({
        category: "readability",
        severity: "WARNING",
        code: "VERY_DIFFICULT_READING",
        message: `Flesch Reading Ease score is ${readingEase} (Grade ${gradeLevel}). Text may be overly dense or academic.`,
        recommendation: "Break long multi-clause sentences into shorter, clearer statements."
      });
    }

    score = Math.max(0, Math.min(100, score));
    categoryScores["readability"] = {
      category: "Content Readability",
      score,
      weight: 0.06,
      evidence: `Flesch Reading Ease: ${readingEase}/100, Grade Level: ${gradeLevel}.`,
      issues: catIssues
    };
    issues.push(...catIssues);
  }

  // 12. Repetition & Duplication Detection (Weight: 6%)
  const { repeatedSentences, repetitionScore } = detectRepetition(cleanContent);
  {
    const catIssues: QualityIssue[] = [];
    if (repeatedSentences.length > 0) {
      catIssues.push({
        category: "repetition",
        severity: "WARNING",
        code: "REPEATED_SENTENCES_DETECTED",
        message: `Detected ${repeatedSentences.length} duplicate/verbatim sentences in content body.`,
        recommendation: "Remove or rephrase redundant sentences to avoid fluff penalties."
      });
    }

    categoryScores["repetition"] = {
      category: "Repetition & Duplication",
      score: repetitionScore,
      weight: 0.06,
      evidence: `Repeated sentence count: ${repeatedSentences.length}.`,
      issues: catIssues
    };
    issues.push(...catIssues);
  }

  // 13. Internal Linking Readiness (Weight: 4%)
  {
    const catIssues: QualityIssue[] = [];
    let score = 100;
    // Check markdown links: [anchor](url)
    const linkMatches = cleanContent.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];

    if (linkMatches.length === 0) {
      score = 60;
      catIssues.push({
        category: "internalLinking",
        severity: "SUGGESTION",
        code: "NO_INLINE_LINKS",
        message: "No internal or external links detected in the article text.",
        recommendation: "Connect relevant subtopics to pillar clusters or supporting articles using descriptive anchor text."
      });
    }

    score = Math.max(0, Math.min(100, score));
    categoryScores["internalLinking"] = {
      category: "Internal Linking Readiness",
      score,
      weight: 0.04,
      evidence: `Found ${linkMatches.length} markdown link anchors.`,
      issues: catIssues
    };
    issues.push(...catIssues);
  }

  // 14. Image Alt Text & Media Quality (Weight: 4%)
  {
    const catIssues: QualityIssue[] = [];
    let score = 100;
    const images = input.images || [];

    if (images.length === 0) {
      score = 70;
      catIssues.push({
        category: "images",
        severity: "SUGGESTION",
        code: "NO_ATTACHED_IMAGES",
        message: "No featured or supporting images attached to article.",
        recommendation: "Generate a featured SVG blueprint or architecture diagram."
      });
    } else {
      const missingAlt = images.filter((img) => !img.altText || img.altText.trim().length < 5);
      if (missingAlt.length > 0) {
        score -= 40;
        catIssues.push({
          category: "images",
          severity: "WARNING",
          code: "MISSING_ALT_TEXT",
          message: `${missingAlt.length} image(s) have weak or missing alt text.`,
          recommendation: "Provide accurate, descriptive alt text for accessibility and search bots."
        });
      }
    }

    score = Math.max(0, Math.min(100, score));
    categoryScores["images"] = {
      category: "Image Alt Text & Visual Quality",
      score,
      weight: 0.04,
      evidence: `Attached images count: ${images.length}.`,
      issues: catIssues
    };
    issues.push(...catIssues);
  }

  // ============================================================================
  // OVERALL WEIGHTED SCORE CALCULATION
  // ============================================================================
  let weightedSum = 0;
  let totalWeight = 0;

  for (const cat of Object.values(categoryScores)) {
    weightedSum += cat.score * cat.weight;
    totalWeight += cat.weight;
  }

  let overallScore = Math.round(weightedSum / (totalWeight || 1));

  // Determine blockers and warnings
  const blockers = issues.filter((i) => i.severity === "BLOCKER");
  const warnings = issues.filter((i) => i.severity === "WARNING");
  const suggestions = issues.filter((i) => i.severity === "SUGGESTION");

  // If critical blockers exist, cap overall score at 65
  if (blockers.length > 0) {
    overallScore = Math.min(overallScore, 65);
  }

  overallScore = Math.max(0, Math.min(100, overallScore));

  let status: "EXCELLENT" | "SATISFACTORY" | "NEEDS_IMPROVEMENT" | "BLOCKED" = "EXCELLENT";
  let canProceed = true;

  if (blockers.length > 0) {
    status = "BLOCKED";
    canProceed = false;
  } else if (overallScore < 70) {
    status = "NEEDS_IMPROVEMENT";
    canProceed = true;
  } else if (overallScore < 85) {
    status = "SATISFACTORY";
    canProceed = true;
  }

  return {
    overallScore,
    status,
    canProceedToReview: canProceed,
    blockers,
    warnings,
    suggestions,
    categoryScores,
    intentSatisfaction: {
      intent,
      isSatisfied: isIntentSatisfied,
      evidence: intentEvidence
    },
    metrics: {
      wordCount,
      h1Count: h1s.length,
      h2Count: h2s.length,
      h3Count: h3s.length,
      faqCount,
      fleschKincaidGrade: gradeLevel,
      readingEaseScore: readingEase,
      keywordOccurrences: keywordCount
    },
    disclaimer:
      "This is an internal editorial quality score, not a Google ranking score. It verifies structural best practices, heading depth, and searcher intent satisfaction to prevent thin or unhelpful content.",
    evaluatedAt: new Date().toISOString()
  };
}
