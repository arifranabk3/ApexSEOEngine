import { AIProviderAdapter } from "./provider-adapter";
import {
  TopicAnalysisInput,
  TopicAnalysisOutput,
  TopicAnalysisOutputSchema,
  TopicClusterOutput,
  TopicClusterOutputSchema,
  ArticleOutlineOutput,
  ArticleOutlineOutputSchema,
  OutlineValidationReport
} from "./topic-outline-schemas";
import { validateArticleOutline } from "./outline-validator";

export interface TopicOutlineGeneratorOptions {
  adapter: AIProviderAdapter;
  modelId: string;
}

/**
 * Production-grade Topic Cluster & Outline Builder Engine.
 * Interacts with OllamaAdapter using structured JSON mode & Zod schemas.
 */
export class TopicClusterOutlineEngine {
  constructor(private readonly opts: TopicOutlineGeneratorOptions) {}

  /**
   * Generates comprehensive topic analysis, entity identification, user pain points, and angle.
   */
  async generateTopicAnalysis(input: TopicAnalysisInput): Promise<TopicAnalysisOutput> {
    if (!this.opts.adapter.generateStructuredOutput) {
      throw new Error("AI provider adapter does not support generateStructuredOutput");
    }

    const systemPrompt = `You are an expert enterprise SEO strategist and subject matter researcher.
Generate a comprehensive, truthful, and actionable topic analysis.
IMPORTANT RULES:
- Do not invent keyword search volumes, difficulties, or CPC values.
- Focus on user search intent, entities, real searcher problems, and content gaps.
- Return ONLY valid JSON adhering strictly to the requested schema.`;

    const prompt = `Perform an in-depth SEO topic analysis for the following content plan:
- Main Topic: ${input.mainTopic}
- Primary Focus Keyword: ${input.focusKeyword}
- Secondary Keywords: ${input.secondaryKeywords.join(", ") || "None specified"}
- Target Audience: ${input.targetAudience}
- Target Country: ${input.targetCountry}
- Target Language: ${input.targetLanguage}
- Intended Search Intent: ${input.searchIntent}
- Article Type: ${input.articleType}
${input.referenceUrls.length > 0 ? `- Reference Context: ${input.referenceUrls.join(", ")}` : ""}

Generate the structured JSON analysis with:
1. mainTopic
2. primaryKeyword
3. secondaryKeywords (at least 3 high-intent variants)
4. supportingSubtopics (at least 4 logical subtopics)
5. searchIntent (must be ${input.searchIntent})
6. userProblems (at least 3 actual problems searchers face)
7. relatedQuestions (at least 4 questions real people ask)
8. relevantEntities (named entities, technical concepts, standards)
9. contentGaps (weaknesses in current SERP content)
10. suggestedArticleAngle (unique, practical editorial perspective)
11. practicalUserOutcomes (actionable results after reading)`;

    const result = await this.opts.adapter.generateStructuredOutput(
      {
        modelId: this.opts.modelId,
        prompt,
        systemPrompt,
        temperature: 0.5
      },
      TopicAnalysisOutputSchema,
      2
    );

    return result.data;
  }

  /**
   * Generates a topical cluster containing pillar topic and supporting cluster articles
   * with internal linking relationships and overlap avoidance.
   */
  async generateTopicCluster(
    input: TopicAnalysisInput,
    analysis?: TopicAnalysisOutput
  ): Promise<TopicClusterOutput> {
    if (!this.opts.adapter.generateStructuredOutput) {
      throw new Error("AI provider adapter does not support generateStructuredOutput");
    }

    const systemPrompt = `You are an information architect and SEO topical authority specialist.
Organize topical clusters with clear pillar-spoke architecture.
Never invent search metrics or fake ranking positions.
Return ONLY valid JSON matching the schema.`;

    const prompt = `Build an SEO topic cluster for the following topic:
- Pillar Topic: ${input.mainTopic}
- Pillar Keyword: ${input.focusKeyword}
- Target Audience: ${input.targetAudience}
- Core Search Intent: ${input.searchIntent}
${analysis ? `- Key Entities: ${analysis.relevantEntities.join(", ")}\n- Supporting Subtopics: ${analysis.supportingSubtopics.join(", ")}` : ""}

Generate JSON with:
1. clusterName
2. pillarTopic
3. pillarKeyword
4. intent (${input.searchIntent})
5. supportingArticles: list of at least 4 distinct supporting spoke articles. Each must specify:
   - title
   - targetKeyword
   - intent (INFORMATIONAL, COMMERCIAL, TRANSACTIONAL, or NAVIGATIONAL)
   - relationshipToPillar (how it links back or expands on a subtopic)
   - plannedSlug (clean URL slug)
6. internalLinkingStrategy (clear bi-directional linking rules)
7. keywordOverlapNotes (how cannibalization between pillar and spokes is prevented)
8. duplicateTopicRisks (potential overlaps to watch out for)`;

    const result = await this.opts.adapter.generateStructuredOutput(
      {
        modelId: this.opts.modelId,
        prompt,
        systemPrompt,
        temperature: 0.4
      },
      TopicClusterOutputSchema,
      2
    );

    return result.data;
  }

  /**
   * Generates a complete, structured article outline with section objectives,
   * questions answered, suggested diagrams/tables, internal links, and FAQs.
   */
  async generateArticleOutline(
    input: TopicAnalysisInput,
    analysis?: TopicAnalysisOutput,
    cluster?: TopicClusterOutput
  ): Promise<{ outline: ArticleOutlineOutput; validation: OutlineValidationReport }> {
    if (!this.opts.adapter.generateStructuredOutput) {
      throw new Error("AI provider adapter does not support generateStructuredOutput");
    }

    const systemPrompt = `You are a chief content officer and SEO editorial architect.
Design exhaustive, logically organized article blueprints.
Every heading must deliver immediate value. Avoid repetitive fluff or filler sections.
Return ONLY valid JSON matching the schema.`;

    const prompt = `Generate a comprehensive, publication-ready article outline for:
- Title / Topic: ${input.mainTopic}
- Focus Keyword: ${input.focusKeyword}
- Secondary Keywords: ${input.secondaryKeywords.join(", ") || (analysis?.secondaryKeywords.join(", ") ?? "")}
- Article Type: ${input.articleType}
- Target Audience: ${input.targetAudience}
- Search Intent: ${input.searchIntent}
${cluster ? `- Cluster Context: Pillar "${cluster.pillarTopic}" with spokes: ${cluster.supportingArticles.map((s) => s.targetKeyword).join(", ")}` : ""}

Generate JSON with:
1. seoTitle (45-65 chars, includes "${input.focusKeyword}")
2. metaDescription (120-160 chars, engaging, includes keyword)
3. urlSlug (clean hyphenated slug)
4. h1 (clear, high-value main title)
5. sections: at least 4 comprehensive H2 sections. Each section must provide:
   - heading
   - level ("h2")
   - objective (clear editorial goal)
   - questionsAnswered (at least 2 specific questions)
   - suggestedExamples (practical scenarios or code/tool examples)
   - suggestedTableOrComparison (optional comparison table concept)
   - suggestedDiagramOrVisual (optional diagram / flowchart concept)
   - internalLinkAnchorRecommendations (contextual anchor text suggestions)
   - subsections (array of H3 subsections if appropriate)
6. conclusionObjective (summary of practical takeaways)
7. practicalTakeaways (at least 3 actionable items)
8. faqs (at least 3 high-value questions with concise answer briefs)
9. imageSuggestions (at least 2 visual ideas with alt texts)
10. externalReferenceOpportunities (high-authority documentation or benchmark references)`;

    const result = await this.opts.adapter.generateStructuredOutput(
      {
        modelId: this.opts.modelId,
        prompt,
        systemPrompt,
        temperature: 0.5
      },
      ArticleOutlineOutputSchema,
      2
    );

    const validation = validateArticleOutline(result.data, input);

    return {
      outline: result.data,
      validation
    };
  }
}
