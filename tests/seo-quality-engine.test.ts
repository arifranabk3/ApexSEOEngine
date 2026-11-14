import { describe, it, expect } from "vitest";
import { evaluateArticleQuality } from "@/services/seo/seo-quality-engine";
import {
  extractHeadings,
  computeFleschReadingEase,
  detectRepetition
} from "@/services/seo/seo-quality-schemas";

describe("Phase F2: SEO Quality Analysis Engine Suite", () => {
  const highQualityArticle = {
    title: "Complete Guide to Self-Hosted Ollama AI Blog Engine",
    metaTitle: "Complete Guide to Self-Hosted Ollama AI Blog Engine",
    metaDescription: "Learn how to build and deploy a zero-cost, self-hosted Ollama AI blogging engine with Next.js, local Llama 3.2, and structured JSON output validation.",
    focusKeyword: "self-hosted ollama",
    secondaryKeywords: ["local llm blogging", "zero cost ai generator", "llama 3.2 local"],
    searchIntent: "INFORMATIONAL" as const,
    content: `# Complete Guide to Self-Hosted Ollama AI Blog Engine

Self-hosted Ollama provides developers with a private, zero-cost AI publishing stack that completely eliminates SaaS API subscription fees. By executing inference locally on consumer hardware, you maintain total data sovereignty and avoid third-party rate limits.

## Architecture Overview & Decoupling

In an enterprise self-hosted Ollama deployment, the frontend web application and the AI inference engine are cleanly decoupled. The Next.js frontend runs on serverless infrastructure, while a dedicated local worker processes long-running generation jobs.

### System Communication Flow
Requests between the control plane and the local worker are cryptographically signed using HMAC-SHA256 signatures. This ensures that no untrusted traffic reaches your local Ollama port.

## Hardware Sizing & GPU Acceleration

Running Meta Llama 3.2 models requires adequate VRAM allocation. For 1B and 3B parameter models, a standard modern consumer GPU with 8GB to 12GB of VRAM provides responsive performance, achieving over 40 tokens per second.

### Memory & Quantization Trade-offs
Selecting 4-bit quantization (Q4_K_M) reduces model size to approximately 1.3GB while preserving linguistic accuracy and schema adherence.

## Modular Section Generation & Schema Validation

Monolithic prompting frequently suffers from hallucinations and structural deviations. In contrast, modular section generation processes one heading at a time, strictly validating each output against a Zod schema before storing it in PostgreSQL.

## Frequently Asked Questions

### What is self-hosted Ollama?
Self-hosted Ollama is an open-source model execution framework that allows you to run large language models locally on your own hardware without cloud dependencies.

### Can Ollama run offline?
Yes, once model weights are downloaded to local storage, Ollama functions completely offline with zero internet access required.

## Conclusion & Practical Takeaways

Deploying a self-hosted Ollama content pipeline empowers editorial teams to automate article drafts while maintaining strict privacy and zero ongoing API costs.

- Always isolate serverless web tiers from local inference workers.
- Enforce strict runtime schema validation on every section output.
- Regularly review generated drafts before human editorial approval.`,
    images: [
      {
        altText: "Complete architecture blueprint for self-hosted Ollama blog engine",
        isFeatured: true
      }
    ]
  };

  describe("Helper Functions", () => {
    it("extracts all H1, H2, and H3 headings accurately", () => {
      const headings = extractHeadings(highQualityArticle.content);
      expect(headings).toHaveLength(10);
      expect(headings[0]).toEqual({ level: 1, text: "Complete Guide to Self-Hosted Ollama AI Blog Engine" });
      expect(headings[1]).toEqual({ level: 2, text: "Architecture Overview & Decoupling" });
      expect(headings[2]).toEqual({ level: 3, text: "System Communication Flow" });
    });

    it("computes Flesch Reading Ease and Grade Level", () => {
      const { readingEase, gradeLevel } = computeFleschReadingEase(highQualityArticle.content);
      expect(readingEase).toBeGreaterThanOrEqual(0);
      expect(readingEase).toBeLessThanOrEqual(100);
      expect(gradeLevel).toBeGreaterThan(0);
    });

    it("detects verbatim repeated sentences", () => {
      const repeatedText = "This is a unique sentence that sets the context. This is an identical sentence that repeats itself. This is an identical sentence that repeats itself. Another conclusion sentence here.";
      const { repeatedSentences, repetitionScore } = detectRepetition(repeatedText);
      expect(repeatedSentences.length).toBe(1);
      expect(repetitionScore).toBeLessThan(100);
    });
  });

  describe("Comprehensive Quality Evaluation", () => {
    it("awards an EXCELLENT score (>= 85) to a well-structured, authoritative article", () => {
      const report = evaluateArticleQuality(highQualityArticle);

      expect(report.overallScore).toBeGreaterThanOrEqual(85);
      expect(report.status).toBe("EXCELLENT");
      expect(report.canProceedToReview).toBe(true);
      expect(report.blockers).toHaveLength(0);
      expect(report.intentSatisfaction.isSatisfied).toBe(true);
      expect(report.disclaimer).toContain("internal editorial quality score, not a Google ranking score");
    });

    it("flags BLOCKER when focus keyword is absent from title and content", () => {
      const missingKeywordArticle = {
        ...highQualityArticle,
        title: "A Random Generic Overview of Machine Learning Servers",
        metaTitle: "A Random Generic Overview of Machine Learning Servers",
        focusKeyword: "quantum-blockchain-database",
        content: `# A Random Generic Overview\n\nSome arbitrary text without the keyword anywhere.\n\n## Section 1\nMore text.\n\n## Section 2\nMore text.\n\n## Section 3\nMore text.`
      };

      const report = evaluateArticleQuality(missingKeywordArticle);

      expect(report.blockers.some((b) => b.code === "TITLE_KEYWORD_ABSENT" || b.code === "FOCUS_KEYWORD_ABSENT")).toBe(true);
      expect(report.canProceedToReview).toBe(false);
      expect(report.overallScore).toBeLessThanOrEqual(65); // capped when blockers present
    });

    it("flags BLOCKER when content is extremely thin (< 300 words)", () => {
      const thinArticle = {
        ...highQualityArticle,
        content: `# Complete Guide to Self-Hosted Ollama AI Blog Engine\n\nSelf-hosted Ollama is great.\n\n## Overview\nJust a short sentence here.`
      };

      const report = evaluateArticleQuality(thinArticle);

      expect(report.blockers.some((b) => b.code === "THIN_CONTENT" || b.code === "INSUFFICIENT_H2_DEPTH")).toBe(true);
      expect(report.canProceedToReview).toBe(false);
    });

    it("evaluates commercial search intent markers correctly", () => {
      const commercialArticle = {
        ...highQualityArticle,
        searchIntent: "COMMERCIAL" as const,
        content: `# Llama 3.2 vs DeepSeek R1 Comparison\n\nWhen choosing an AI model, developers often compare Llama 3.2 vs DeepSeek R1. Here is our benchmark review of alternatives, pros, and cons.\n\n## Performance Benchmarks\nAnalysis.\n\n## Feature Comparison\nAnalysis.\n\n## Conclusion\nWrap up.`
      };

      const report = evaluateArticleQuality(commercialArticle);
      expect(report.intentSatisfaction.intent).toBe("COMMERCIAL");
      expect(report.intentSatisfaction.isSatisfied).toBe(true);
      expect(report.categoryScores["searchIntent"].score).toBe(100);
    });

    it("handles empty or malformed input safely without crashing", () => {
      const emptyInput = {
        title: "",
        content: ""
      };

      const report = evaluateArticleQuality(emptyInput);

      expect(report.overallScore).toBeLessThanOrEqual(50);
      expect(report.status).toBe("BLOCKED");
      expect(report.canProceedToReview).toBe(false);
      expect(report.blockers.some((b) => b.code === "TITLE_EMPTY")).toBe(true);
      expect(report.blockers.some((b) => b.code === "THIN_CONTENT")).toBe(true);
    });
  });
});
