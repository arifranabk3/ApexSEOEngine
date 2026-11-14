import { describe, it, expect, vi, beforeEach } from "vitest";
import { TopicClusterOutlineEngine } from "@/services/ai/topic-outline-engine";
import { validateArticleOutline } from "@/services/ai/outline-validator";
import {
  createTopicAnalysisInput,
  TopicAnalysisOutput,
  TopicClusterOutput,
  ArticleOutlineOutput
} from "@/services/ai/topic-outline-schemas";
import { AIProviderAdapter } from "@/services/ai/provider-adapter";

describe("Phase 02.1-C: Topic Cluster & Outline Builder Engine Suite", () => {
  const baseInput = createTopicAnalysisInput({
    websiteId: "site-123",
    mainTopic: "Self-Hosted Ollama AI Blog Engine",
    focusKeyword: "self-hosted ollama",
    secondaryKeywords: ["local llm blogging", "zero cost ai generator"],
    targetCountry: "US",
    targetLanguage: "en",
    targetAudience: "Developers & Technical Bloggers",
    searchIntent: "INFORMATIONAL",
    articleType: "PILLAR_POST"
  });

  const mockAnalysis: TopicAnalysisOutput = {
    mainTopic: "Self-Hosted Ollama AI Blog Engine",
    primaryKeyword: "self-hosted ollama",
    secondaryKeywords: ["local llm blogging", "zero cost ai generator", "llama 3.2 local"],
    supportingSubtopics: [
      "Local Hardware & GPU Setup",
      "Ollama API & JSON Structured Outputs",
      "Next.js Integration Architecture",
      "Production Worker Security & Hardening"
    ],
    searchIntent: "INFORMATIONAL",
    userProblems: [
      "High cloud AI API subscription expenses",
      "Data privacy concerns when sending draft articles to external SaaS",
      "Unreliable JSON schemas from free-form prompting"
    ],
    relatedQuestions: [
      "Can Ollama run efficiently on consumer GPUs?",
      "How to force Ollama to return validated JSON?",
      "Can I run Ollama on a headless VPS worker?"
    ],
    relevantEntities: ["Ollama", "Llama 3.2", "Next.js", "Zod", "PostgreSQL", "CUDA"],
    contentGaps: ["Existing articles lack end-to-end multi-tenant isolation code"],
    suggestedArticleAngle: "Zero-cost developer guide emphasizing strict schema validation",
    practicalUserOutcomes: ["A running local Ollama engine integrated with automated content planning"]
  };

  const mockCluster: TopicClusterOutput = {
    clusterName: "Self-Hosted AI Content Infrastructure",
    pillarTopic: "Self-Hosted Ollama AI Blog Engine",
    pillarKeyword: "self-hosted ollama",
    intent: "INFORMATIONAL",
    supportingArticles: [
      {
        title: "Hardware Sizing & GPU Benchmarks for Ollama",
        targetKeyword: "ollama hardware requirements",
        intent: "INFORMATIONAL",
        relationshipToPillar: "Deep dives on memory and VRAM capacity",
        plannedSlug: "ollama-hardware-requirements"
      },
      {
        title: "Securing Ollama Behind Reverse Proxy & API Keys",
        targetKeyword: "secure ollama endpoint",
        intent: "INFORMATIONAL",
        relationshipToPillar: "Expands on production networking and auth",
        plannedSlug: "secure-ollama-endpoint"
      },
      {
        title: "Comparing Local Llama 3.2 vs DeepSeek R1 for SEO",
        targetKeyword: "llama 3.2 vs deepseek for blogging",
        intent: "COMMERCIAL",
        relationshipToPillar: "Model benchmarking and quality comparison",
        plannedSlug: "llama-3-2-vs-deepseek-seo"
      }
    ],
    internalLinkingStrategy: "All spokes link to the pillar with primary anchor text; the pillar links to spokes in dedicated technical sections.",
    keywordOverlapNotes: "Spoke articles target specific sub-questions to prevent keyword cannibalization.",
    duplicateTopicRisks: ["Ensure GPU hardware guide does not re-explain model installation"]
  };

  const mockOutline: ArticleOutlineOutput = {
    seoTitle: "Self-Hosted Ollama: The Complete Guide to Local AI Blogging",
    metaDescription: "Learn how to build a zero-cost, self-hosted Ollama AI blogging platform with Next.js, local Llama 3.2, and structured JSON output validation.",
    urlSlug: "self-hosted-ollama-guide",
    h1: "The Complete Guide to Self-Hosted Ollama AI Blogging",
    sections: [
      {
        heading: "Introduction to Local AI Blogging Architecture",
        level: "h2",
        objective: "Explain benefits of self-hosted AI over SaaS subscription tools.",
        questionsAnswered: ["Why choose self-hosted Ollama over cloud AI?", "What are the privacy advantages?"],
        suggestedExamples: ["Cost comparison chart: SaaS vs Local"],
        suggestedTableOrComparison: "Cloud AI vs Self-Hosted Ollama feature matrix",
        suggestedDiagramOrVisual: "System Architecture Diagram (Vercel + Local Worker)",
        internalLinkAnchorRecommendations: ["zero cost ai generator"],
        subsections: [
          {
            heading: "The Zero-Cost Policy Explained",
            objective: "Show how local execution eliminates ongoing API fees.",
            questionsAnswered: ["Is Ollama truly free to run?"]
          }
        ]
      },
      {
        heading: "Host Setup & Model Discovery with Llama 3.2",
        level: "h2",
        objective: "Walk through Ollama daemon setup, model discovery, and tags API.",
        questionsAnswered: ["How to verify Ollama model availability?", "What ports are used?"],
        suggestedExamples: ["PowerShell and bash startup commands"],
        internalLinkAnchorRecommendations: ["ollama hardware requirements"],
        subsections: []
      },
      {
        heading: "Structured Output Engineering with Zod Schemas",
        level: "h2",
        objective: "Demonstrate guaranteed JSON parsing and automated retry strategies.",
        questionsAnswered: ["How to prevent malformed JSON in local LLMs?", "How does retry logic work?"],
        suggestedExamples: ["TypeScript Zod schema definition code snippet"],
        internalLinkAnchorRecommendations: [],
        subsections: []
      },
      {
        heading: "Production Security & External Worker Isolation",
        level: "h2",
        objective: "Detail RBAC and token validation between Vercel and the AI worker.",
        questionsAnswered: ["Can Ollama run in Vercel Functions?", "How to protect the local Ollama port?"],
        suggestedExamples: ["Authenticated tunnel configuration"],
        internalLinkAnchorRecommendations: ["secure ollama endpoint"],
        subsections: []
      }
    ],
    conclusionObjective: "Summarize deployment checklist and next steps for automated publishing.",
    practicalTakeaways: [
      "Verify model presence locally before triggering batch tasks",
      "Always validate LLM output with runtime Zod schemas",
      "Separate serverless UI from long-running AI workers"
    ],
    faqs: [
      {
        question: "Can Ollama run on Windows without WSL?",
        answerBrief: "Yes, Ollama natively supports Windows with direct GPU acceleration."
      },
      {
        question: "Does Ollama need an active internet connection?",
        answerBrief: "No, once models are installed, Ollama executes 100% offline."
      }
    ],
    imageSuggestions: [
      {
        context: "Architecture overview diagram",
        suggestedAltText: "Self-hosted Ollama AI architecture diagram showing Vercel and local worker"
      }
    ],
    externalReferenceOpportunities: [
      "https://github.com/ollama/ollama",
      "https://zod.dev"
    ]
  };

  describe("TopicClusterOutlineEngine Integration", () => {
    it("generates structured topic analysis using mocked adapter", async () => {
      const mockAdapter: AIProviderAdapter = {
        providerType: "OLLAMA",
        testConnection: async () => ({ connected: true, latencyMs: 10, availableModels: ["llama3.2:1b"], message: "OK" }),
        generateText: async () => ({ text: "", modelId: "llama3.2:1b", providerName: "Ollama", tokensUsed: 0, durationMs: 0 }),
        generateStructuredOutput: async <T>() => ({
          data: mockAnalysis as unknown as T,
          raw: { text: JSON.stringify(mockAnalysis), modelId: "llama3.2:1b", providerName: "Ollama", tokensUsed: 150, durationMs: 40 },
          attempts: 1
        })
      };

      const engine = new TopicClusterOutlineEngine({
        adapter: mockAdapter,
        modelId: "llama3.2:1b"
      });

      const analysis = await engine.generateTopicAnalysis(baseInput);

      expect(analysis.mainTopic).toBe("Self-Hosted Ollama AI Blog Engine");
      expect(analysis.supportingSubtopics.length).toBeGreaterThanOrEqual(3);
      expect(analysis.relevantEntities).toContain("Ollama");
      expect(analysis.searchIntent).toBe("INFORMATIONAL");
    });

    it("generates a topic cluster with pillar and supporting spoke articles", async () => {
      const mockAdapter: AIProviderAdapter = {
        providerType: "OLLAMA",
        testConnection: async () => ({ connected: true, latencyMs: 10, availableModels: [], message: "OK" }),
        generateText: async () => ({ text: "", modelId: "llama3.2:1b", providerName: "Ollama", tokensUsed: 0, durationMs: 0 }),
        generateStructuredOutput: async <T>() => ({
          data: mockCluster as unknown as T,
          raw: { text: JSON.stringify(mockCluster), modelId: "llama3.2:1b", providerName: "Ollama", tokensUsed: 180, durationMs: 50 },
          attempts: 1
        })
      };

      const engine = new TopicClusterOutlineEngine({
        adapter: mockAdapter,
        modelId: "llama3.2:1b"
      });

      const cluster = await engine.generateTopicCluster(baseInput, mockAnalysis);

      expect(cluster.clusterName).toBe("Self-Hosted AI Content Infrastructure");
      expect(cluster.supportingArticles.length).toBe(3);
      expect(cluster.supportingArticles[0].plannedSlug).toBe("ollama-hardware-requirements");
      expect(cluster.internalLinkingStrategy).toContain("All spokes link to the pillar");
    });

    it("generates an article outline and produces a validation report", async () => {
      const mockAdapter: AIProviderAdapter = {
        providerType: "OLLAMA",
        testConnection: async () => ({ connected: true, latencyMs: 10, availableModels: [], message: "OK" }),
        generateText: async () => ({ text: "", modelId: "llama3.2:1b", providerName: "Ollama", tokensUsed: 0, durationMs: 0 }),
        generateStructuredOutput: async <T>() => ({
          data: mockOutline as unknown as T,
          raw: { text: JSON.stringify(mockOutline), modelId: "llama3.2:1b", providerName: "Ollama", tokensUsed: 350, durationMs: 90 },
          attempts: 1
        })
      };

      const engine = new TopicClusterOutlineEngine({
        adapter: mockAdapter,
        modelId: "llama3.2:1b"
      });

      const { outline, validation } = await engine.generateArticleOutline(baseInput, mockAnalysis, mockCluster);

      expect(outline.seoTitle).toContain("Self-Hosted Ollama");
      expect(outline.sections.length).toBe(4);
      expect(validation.verdict).toBe("PASS");
      expect(validation.canProceedToGeneration).toBe(true);
      expect(validation.score).toBe(100);
      expect(validation.metrics.h2Count).toBe(4);
    });
  });

  describe("Outline Quality Gate & Heuristics Validation", () => {
    it("flags duplicate headings with BLOCKED verdict", () => {
      const duplicateHeadingOutline: ArticleOutlineOutput = {
        ...mockOutline,
        sections: [
          ...mockOutline.sections,
          {
            heading: "Introduction to Local AI Blogging Architecture", // duplicate of section 0
            level: "h2",
            objective: "Duplicate section content",
            questionsAnswered: ["Duplicate?"],
            suggestedExamples: [],
            internalLinkAnchorRecommendations: [],
            subsections: []
          }
        ]
      };

      const report = validateArticleOutline(duplicateHeadingOutline, baseInput);

      expect(report.verdict).toBe("BLOCKED");
      expect(report.canProceedToGeneration).toBe(false);
      expect(report.issues.some((i) => i.code === "DUPLICATE_HEADING")).toBe(true);
    });

    it("issues WARNING when SEO title does not include focus keyword", () => {
      const mismatchOutline: ArticleOutlineOutput = {
        ...mockOutline,
        seoTitle: "Completely Unrelated Tech Article on Web Servers",
        h1: "Completely Unrelated Tech Article on Web Servers"
      };

      const report = validateArticleOutline(mismatchOutline, baseInput);

      expect(report.verdict).toBe("WARNING");
      expect(report.canProceedToGeneration).toBe(true); // warnings allow proceeding
      expect(report.issues.some((i) => i.code === "TITLE_KEYWORD_MISMATCH")).toBe(true);
      expect(report.score).toBeLessThan(100);
    });

    it("blocks outline when H2 depth is insufficient (< 3 H2s)", () => {
      const thinOutline: ArticleOutlineOutput = {
        ...mockOutline,
        sections: [mockOutline.sections[0], mockOutline.sections[1]] // Only 2 H2 sections
      };

      const report = validateArticleOutline(thinOutline, baseInput);

      expect(report.verdict).toBe("BLOCKED");
      expect(report.canProceedToGeneration).toBe(false);
      expect(report.issues.some((i) => i.code === "INSUFFICIENT_H2_DEPTH")).toBe(true);
    });
  });
});
