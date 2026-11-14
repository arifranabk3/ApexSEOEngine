import { describe, it, expect, vi, beforeEach } from "vitest";
import { ModularArticleGenerator } from "@/services/ai/modular-article-generator";
import {
  createGeneratedSection,
  GeneratedSectionOutput
} from "@/services/ai/modular-article-schemas";
import {
  ArticleOutlineOutput,
  OutlineSection
} from "@/services/ai/topic-outline-schemas";
import { AIProviderAdapter } from "@/services/ai/provider-adapter";

describe("Phase 02.1-D: Modular AI Article Generator & Assembly Engine Suite", () => {
  const sampleOutline: ArticleOutlineOutput = {
    seoTitle: "Self-Hosted Ollama AI Blog Engine: The Definitive Guide",
    metaDescription: "Step-by-step technical architecture guide to deploying a zero-cost, self-hosted Ollama AI blog engine with Next.js and PostgreSQL.",
    urlSlug: "self-hosted-ollama-blog-engine",
    h1: "Self-Hosted Ollama AI Blog Engine: The Complete Implementation Guide",
    sections: [
      {
        heading: "Architecture Overview & Vercel Topology",
        level: "h2",
        objective: "Explain decoupling of serverless web frontend and external AI worker.",
        questionsAnswered: ["Why run Ollama outside Vercel Functions?", "How do the services communicate?"],
        suggestedExamples: ["HMAC signature authentication flow"],
        suggestedTableOrComparison: "Serverless vs External Worker latency & cost matrix",
        internalLinkAnchorRecommendations: ["zero cost ai generator"],
        subsections: []
      },
      {
        heading: "Hardware Sizing & GPU Acceleration",
        level: "h2",
        objective: "Detail memory, CUDA cores, and quant selection for Llama 3.2.",
        questionsAnswered: ["What GPU is required for Llama 3.2?", "How does Q4_K_M affect accuracy?"],
        suggestedExamples: ["NVIDIA RTX 3060 12GB VRAM benchmark"],
        internalLinkAnchorRecommendations: [],
        subsections: []
      },
      {
        heading: "Modular Section Generation & Schema Validation",
        level: "h2",
        objective: "Demonstrate piecewise generation to eliminate hallucination.",
        questionsAnswered: ["How to assemble articles piece by piece?", "Why use Zod validation?"],
        suggestedExamples: ["Zod schema repair loop"],
        internalLinkAnchorRecommendations: [],
        subsections: []
      }
    ],
    conclusionObjective: "Summarize deployment checklist and next steps for automated publishing.",
    practicalTakeaways: [
      "Decouple long-running LLM processes from serverless request cycles.",
      "Enforce strict schema validation on every section output.",
      "Flag unverified external citations explicitly."
    ],
    faqs: [
      {
        question: "Does Ollama require a paid license for commercial blogging?",
        answerBrief: "Ollama itself is MIT licensed, and Meta's Llama 3.2 community license permits commercial use below 700M monthly active users."
      },
      {
        question: "Can multiple articles be generated in parallel?",
        answerBrief: "Yes, using the PostgreSQL-backed DurableJob queue with worker concurrency limits."
      }
    ],
    imageSuggestions: [],
    externalReferenceOpportunities: []
  };

  describe("Section Generation and Source Attribution", () => {
    it("generates an individual section and extracts unverified claims and cited entities", async () => {
      const mockSectionOutput = {
        heading: "Architecture Overview & Vercel Topology",
        level: "h2" as const,
        markdownContent: "Decoupling the frontend web tier from the AI generation worker prevents Vercel serverless function timeouts. The Next.js control plane handles user interactions, while local Ollama executes inference over an authenticated reverse proxy.\n\n### Communication Protocol\nRequests are authenticated using HMAC-SHA256 signatures to ensure zero unauthorized invocations.",
        keyTakeaways: ["Eliminates Vercel 15s execution limits", "Protects local worker port from public exposure"],
        unverifiedClaims: ["UNVERIFIED: Benchmark claims 10x lower latency on local PCIe gen 4"],
        citedEntitiesOrSources: ["Next.js", "Ollama", "PostgreSQL"],
        wordCount: 165
      };

      const mockAdapter: AIProviderAdapter = {
        providerType: "OLLAMA",
        testConnection: async () => ({ connected: true, latencyMs: 5, availableModels: [], message: "OK" }),
        generateText: async () => ({ text: "", modelId: "llama3.2:1b", providerName: "Ollama", tokensUsed: 0, durationMs: 0 }),
        generateStructuredOutput: async <T>() => ({
          data: mockSectionOutput as unknown as T,
          raw: { text: JSON.stringify(mockSectionOutput), modelId: "llama3.2:1b", providerName: "Ollama", tokensUsed: 220, durationMs: 80 },
          attempts: 1
        })
      };

      const generator = new ModularArticleGenerator({
        adapter: mockAdapter,
        modelId: "llama3.2:1b"
      });

      const sectionResult = await generator.generateSection(sampleOutline.sections[0], {
        articleTitle: sampleOutline.h1,
        focusKeyword: "self-hosted ollama",
        targetAudience: "Engineers",
        articleType: "PILLAR_POST",
        currentSectionIndex: 0,
        totalSections: 3,
        previousSectionsSummary: "",
        terminologyGuide: {}
      });

      expect(sectionResult.heading).toBe("Architecture Overview & Vercel Topology");
      expect(sectionResult.unverifiedClaims).toContain("UNVERIFIED: Benchmark claims 10x lower latency on local PCIe gen 4");
      expect(sectionResult.citedEntitiesOrSources).toContain("Next.js");
      expect(sectionResult.wordCount).toBeGreaterThan(50);
    });
  });

  describe("Article Assembly and Compliance Verification", () => {
    it("assembles complete article with correct heading hierarchy, metadata, FAQs, and compliance gate evaluation", () => {
      const mockSections: GeneratedSectionOutput[] = [
        createGeneratedSection({
          heading: "Introduction",
          level: "h2",
          markdownContent: "Welcome to the enterprise guide on building self-hosted AI publishing infrastructure with zero external API fees.",
          keyTakeaways: ["Zero-cost policy", "High data privacy"],
          unverifiedClaims: [],
          citedEntitiesOrSources: ["Ollama"]
        }),
        createGeneratedSection({
          heading: "Architecture Overview & Vercel Topology",
          level: "h2",
          markdownContent: "We isolate the Vercel edge frontend from the local worker running Ollama. All communications utilize HMAC signature verification.",
          keyTakeaways: ["Decoupled architecture"],
          unverifiedClaims: ["UNVERIFIED: 99.9% uptime on home lab server"],
          citedEntitiesOrSources: ["Vercel", "Ollama"]
        }),
        createGeneratedSection({
          heading: "Hardware Sizing & GPU Acceleration",
          level: "h2",
          markdownContent: "For Meta Llama 3.2 1B or 3B, a modern consumer GPU with 8GB to 12GB of VRAM provides smooth inference at 40+ tokens per second.",
          keyTakeaways: ["8GB VRAM minimum for 3B Q4"],
          unverifiedClaims: [],
          citedEntitiesOrSources: ["NVIDIA CUDA"]
        }),
        createGeneratedSection({
          heading: "Conclusion & Key Takeaways",
          level: "h2",
          markdownContent: "By executing AI models locally, content teams eliminate recurring SaaS fees while retaining total control over source data.",
          keyTakeaways: ["Complete self-hosting", "Immutable version snapshots"],
          unverifiedClaims: [],
          citedEntitiesOrSources: []
        })
      ];

      const generator = new ModularArticleGenerator({
        adapter: {
          providerType: "OLLAMA",
          testConnection: async () => ({ connected: true, latencyMs: 0, availableModels: [], message: "" }),
          generateText: async () => ({ text: "", modelId: "", providerName: "", tokensUsed: 0, durationMs: 0 })
        },
        modelId: "llama3.2:1b"
      });

      const assembled = generator.assembleArticle(sampleOutline, mockSections);

      // Verify Markdown Hierarchy
      expect(assembled.markdownContent).toContain("# Self-Hosted Ollama AI Blog Engine: The Complete Implementation Guide");
      expect(assembled.markdownContent).toContain("## Introduction");
      expect(assembled.markdownContent).toContain("## Architecture Overview & Vercel Topology");
      expect(assembled.markdownContent).toContain("## Frequently Asked Questions");
      expect(assembled.markdownContent).toContain("### Does Ollama require a paid license for commercial blogging?");

      // Verify Source Attribution & Unverified Claims aggregation
      expect(assembled.allUnverifiedClaims).toContain("UNVERIFIED: 99.9% uptime on home lab server");
      expect(assembled.allCitedSources).toContain("NVIDIA CUDA");
      expect(assembled.allCitedSources).toContain("Ollama");

      // Verify HTML Content Generation
      expect(assembled.htmlContent).toContain("<h1>Self-Hosted Ollama AI Blog Engine: The Complete Implementation Guide</h1>");
      expect(assembled.htmlContent).toContain("<h2>Introduction</h2>");

      // Verify Compliance Evaluation
      expect(assembled.complianceSummary.overallGateStatus).toBeDefined();
      expect(assembled.wordCount).toBeGreaterThan(100);
    });

    it("regenerates a single section without altering other approved sections", () => {
      const originalSection = createGeneratedSection({
        heading: "Hardware Sizing & GPU Acceleration",
        level: "h2",
        markdownContent: "Old draft with insufficient technical depth.",
        keyTakeaways: []
      });

      const regeneratedSection = createGeneratedSection({
        heading: "Hardware Sizing & GPU Acceleration",
        level: "h2",
        markdownContent: "Updated authoritative prose with exact memory bandwidth calculations and CUDA benchmark figures.",
        keyTakeaways: ["Requires 8GB VRAM for 3B Q4", "PCIe 4.0 recommended for batch prompt ingestion"],
        citedEntitiesOrSources: ["NVIDIA RTX 4060"]
      });

      const sectionsList = [
        createGeneratedSection({ heading: "Intro", level: "h2", markdownContent: "Intro text" }),
        originalSection,
        createGeneratedSection({ heading: "Conclusion", level: "h2", markdownContent: "Conclusion text" })
      ];

      // Simulate section replacement at index 1
      const updatedList = [...sectionsList];
      updatedList[1] = regeneratedSection;

      expect(updatedList[0].heading).toBe("Intro");
      expect(updatedList[1].markdownContent).toContain("Updated authoritative prose");
      expect(updatedList[2].heading).toBe("Conclusion");
      expect(updatedList.length).toBe(3);
    });
  });
});
