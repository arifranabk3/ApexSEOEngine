import { AIProviderAdapter } from "./provider-adapter";
import {
  ArticleOutlineOutput,
  OutlineSection
} from "./topic-outline-schemas";
import {
  GeneratedSectionOutput,
  GeneratedSectionOutputSchema,
  SectionGenerationContext,
  AssembledArticleResult,
  createGeneratedSection
} from "./modular-article-schemas";
import { evaluateGoogleSearchComplianceGate } from "@/services/compliance/seo-quality-gate";

/**
 * Lightweight native Markdown to HTML converter to maintain zero external dependencies.
 */
function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const htmlLines: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("# ")) {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      htmlLines.push(`<h1>${trimmed.slice(2)}</h1>`);
    } else if (trimmed.startsWith("## ")) {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      htmlLines.push(`<h2>${trimmed.slice(3)}</h2>`);
    } else if (trimmed.startsWith("### ")) {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      htmlLines.push(`<h3>${trimmed.slice(4)}</h3>`);
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (!inList) { htmlLines.push("<ul>"); inList = true; }
      htmlLines.push(`<li>${trimmed.slice(2)}</li>`);
    } else if (trimmed === "") {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
    } else {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      htmlLines.push(`<p>${trimmed}</p>`);
    }
  }

  if (inList) {
    htmlLines.push("</ul>");
  }

  return `<main><article>${htmlLines.join("\n")}</article></main>`;
}

export interface ModularArticleGeneratorOptions {
  adapter: AIProviderAdapter;
  modelId: string;
}

export class ModularArticleGenerator {
  constructor(private readonly opts: ModularArticleGeneratorOptions) {}

  /**
   * Generates a single article section using strict contextual anchoring,
   * avoiding single-prompt hallucinations and preserving article voice.
   */
  async generateSection(
    section: OutlineSection,
    context: SectionGenerationContext
  ): Promise<GeneratedSectionOutput> {
    if (!this.opts.adapter.generateStructuredOutput) {
      throw new Error("AI provider adapter does not support generateStructuredOutput");
    }

    const systemPrompt = `You are a principal technical author and subject matter expert.
Generate the assigned section of an enterprise long-form article.
CRITICAL INTEGRITY RULES:
1. NEVER fabricate statistics, research citations, benchmark numbers, or quotes.
2. If citing an external claim that cannot be verified locally, explicitly list it in 'unverifiedClaims'.
3. Maintain exact technical terminology consistency with previous sections.
4. Output valid GitHub Flavored Markdown inside the markdownContent field.
5. Return ONLY valid JSON adhering strictly to the requested schema.`;

    const prompt = `Generate Section #${context.currentSectionIndex + 1} of ${context.totalSections}:
- Overall Article Title: ${context.articleTitle}
- Primary Focus Keyword: ${context.focusKeyword}
- Target Audience: ${context.targetAudience}
- Section Heading: ${section.heading} (${section.level.toUpperCase()})
- Section Objective: ${section.objective}
- Specific Questions to Answer: ${section.questionsAnswered.join(" | ")}
${section.suggestedExamples.length > 0 ? `- Examples/Scenarios: ${section.suggestedExamples.join(", ")}` : ""}
${section.suggestedTableOrComparison ? `- Include Markdown Comparison Table: ${section.suggestedTableOrComparison}` : ""}
${section.suggestedDiagramOrVisual ? `- Mention/Describe Visual Concept: ${section.suggestedDiagramOrVisual}` : ""}
${context.previousSectionsSummary ? `- Context of Previous Sections:\n${context.previousSectionsSummary}` : ""}

Return JSON with:
1. heading ("${section.heading}")
2. level ("${section.level}")
3. markdownContent (Detailed, authoritative Markdown with subheadings, bullet points, or code if needed; at least 150 words)
4. keyTakeaways (at least 2 actionable points from this section)
5. unverifiedClaims (array of any claims requiring human fact-checking or marked UNVERIFIED)
6. citedEntitiesOrSources (array of verified libraries, tools, or specifications referenced)
7. wordCount (word count of markdownContent)`;

    const result = await this.opts.adapter.generateStructuredOutput(
      {
        modelId: this.opts.modelId,
        prompt,
        systemPrompt,
        temperature: 0.4
      },
      GeneratedSectionOutputSchema,
      2
    );

    return createGeneratedSection(result.data);
  }

  /**
   * Generates the Introduction section.
   */
  async generateIntroduction(
    outline: ArticleOutlineOutput,
    focusKeyword: string,
    targetAudience: string
  ): Promise<GeneratedSectionOutput> {
    const introSection: OutlineSection = {
      heading: "Introduction",
      level: "h2",
      objective: "Hook the reader, introduce the primary problem, and explain what will be accomplished.",
      questionsAnswered: [`What is ${focusKeyword}?`, "Why is this important now?"],
      suggestedExamples: [],
      internalLinkAnchorRecommendations: [],
      subsections: []
    };

    return this.generateSection(introSection, {
      articleTitle: outline.h1,
      focusKeyword,
      targetAudience,
      articleType: "PILLAR_POST",
      currentSectionIndex: 0,
      totalSections: outline.sections.length + 2,
      previousSectionsSummary: "",
      terminologyGuide: {}
    });
  }

  /**
   * Generates the Conclusion and Practical Takeaways section.
   */
  async generateConclusion(
    outline: ArticleOutlineOutput,
    focusKeyword: string,
    targetAudience: string,
    previousSectionsSummary: string
  ): Promise<GeneratedSectionOutput> {
    const conclusionSection: OutlineSection = {
      heading: "Conclusion & Key Takeaways",
      level: "h2",
      objective: outline.conclusionObjective,
      questionsAnswered: ["What are the final recommendations?", "What should the reader do next?"],
      suggestedExamples: outline.practicalTakeaways,
      internalLinkAnchorRecommendations: [],
      subsections: []
    };

    return this.generateSection(conclusionSection, {
      articleTitle: outline.h1,
      focusKeyword,
      targetAudience,
      articleType: "PILLAR_POST",
      currentSectionIndex: outline.sections.length + 1,
      totalSections: outline.sections.length + 2,
      previousSectionsSummary,
      terminologyGuide: {}
    });
  }

  /**
   * Assembles all generated sections into complete Markdown and HTML documents,
   * runs the Google Search & AdSense compliance quality gate, and compiles unverified claims.
   */
  assembleArticle(
    outline: ArticleOutlineOutput,
    sections: GeneratedSectionOutput[],
    siteUrl: string = "https://apexseoengine.vercel.app"
  ): AssembledArticleResult {
    // 1. Compile Markdown Document with strict H1/H2/H3 hierarchy
    const markdownParts: string[] = [`# ${outline.h1}\n`];
    const allUnverifiedClaims: string[] = [];
    const allCitedSources: string[] = [];

    for (const sec of sections) {
      if (sec.heading.toLowerCase() !== "introduction" && sec.heading.toLowerCase() !== "conclusion & key takeaways") {
        const prefix = sec.level === "h3" ? "###" : "##";
        markdownParts.push(`${prefix} ${sec.heading}\n`);
      } else {
        markdownParts.push(`## ${sec.heading}\n`);
      }

      markdownParts.push(`${sec.markdownContent.trim()}\n`);

      if (sec.unverifiedClaims?.length > 0) {
        allUnverifiedClaims.push(...sec.unverifiedClaims);
      }
      if (sec.citedEntitiesOrSources?.length > 0) {
        allCitedSources.push(...sec.citedEntitiesOrSources);
      }
    }

    // 2. Append FAQs if defined in outline
    if (outline.faqs && outline.faqs.length > 0) {
      markdownParts.push("## Frequently Asked Questions\n");
      for (const faq of outline.faqs) {
        markdownParts.push(`### ${faq.question}\n`);
        markdownParts.push(`${faq.answerBrief}\n`);
      }
    }

    const fullMarkdown = markdownParts.join("\n");
    const fullHtml = markdownToHtml(fullMarkdown);
    const wordCount = fullMarkdown.trim().split(/\s+/).filter(Boolean).length;

    // 3. Evaluate Compliance Quality Gate
    const pageUrl = `${siteUrl.replace(/\/$/, "")}/${outline.urlSlug}`;
    const gateReport = evaluateGoogleSearchComplianceGate({
      technical: {
        pageUrl,
        canonicalUrl: pageUrl,
        htmlContent: fullHtml
      },
      onPage: {
        title: outline.seoTitle,
        metaDescription: outline.metaDescription,
        slug: outline.urlSlug,
        searchIntent: "INFORMATIONAL",
        htmlContent: fullHtml
      },
      qualityAndSpam: {
        title: outline.h1,
        htmlContent: fullHtml,
        authorName: "Apex AI Editorial Staff"
      },
      pageExperience: {
        htmlContent: fullHtml
      }
    });

    return {
      title: outline.h1,
      slug: outline.urlSlug,
      metaTitle: outline.seoTitle,
      metaDescription: outline.metaDescription,
      excerpt: outline.metaDescription,
      markdownContent: fullMarkdown,
      htmlContent: fullHtml,
      wordCount,
      sections,
      allUnverifiedClaims: Array.from(new Set(allUnverifiedClaims)),
      allCitedSources: Array.from(new Set(allCitedSources)),
      complianceSummary: {
        canPublishDirectly: gateReport.canAutoPublish,
        overallGateStatus: gateReport.overallGateStatus,
        blockingIssuesCount: gateReport.blockingIssues.length,
        warningsCount: gateReport.warningsToReview.length
      }
    };
  }
}
