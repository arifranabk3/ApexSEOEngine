"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Layers,
  ListTree,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ShieldAlert,
  Save,
  Plus,
  Trash2,
  FileCheck
} from "lucide-react";
import type {
  TopicAnalysisOutput,
  TopicClusterOutput,
  ArticleOutlineOutput,
  OutlineValidationReport,
  SearchIntentType,
  ArticleType
} from "@/services/ai/topic-outline-schemas";

interface TopicOutlineWorkflowProps {
  websiteId: string;
  websiteName?: string;
  onPlanSaved?: (data: { briefId: string; articleId?: string }) => void;
}

export function TopicOutlineWorkflow({
  websiteId,
  websiteName,
  onPlanSaved
}: TopicOutlineWorkflowProps) {
  // Step tracker: 1 (Config) -> 2 (Analysis) -> 3 (Cluster) -> 4 (Outline & Editor) -> 5 (Validated & Saved)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [mainTopic, setMainTopic] = useState("Self-Hosted Ollama AI Blog Engine");
  const [focusKeyword, setFocusKeyword] = useState("self-hosted ollama");
  const [secondaryKeywordsStr, setSecondaryKeywordsStr] = useState(
    "local llm blogging, zero cost ai generator, llama 3.2 local"
  );
  const [targetAudience, setTargetAudience] = useState("Technical Bloggers & Developers");
  const [targetCountry, setTargetCountry] = useState("US");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [searchIntent, setSearchIntent] = useState<SearchIntentType>("INFORMATIONAL");
  const [articleType, setArticleType] = useState<ArticleType>("PILLAR_POST");

  // Output State
  const [analysis, setAnalysis] = useState<TopicAnalysisOutput | null>(null);
  const [cluster, setCluster] = useState<TopicClusterOutput | null>(null);
  const [outline, setOutline] = useState<ArticleOutlineOutput | null>(null);
  const [validation, setValidation] = useState<OutlineValidationReport | null>(null);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Parse secondary keywords helper
  const getSecondaryKeywords = () =>
    secondaryKeywordsStr
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

  const buildInputPayload = () => ({
    websiteId,
    mainTopic,
    focusKeyword,
    secondaryKeywords: getSecondaryKeywords(),
    targetAudience,
    targetCountry,
    targetLanguage,
    searchIntent,
    articleType
  });

  // 1. Generate Topic Analysis
  const handleGenerateAnalysis = async () => {
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage("Running Topic Analysis with local Ollama engine...");
    try {
      const res = await fetch("/api/v1/content/topic-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "analyze_topic",
          input: buildInputPayload()
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to generate topic analysis");
      }

      setAnalysis(json.data.analysis);
      setCurrentStep(2);
      setStatusMessage("Topic analysis generated successfully!");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error generating analysis");
    } finally {
      setLoading(false);
    }
  };

  // 2. Generate Topic Cluster
  const handleGenerateCluster = async () => {
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage("Organizing Topic Cluster & Spoke Articles...");
    try {
      const res = await fetch("/api/v1/content/topic-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "generate_cluster",
          input: buildInputPayload(),
          analysis: analysis || undefined
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to generate topic cluster");
      }

      setCluster(json.data.cluster);
      setCurrentStep(3);
      setStatusMessage("Topical cluster generated!");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error generating cluster");
    } finally {
      setLoading(false);
    }
  };

  // 3. Generate Article Outline
  const handleGenerateOutline = async () => {
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage("Generating structured, multi-tier article blueprint...");
    try {
      const res = await fetch("/api/v1/content/topic-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "generate_outline",
          input: buildInputPayload(),
          analysis: analysis || undefined,
          cluster: cluster || undefined
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to generate outline");
      }

      setOutline(json.data.outline);
      setValidation(json.data.validation);
      setCurrentStep(4);
      setStatusMessage("Outline generated and validated against quality gate!");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error generating outline");
    } finally {
      setLoading(false);
    }
  };

  // 4. Validate Edited Outline (Client/API recheck)
  const handleValidateEditedOutline = async () => {
    if (!outline) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/v1/content/topic-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "validate_outline",
          input: buildInputPayload(),
          outline
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to validate outline");
      }

      setValidation(json.data.validation);
      setStatusMessage("Outline validated! Review quality gate status.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Validation error");
    } finally {
      setLoading(false);
    }
  };

  // 5. Save Plan (Persist Cluster + ContentBrief + Article Draft)
  const handleSavePlan = async () => {
    if (!outline) return;
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage("Saving approved plan to database...");
    try {
      const res = await fetch("/api/v1/content/topic-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "save_plan",
          websiteId,
          keyword: focusKeyword,
          cluster: cluster || undefined,
          outline,
          createArticleDraft: true
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to save plan");
      }

      setSavedSuccess(true);
      setCurrentStep(5);
      setStatusMessage("Topic plan and article draft successfully persisted!");
      if (onPlanSaved) {
        onPlanSaved({ briefId: json.data.briefId, articleId: json.data.articleId });
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error saving plan");
    } finally {
      setLoading(false);
    }
  };

  // Outline Editing Helpers
  const updateSectionHeading = (index: number, newHeading: string) => {
    if (!outline) return;
    const newSections = [...outline.sections];
    newSections[index] = { ...newSections[index], heading: newHeading };
    setOutline({ ...outline, sections: newSections });
  };

  const updateSectionObjective = (index: number, newObjective: string) => {
    if (!outline) return;
    const newSections = [...outline.sections];
    newSections[index] = { ...newSections[index], objective: newObjective };
    setOutline({ ...outline, sections: newSections });
  };

  const removeSection = (index: number) => {
    if (!outline) return;
    const newSections = outline.sections.filter((_, i) => i !== index);
    setOutline({ ...outline, sections: newSections });
  };

  const addSection = () => {
    if (!outline) return;
    const newSection = {
      heading: "New Section Heading",
      level: "h2" as const,
      objective: "Specific editorial objective for this section",
      questionsAnswered: ["What question does this answer?"],
      suggestedExamples: [],
      internalLinkAnchorRecommendations: [],
      subsections: []
    };
    setOutline({ ...outline, sections: [...outline.sections, newSection] });
  };

  return (
    <div className="space-y-6">
      {/* Workflow Navigation Tracker */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-blue-600 dark:text-blue-400">
          <Sparkles className="w-4 h-4" />
          <span>Topic Cluster &amp; Outline Builder (Phase 02.1-C)</span>
        </div>

        <div className="flex items-center gap-1 font-semibold text-[11px]">
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className={`px-2.5 py-1 rounded-lg ${
              currentStep === 1 ? "bg-blue-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            }`}
          >
            1. Configure
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <button
            type="button"
            disabled={!analysis}
            onClick={() => setCurrentStep(2)}
            className={`px-2.5 py-1 rounded-lg disabled:opacity-40 ${
              currentStep === 2 ? "bg-blue-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            }`}
          >
            2. Analysis
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <button
            type="button"
            disabled={!cluster}
            onClick={() => setCurrentStep(3)}
            className={`px-2.5 py-1 rounded-lg disabled:opacity-40 ${
              currentStep === 3 ? "bg-blue-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            }`}
          >
            3. Cluster
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <button
            type="button"
            disabled={!outline}
            onClick={() => setCurrentStep(4)}
            className={`px-2.5 py-1 rounded-lg disabled:opacity-40 ${
              currentStep === 4 ? "bg-blue-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            }`}
          >
            4. Outline &amp; Gate
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <button
            type="button"
            disabled={!savedSuccess}
            onClick={() => setCurrentStep(5)}
            className={`px-2.5 py-1 rounded-lg disabled:opacity-40 ${
              currentStep === 5 ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            }`}
          >
            5. Saved
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {statusMessage && (
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* STEP 1: CONFIGURATION */}
      {currentStep === 1 && (
        <div className="apex-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold">Step 1: Topic Strategy &amp; Targeting</h2>
              <p className="text-xs text-slate-500">
                Targeting website: <strong>{websiteName || websiteId}</strong>
              </p>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              Zero-Cost Local AI
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Main Topic
              </label>
              <input
                value={mainTopic}
                onChange={(e) => setMainTopic(e.target.value)}
                placeholder="e.g. Complete Guide to Self-Hosted Ollama"
                className="apex-input"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Primary Focus Keyword
              </label>
              <input
                value={focusKeyword}
                onChange={(e) => setFocusKeyword(e.target.value)}
                placeholder="e.g. self-hosted ollama"
                className="apex-input"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Secondary Keywords (Comma-separated)
              </label>
              <input
                value={secondaryKeywordsStr}
                onChange={(e) => setSecondaryKeywordsStr(e.target.value)}
                placeholder="local llm blogging, zero cost ai generator, llama 3.2 local"
                className="apex-input"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Search Intent
              </label>
              <select
                value={searchIntent}
                onChange={(e) => setSearchIntent(e.target.value as SearchIntentType)}
                className="apex-input"
              >
                <option value="INFORMATIONAL">INFORMATIONAL (Guides, tutorials, explainers)</option>
                <option value="COMMERCIAL">COMMERCIAL (Comparisons, alternatives, reviews)</option>
                <option value="TRANSACTIONAL">TRANSACTIONAL (Downloads, templates, setups)</option>
                <option value="NAVIGATIONAL">NAVIGATIONAL (Brand, tool access)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Article Type
              </label>
              <select
                value={articleType}
                onChange={(e) => setArticleType(e.target.value as ArticleType)}
                className="apex-input"
              >
                <option value="PILLAR_POST">Pillar Post (Broad cornerstone guide)</option>
                <option value="HOW_TO_GUIDE">How-To Guide (Step-by-step walkthrough)</option>
                <option value="COMPARISON_REVIEW">Comparison / Review (Model benchmarks)</option>
                <option value="BEGINNERS_GUIDE">Beginners Guide (Foundational concepts)</option>
                <option value="TROUBLESHOOTING_GUIDE">Troubleshooting Guide (Error fixing)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                Target Audience
              </label>
              <input
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="apex-input"
              />
            </div>

            <div className="flex gap-2">
              <div className="w-1/2">
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Country
                </label>
                <input
                  value={targetCountry}
                  onChange={(e) => setTargetCountry(e.target.value)}
                  className="apex-input"
                />
              </div>
              <div className="w-1/2">
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Language
                </label>
                <input
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="apex-input"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              type="button"
              disabled={loading || !mainTopic || !focusKeyword}
              onClick={handleGenerateAnalysis}
              className="apex-btn-primary flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{loading ? "Analyzing..." : "Generate AI Topic Analysis"}</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: TOPIC ANALYSIS REVIEW */}
      {currentStep === 2 && analysis && (
        <div className="apex-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold">Step 2: AI Topic Analysis &amp; Entity Map</h2>
              <p className="text-xs text-slate-500">
                Pillar: {analysis.mainTopic} &bull; Intent: {analysis.searchIntent}
              </p>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={handleGenerateCluster}
              className="apex-btn-primary flex items-center gap-2 text-xs"
            >
              <Layers className="w-4 h-4" />
              <span>{loading ? "Clustering..." : "Next: Generate Topic Cluster"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="font-bold text-slate-700 dark:text-slate-300 block">
                Target User Problems
              </span>
              <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-400">
                {analysis.userProblems.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="font-bold text-slate-700 dark:text-slate-300 block">
                Search Questions (People Also Ask)
              </span>
              <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-400">
                {analysis.relatedQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="font-bold text-slate-700 dark:text-slate-300 block">
                Key Entities &amp; Concepts
              </span>
              <div className="flex flex-wrap gap-1.5">
                {analysis.relevantEntities.map((ent, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono text-[11px]"
                  >
                    {ent}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="font-bold text-slate-700 dark:text-slate-300 block">
                Content Gaps in SERPs
              </span>
              <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-400">
                {analysis.contentGaps.map((gap, i) => (
                  <li key={i}>{gap}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-950/80 text-xs text-slate-600 dark:text-slate-400">
            <strong>Suggested Editorial Angle:</strong> {analysis.suggestedArticleAngle}
          </div>
        </div>
      )}

      {/* STEP 3: TOPIC CLUSTER ARCHITECTURE */}
      {currentStep === 3 && cluster && (
        <div className="apex-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold">Step 3: Topic Cluster Architecture</h2>
              <p className="text-xs text-slate-500">
                Cluster: <strong>{cluster.clusterName}</strong> &bull; Pillar: {cluster.pillarKeyword}
              </p>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={handleGenerateOutline}
              className="apex-btn-primary flex items-center gap-2 text-xs"
            >
              <ListTree className="w-4 h-4" />
              <span>{loading ? "Outlining..." : "Next: Generate Structured Outline"}</span>
            </button>
          </div>

          <div className="space-y-3">
            <span className="font-bold text-xs text-slate-700 dark:text-slate-300 block">
              Planned Supporting Spoke Articles ({cluster.supportingArticles.length})
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {cluster.supportingArticles.map((spoke, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                >
                  <div className="font-bold text-slate-800 dark:text-slate-100">{spoke.title}</div>
                  <div className="text-blue-500 font-mono text-[11px]">
                    Keyword: {spoke.targetKeyword}
                  </div>
                  <div className="text-slate-500 text-[11px]">{spoke.relationshipToPillar}</div>
                  <div className="text-[10px] text-slate-400 font-mono">/{spoke.plannedSlug}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-950/80 text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <div>
              <strong>Internal Linking Strategy:</strong> {cluster.internalLinkingStrategy}
            </div>
            <div>
              <strong>Cannibalization Prevention:</strong> {cluster.keywordOverlapNotes}
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: OUTLINE EDITOR & QUALITY GATE */}
      {currentStep === 4 && outline && (
        <div className="space-y-4">
          {/* Quality Gate Card */}
          {validation && (
            <div
              className={`p-4 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-3 ${
                validation.verdict === "PASS"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  : validation.verdict === "WARNING"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
              }`}
            >
              <div className="space-y-1">
                <div className="font-bold flex items-center gap-2">
                  {validation.verdict === "PASS" ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : validation.verdict === "WARNING" ? (
                    <AlertTriangle className="w-4 h-4" />
                  ) : (
                    <ShieldAlert className="w-4 h-4" />
                  )}
                  <span>Outline Quality Gate: {validation.verdict}</span>
                  <span className="font-mono">({validation.score}/100)</span>
                </div>
                <div className="text-[11px] opacity-90">
                  {validation.metrics.h2Count} H2 Sections &bull; {validation.metrics.faqCount} FAQs &bull; Est. Words: ~{validation.metrics.estimatedWordCount}
                </div>
                {validation.issues.length > 0 && (
                  <ul className="list-disc pl-4 text-[11px] space-y-0.5 mt-1">
                    {validation.issues.map((iss, i) => (
                      <li key={i}>
                        [{iss.type}] {iss.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleValidateEditedOutline}
                  className="px-3 py-1.5 rounded-lg border border-current text-xs font-semibold hover:opacity-80 transition"
                >
                  Re-Validate Outline
                </button>
                <button
                  type="button"
                  disabled={loading || !validation.canProceedToGeneration}
                  onClick={handleSavePlan}
                  className="apex-btn-primary flex items-center gap-1.5 text-xs"
                >
                  <Save className="w-4 h-4" />
                  <span>{loading ? "Saving..." : "Approve & Save Plan"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Interactive Outline Editor */}
          <div className="apex-card p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-bold">Step 4: Interactive Outline Editor</h2>
                <p className="text-xs text-slate-500">
                  Review and customize headings, objectives, and questions answered before saving.
                </p>
              </div>
              <button
                type="button"
                onClick={addSection}
                className="px-3 py-1.5 rounded-lg border border-blue-500 text-blue-500 hover:bg-blue-500/10 text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Section</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1 text-slate-600 dark:text-slate-400">
                  SEO Title
                </label>
                <input
                  value={outline.seoTitle}
                  onChange={(e) => setOutline({ ...outline, seoTitle: e.target.value })}
                  className="apex-input"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1 text-slate-600 dark:text-slate-400">
                  URL Slug
                </label>
                <input
                  value={outline.urlSlug}
                  onChange={(e) => setOutline({ ...outline, urlSlug: e.target.value })}
                  className="apex-input font-mono"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block font-semibold mb-1 text-slate-600 dark:text-slate-400">
                  Meta Description
                </label>
                <textarea
                  rows={2}
                  value={outline.metaDescription}
                  onChange={(e) => setOutline({ ...outline, metaDescription: e.target.value })}
                  className="apex-input"
                />
              </div>
            </div>

            {/* Sections List */}
            <div className="space-y-3 pt-2">
              <span className="font-bold text-xs text-slate-700 dark:text-slate-300 block">
                Outline Sections ({outline.sections.length})
              </span>
              {outline.sections.map((sec, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="font-mono font-bold text-blue-500 text-xs">
                        H2 #{idx + 1}
                      </span>
                      <input
                        value={sec.heading}
                        onChange={(e) => updateSectionHeading(idx, e.target.value)}
                        className="apex-input font-semibold text-xs py-1"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSection(idx)}
                      title="Remove section"
                      className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div>
                    <input
                      value={sec.objective}
                      onChange={(e) => updateSectionObjective(idx, e.target.value)}
                      placeholder="Section objective..."
                      className="apex-input text-[11px] text-slate-600 dark:text-slate-400 py-1"
                    />
                  </div>

                  {sec.questionsAnswered.length > 0 && (
                    <div className="text-[11px] text-slate-500">
                      <strong>Answers:</strong> {sec.questionsAnswered.join(" • ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: SAVED SUCCESS */}
      {currentStep === 5 && (
        <div className="apex-card p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center mx-auto">
            <FileCheck className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold">Topic Cluster &amp; Outline Approved!</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            The ContentBrief, KeywordCluster, and Article Draft have been persisted in the database.
            You can now view this draft in the Content Planner or proceed to article generation.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setAnalysis(null);
                setCluster(null);
                setOutline(null);
                setValidation(null);
                setSavedSuccess(false);
                setCurrentStep(1);
              }}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Plan Another Topic
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
