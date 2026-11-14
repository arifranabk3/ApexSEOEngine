"use client";

import React, { useState } from "react";
import {
  ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Save,
  Eye,
  ShieldCheck
} from "lucide-react";
import type { SvgTemplateType } from "@/services/media/svg-templates.types";

interface ArticleImageGeneratorProps {
  articles: Array<{ id: string; title: string; slug: string; focusKeyword?: string | null }>;
  onImageAttached?: () => void;
}

export function ArticleImageGenerator({
  articles,
  onImageAttached
}: ArticleImageGeneratorProps) {
  const [selectedArticleId, setSelectedArticleId] = useState<string>(
    articles[0]?.id || ""
  );
  const [imageTitle, setImageTitle] = useState<string>(
    articles[0]?.title || "Self-Hosted Ollama AI Blog Engine"
  );
  const [categoryName, setCategoryName] = useState<string>("TECHNICAL ARCHITECTURE");
  const [focusKeyword, setFocusKeyword] = useState<string>(
    articles[0]?.focusKeyword || "self-hosted ollama"
  );
  const [templateType, setTemplateType] = useState<SvgTemplateType>("FEATURED_HERO");
  const [customAltText, setCustomAltText] = useState<string>("");
  const [customCaption, setCustomCaption] = useState<string>("");

  const [previewSvg, setPreviewSvg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync title and keyword when selected article changes
  const handleArticleSelect = (artId: string) => {
    setSelectedArticleId(artId);
    const found = articles.find((a) => a.id === artId);
    if (found) {
      setImageTitle(found.title);
      if (found.focusKeyword) {
        setFocusKeyword(found.focusKeyword);
      }
    }
  };

  const handlePreview = async () => {
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage("Rendering deterministic vector blueprint...");
    try {
      const res = await fetch("/api/v1/content/generate-svg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview_image",
          title: imageTitle,
          categoryName,
          focusKeyword,
          templateType
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to generate SVG preview");
      }

      setPreviewSvg(json.data.asset.svgContent);
      if (!customAltText) {
        setCustomAltText(json.data.asset.altText);
      }
      if (!customCaption) {
        setCustomCaption(json.data.asset.caption);
      }
      setStatusMessage("SVG rendered and validated! Zero XSS risk.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error generating preview");
    } finally {
      setLoading(false);
    }
  };

  const handleAttach = async () => {
    if (!selectedArticleId) {
      setErrorMessage("Please select a target article");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setStatusMessage("Attaching SVG to article and saving ArticleImage record...");
    try {
      const res = await fetch("/api/v1/content/generate-svg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "attach_to_article",
          articleId: selectedArticleId,
          title: imageTitle,
          categoryName,
          focusKeyword,
          templateType,
          isFeatured: true,
          customAltText: customAltText || undefined,
          customCaption: customCaption || undefined
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to attach SVG image");
      }

      setStatusMessage("Featured SVG image attached to article successfully!");
      if (onImageAttached) {
        onImageAttached();
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error attaching image");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="apex-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-blue-500" />
              <span>Zero-Cost Deterministic SVG Featured Image Generator</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Generates publication-ready, secure vector artwork, architectural schematics, and Core Web Vitals telemetry charts.
            </p>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Strict SVG Sanitizer Active</span>
          </span>
        </div>

        {/* Status Alerts */}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
              Target Article
            </label>
            <select
              value={selectedArticleId}
              onChange={(e) => handleArticleSelect(e.target.value)}
              className="apex-input"
            >
              {articles.map((art) => (
                <option key={art.id} value={art.id}>
                  {art.title} (/{art.slug})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
              SVG Template Blueprint
            </label>
            <select
              value={templateType}
              onChange={(e) => setTemplateType(e.target.value as SvgTemplateType)}
              className="apex-input"
            >
              <option value="FEATURED_HERO">Featured Hero Banner (1200x630)</option>
              <option value="TECHNICAL_ARCHITECTURE">Technical Architecture Schematic (1200x630)</option>
              <option value="CORE_WEB_VITALS">Core Web Vitals Telemetry Chart (1200x630)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
              Banner Headline Title
            </label>
            <input
              value={imageTitle}
              onChange={(e) => setImageTitle(e.target.value)}
              placeholder="Article title for banner"
              className="apex-input"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
              Category Tag / Kicker
            </label>
            <input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="e.g. TECHNICAL ARCHITECTURE"
              className="apex-input font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
              SEO Focus Keyword
            </label>
            <input
              value={focusKeyword}
              onChange={(e) => setFocusKeyword(e.target.value)}
              placeholder="e.g. self-hosted ollama"
              className="apex-input font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
              Descriptive Alt Text (No Keyword Stuffing)
            </label>
            <input
              value={customAltText}
              onChange={(e) => setCustomAltText(e.target.value)}
              placeholder="Describes image content accurately for a11y & SEO"
              className="apex-input"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={handlePreview}
            className="px-4 py-2 rounded-xl border border-blue-500 text-blue-500 hover:bg-blue-500/10 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Eye className="w-4 h-4" />
            <span>Render Preview</span>
          </button>
          <button
            type="button"
            disabled={loading || !selectedArticleId}
            onClick={handleAttach}
            className="apex-btn-primary flex items-center gap-1.5 text-xs"
          >
            <Save className="w-4 h-4" />
            <span>Attach as Featured Image</span>
          </button>
        </div>
      </div>

      {/* Live Preview Display */}
      {previewSvg && (
        <div className="apex-card p-6 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>SVG Blueprint Preview (1200 x 630 Vector)</span>
            <span className="font-mono text-slate-400">Template: {templateType}</span>
          </div>

          <div
            className="w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 shadow-md bg-slate-950 flex items-center justify-center p-2"
            dangerouslySetInnerHTML={{ __html: previewSvg }}
          />

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 space-y-1">
            <div>
              <strong>Alt Text:</strong> {customAltText || "Generated alt text"}
            </div>
            <div>
              <strong>Caption:</strong> {customCaption || "Generated caption"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
