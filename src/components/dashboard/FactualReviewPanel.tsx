"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Filter,
  Check,
  Edit2,
  Trash2
} from "lucide-react";
import type {
  FactualReviewReport,
  ReviewerDecision
} from "@/services/seo/factual-claim-schemas";

interface ArticleItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  seoScore: number;
}

interface FactualReviewPanelProps {
  websiteId: string;
}

export function FactualReviewPanel({ websiteId }: FactualReviewPanelProps) {
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState<string>("");
  const [report, setReport] = useState<FactualReviewReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [savingClaimId, setSavingClaimId] = useState<string | null>(null);
  const [filterRisk, setFilterRisk] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterDecision, setFilterDecision] = useState<string>("ALL");
  const [reviewerNotesInput, setReviewerNotesInput] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load articles for website
  const loadArticles = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/content?websiteId=${encodeURIComponent(websiteId)}`);
      if (res.ok) {
        const body = await res.json();
        const arts = body.data?.articles || [];
        setArticles(arts);
        if (arts.length > 0 && !selectedArticleId) {
          setSelectedArticleId(arts[0].id);
        }
      }
    } catch {
      // silent
    }
  }, [websiteId, selectedArticleId]);

  useEffect(() => {
    if (websiteId) {
      loadArticles();
    }
  }, [websiteId, loadArticles]);

  // Run audit on selected article
  const runAudit = useCallback(async (articleId: string) => {
    if (!articleId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/v1/content/factual-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "audit_article",
          articleId
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error?.message || "Failed to audit factual claims.");
      } else {
        setReport(data.data.report);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Network error auditing claims.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedArticleId) {
      runAudit(selectedArticleId);
    }
  }, [selectedArticleId, runAudit]);

  // Handle reviewer decision
  const handleDecision = async (
    claimId: string,
    decision: ReviewerDecision,
    notes?: string
  ) => {
    if (!selectedArticleId) return;
    setSavingClaimId(claimId);
    try {
      const res = await fetch("/api/v1/content/factual-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_reviewer_decision",
          articleId: selectedArticleId,
          claimId,
          decision,
          reviewerNotes: notes || reviewerNotesInput[claimId] || ""
        })
      });
      const result = await res.json();
      if (res.ok && result.success) {
        // Re-run audit to fetch updated merged state
        await runAudit(selectedArticleId);
      }
    } catch {
      // silent
    } finally {
      setSavingClaimId(null);
    }
  };

  // Filtered claims
  const filteredClaims = (report?.claims || []).filter((claim) => {
    if (filterRisk !== "ALL" && claim.riskLevel !== filterRisk) return false;
    if (filterStatus !== "ALL" && claim.verificationStatus !== filterStatus) return false;
    if (filterDecision !== "ALL" && claim.reviewerDecision !== filterDecision) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="apex-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Factual Claim &amp; Editorial Review Engine
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Deterministic claim extraction, risk classification, SSRF protection, and human-in-the-loop review.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedArticleId}
              onChange={(e) => setSelectedArticleId(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200"
            >
              {articles.map((art) => (
                <option key={art.id} value={art.id}>
                  {art.title.length > 50 ? art.title.slice(0, 50) + "..." : art.title} ({art.status})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => runAudit(selectedArticleId)}
              disabled={loading || !selectedArticleId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? "Auditing..." : "Re-Audit"}</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Summary Metric Cards */}
        {report && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-500">Total Claims</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                {report.summary.totalClaims}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-500">Critical Risk</div>
              <div className="text-lg font-bold text-rose-500 mt-0.5">
                {report.summary.criticalRiskCount}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-500">High Risk</div>
              <div className="text-lg font-bold text-amber-500 mt-0.5">
                {report.summary.highRiskCount}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-500">Unverified</div>
              <div className="text-lg font-bold text-indigo-500 mt-0.5">
                {report.summary.unverifiedCount}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-500">Pending Review</div>
              <div className="text-lg font-bold text-orange-500 mt-0.5">
                {report.summary.pendingHumanReviewCount}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-500">Publishing Ready</div>
              <div className="text-xs font-bold mt-1.5 flex items-center gap-1">
                {report.summary.readyForPublishing ? (
                  <span className="text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> YES
                  </span>
                ) : (
                  <span className="text-rose-500 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> BLOCKED
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      {report && (
        <div className="apex-card p-4 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Risk:</span>
            <select
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value)}
              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            >
              <option value="ALL">All Risks</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="UNVERIFIED">Unverified</option>
              <option value="VERIFIED">Verified</option>
              <option value="UNVERIFIABLE">Unverifiable</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Decision:</span>
            <select
              value={filterDecision}
              onChange={(e) => setFilterDecision(e.target.value)}
              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            >
              <option value="ALL">All Decisions</option>
              <option value="PENDING">Pending</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="CORRECTED">Corrected</option>
              <option value="REMOVED">Removed</option>
            </select>
          </div>

          <div className="ml-auto text-slate-400 text-[11px]">
            Showing {filteredClaims.length} of {report.claims.length} claims
          </div>
        </div>
      )}

      {/* Claims List */}
      {report && (
        <div className="space-y-4">
          {filteredClaims.length === 0 ? (
            <div className="apex-card p-8 text-center text-xs text-slate-400">
              No claims match the active filter criteria.
            </div>
          ) : (
            filteredClaims.map((claim) => (
              <div
                key={claim.id}
                className="apex-card p-5 space-y-3 border-l-4"
                style={{
                  borderLeftColor:
                    claim.riskLevel === "CRITICAL"
                      ? "#f43f5e"
                      : claim.riskLevel === "HIGH"
                      ? "#f59e0b"
                      : claim.riskLevel === "MEDIUM"
                      ? "#3b82f6"
                      : "#10b981"
                }}
              >
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-slate-500">
                      [{claim.id}]
                    </span>
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      Section: {claim.sectionLocation}
                    </span>
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {claim.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        claim.riskLevel === "CRITICAL"
                          ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                          : claim.riskLevel === "HIGH"
                          ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                          : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                      }`}
                    >
                      RISK: {claim.riskLevel}
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        claim.verificationStatus === "VERIFIED"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-indigo-500/10 text-indigo-500"
                      }`}
                    >
                      {claim.verificationStatus}
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        claim.reviewerDecision === "ACCEPTED"
                          ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                          : claim.reviewerDecision === "CORRECTED"
                          ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                          : claim.reviewerDecision === "REMOVED"
                          ? "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                          : "bg-orange-500/20 text-orange-600 dark:text-orange-400"
                      }`}
                    >
                      DECISION: {claim.reviewerDecision}
                    </span>
                  </div>
                </div>

                {/* Claim Statement */}
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-slate-100">
                  &ldquo;{claim.claimText}&rdquo;
                </div>

                {/* Recommendation & Evidence */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-800/60">
                    <div className="font-semibold text-slate-500 dark:text-slate-400 text-[11px] mb-1">
                      Editorial Action
                    </div>
                    <p className="text-slate-700 dark:text-slate-300">
                      {claim.recommendedAction}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-800/60">
                    <div className="font-semibold text-slate-500 dark:text-slate-400 text-[11px] mb-1">
                      Evaluation &amp; Evidence
                    </div>
                    <p className="text-slate-700 dark:text-slate-300">
                      {claim.explanation}
                    </p>
                  </div>
                </div>

                {/* Sources & SSRF Status */}
                {claim.evaluatedSources.length > 0 && (
                  <div className="text-xs space-y-1">
                    <div className="font-semibold text-[11px] text-slate-500">
                      Supplied Source Audits:
                    </div>
                    {claim.evaluatedSources.map((src, i) => (
                      <div
                        key={i}
                        className="p-2 rounded bg-slate-100 dark:bg-slate-900 text-[11px] flex flex-wrap items-center justify-between gap-2"
                      >
                        <span className="font-mono text-slate-600 dark:text-slate-400">
                          {src.url}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            src.authorityAssessment === "REJECTED_UNSAFE"
                              ? "bg-rose-500/20 text-rose-500"
                              : "bg-blue-500/10 text-blue-500"
                          }`}
                        >
                          {src.authorityAssessment}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Human Review Decision Bar */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 flex-1 max-w-md">
                    <input
                      type="text"
                      placeholder="Add reviewer notes / verification basis..."
                      value={reviewerNotesInput[claim.id] || claim.reviewerNotes || ""}
                      onChange={(e) =>
                        setReviewerNotesInput({
                          ...reviewerNotesInput,
                          [claim.id]: e.target.value
                        })
                      }
                      className="w-full px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={savingClaimId === claim.id}
                      onClick={() => handleDecision(claim.id, "ACCEPTED")}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition ${
                        claim.reviewerDecision === "ACCEPTED"
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                      }`}
                    >
                      <Check className="w-3 h-3" />
                      <span>Accept</span>
                    </button>

                    <button
                      type="button"
                      disabled={savingClaimId === claim.id}
                      onClick={() => handleDecision(claim.id, "CORRECTED")}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition ${
                        claim.reviewerDecision === "CORRECTED"
                          ? "bg-blue-600 text-white"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                      }`}
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Correct</span>
                    </button>

                    <button
                      type="button"
                      disabled={savingClaimId === claim.id}
                      onClick={() => handleDecision(claim.id, "REMOVED")}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition ${
                        claim.reviewerDecision === "REMOVED"
                          ? "bg-rose-600 text-white"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                      }`}
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove</span>
                    </button>
                  </div>

                  {claim.reviewedBy && (
                    <div className="w-full text-right text-[10px] text-slate-400 font-mono">
                      Last reviewed by {claim.reviewedBy} at{" "}
                      {claim.reviewedAt ? new Date(claim.reviewedAt).toLocaleString() : ""}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Mandatory Disclaimer footer */}
      {report && (
        <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs">
          <strong>Mandatory Notice:</strong> {report.summary.mandatoryDisclaimer}
        </div>
      )}
    </div>
  );
}
