"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  Lock,
  Activity,
  FileCheck2,
  Sparkles,
  Scale
} from "lucide-react";

type Verdict = "PASS" | "WARNING" | "FAIL" | "NOT_VERIFIED";

interface AuditRow {
  id: string;
  layer: string;
  requirement: string;
  currentStatus: string;
  evidence: string;
  severity: string;
  recommendedFix: string | null;
  validationResult: Verdict;
}

interface PolicyEntry {
  id: string;
  policyName: string;
  officialUrl: string;
  lastCheckedDate: string;
  versionOrRevisionTag: string;
  changeSummary: string;
  affectedModules: string[];
  requiredCodeOrContentChanges: string;
}

interface ApprovalRow {
  articleId: string;
  title: string;
  slug: string;
  currentState: "DRAFT" | "NEEDS_REVIEW" | "APPROVED" | "PUBLISHED";
  updatedAt: string;
}

interface ComplianceDashboardPayload {
  websiteIsolationContext: {
    websiteId: string;
    websiteName: string;
    websiteUrl: string;
  };
  sections: {
    googleSearchCompliance: AuditRow[];
    adSenseCompliance: {
      overallVerdict: Verdict;
      adSenseReady: boolean;
      items: AuditRow[];
    };
    technicalSeo: AuditRow[];
    contentQuality: AuditRow[];
    websiteReadiness: {
      searchComplianceVerdict: Verdict;
      adSenseComplianceVerdict: Verdict;
      readyForAdSenseApplication: boolean;
      readyForOrganicSearchIndexation: boolean;
      auditMatrix: AuditRow[];
    };
    trafficQuality: {
      overallVerdict: Verdict;
      botTrafficRatioPct: number;
      suspiciousReferrers: string[];
      invalidClickSpikeDetected: boolean;
      auditItems: AuditRow[];
    };
    policyUpdates: PolicyEntry[];
    publishingApprovals: ApprovalRow[];
  };
}

const TABS = [
  { id: "search", label: "1. Google Search Compliance" },
  { id: "adsense", label: "2. AdSense Compliance" },
  { id: "technical", label: "3. Technical SEO" },
  { id: "quality", label: "4. Content Quality" },
  { id: "readiness", label: "5. Website Readiness" },
  { id: "traffic", label: "6. Traffic Quality" },
  { id: "policies", label: "7. Policy Updates" },
  { id: "approvals", label: "8. Publishing Approvals" }
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function ComplianceCenterPanel({ websiteId }: { websiteId: string }) {
  const [activeTab, setActiveTab] = useState<TabId>("search");
  const [data, setData] = useState<ComplianceDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [gateMessage, setGateMessage] = useState<string | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const loadCompliance = useCallback(async () => {
    setLoading(true);
    try {
      const url = websiteId
        ? `/api/v1/compliance?websiteId=${encodeURIComponent(websiteId)}`
        : "/api/v1/compliance";
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, [websiteId]);

  useEffect(() => {
    loadCompliance();
  }, [loadCompliance]);

  function handleSelectTab(tabId: TabId) {
    setActiveTab(tabId);
    const el = tabRefs.current[tabId];
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }
  }

  function handleTabKeyDown(e: React.KeyboardEvent, index: number) {
    let nextIndex = index;
    if (e.key === "ArrowRight") {
      nextIndex = (index + 1) % TABS.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (index - 1 + TABS.length) % TABS.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = TABS.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    const targetTab = TABS[nextIndex];
    handleSelectTab(targetTab.id);
    tabRefs.current[targetTab.id]?.focus();
  }

  async function handleTransition(
    articleId: string,
    requestedState: "DRAFT" | "NEEDS_REVIEW" | "APPROVED" | "PUBLISHED"
  ) {
    if (!data) return;
    setGateMessage(
      "Running mandatory Search + AdSense + Technical SEO + Factual + Copyright gates..."
    );
    const res = await fetch("/api/v1/compliance", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        articleId,
        websiteId: data.websiteIsolationContext.websiteId,
        requestedState,
        requireHumanApproval: true,
        humanApproved: true
      })
    });
    const json = await res.json();
    if (json.success) {
      setGateMessage(
        json.data.transitionAllowed
          ? `Transitioned to ${json.data.resultingState} (All mandatory checks passed).`
          : `Blocked -> Routed to ${json.data.resultingState}: ${json.data.blockReasons.join(" | ")}`
      );
      loadCompliance();
    }
  }

  function renderVerdictBadge(verdict: Verdict) {
    if (verdict === "PASS") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          PASS
        </span>
      );
    }
    if (verdict === "WARNING") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          WARNING
        </span>
      );
    }
    if (verdict === "FAIL") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          FAIL
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30">
        <HelpCircle className="w-3.5 h-3.5 shrink-0" />
        NOT VERIFIED
      </span>
    );
  }

  function renderSeverityPill(severity: string) {
    const normalized = severity.toUpperCase();
    const colorClass =
      normalized === "CRITICAL"
        ? "bg-rose-500/10 text-rose-500 border-rose-500/25"
        : normalized === "HIGH"
          ? "bg-amber-500/10 text-amber-500 border-amber-500/25"
          : "bg-blue-500/10 text-blue-500 border-blue-500/25";
    return (
      <span
        className={`inline-block font-mono text-[10px] font-semibold px-2 py-0.5 rounded border ${colorClass}`}
      >
        {severity}
      </span>
    );
  }

  function renderAuditTable(rows: AuditRow[], captionId: string, captionText: string) {
    return (
      <div
        tabIndex={0}
        role="region"
        aria-labelledby={captionId}
        className="table-wrapper bg-white/60 dark:bg-slate-950/60"
      >
        <table className="apex-data-table">
          <caption
            id={captionId}
            className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50"
          >
            {captionText} ({rows.length} verification checkpoints)
          </caption>
          <thead>
            <tr>
              <th scope="col">Requirement &amp; Layer</th>
              <th scope="col">Status &amp; Evidence</th>
              <th scope="col">Severity</th>
              <th scope="col">Recommended Remediation</th>
              <th scope="col" className="text-right">
                Verdict
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="hover:bg-slate-100/60 dark:hover:bg-slate-900/60 transition-colors"
              >
                <td className="font-semibold text-slate-900 dark:text-slate-100 min-w-[200px]">
                  <div>{r.requirement}</div>
                  <div className="text-[10px] font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                    {r.layer}
                  </div>
                </td>
                <td className="min-w-[260px]">
                  <div className="text-slate-700 dark:text-slate-200 font-medium">
                    {r.currentStatus}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1 bg-slate-100 dark:bg-slate-900/90 px-2 py-1 rounded border border-slate-200/70 dark:border-slate-800">
                    Evidence: {r.evidence}
                  </div>
                </td>
                <td>{renderSeverityPill(r.severity)}</td>
                <td className="text-slate-600 dark:text-slate-300 min-w-[220px]">
                  {r.recommendedFix || (
                    <span className="text-emerald-500 font-medium">
                      Compliant — no remediation required
                    </span>
                  )}
                </td>
                <td className="text-right whitespace-nowrap">
                  {renderVerdictBadge(r.validationResult)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Compute summary tallies across all audit sections
  const allAuditRows: AuditRow[] = data
    ? [
        ...data.sections.googleSearchCompliance,
        ...data.sections.adSenseCompliance.items,
        ...data.sections.technicalSeo,
        ...data.sections.contentQuality,
        ...data.sections.trafficQuality.auditItems
      ]
    : [];

  const passCount = allAuditRows.filter((r) => r.validationResult === "PASS").length;
  const warnCount = allAuditRows.filter((r) => r.validationResult === "WARNING").length;
  const failCount = allAuditRows.filter((r) => r.validationResult === "FAIL").length;
  const unverifiedCount = allAuditRows.filter(
    (r) => r.validationResult === "NOT_VERIFIED"
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Executive Compliance Header */}
      <div className="apex-card p-6 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/80 text-white border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Dual-Layer Search Essentials + AdSense Policy Gate</span>
            </div>
            <h2 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
              Independent Google Search &amp; AdSense Compliance Center
            </h2>
            <p className="text-xs text-slate-300">
              Isolated Website Context:{" "}
              <span className="font-semibold text-white underline decoration-blue-500/60 underline-offset-4">
                {data?.websiteIsolationContext.websiteName || "Loading..."}
              </span>{" "}
              <span className="font-mono text-slate-400">
                ({data?.websiteIsolationContext.websiteUrl})
              </span>{" "}
              &bull; Zero fabricated compliance scores
            </p>
          </div>

          <button
            type="button"
            onClick={loadCompliance}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white flex items-center gap-2 transition shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Re-Run Website Audits</span>
          </button>
        </div>

        {/* Executive Summary Scorecard Strip */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-5 pt-5 border-t border-slate-800/90">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/90">
              <div className="text-[11px] text-slate-400">Checks Passed</div>
              <div className="text-xl font-extrabold text-emerald-400 mt-0.5">
                {passCount}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/90">
              <div className="text-[11px] text-slate-400">Warnings</div>
              <div className="text-xl font-extrabold text-amber-400 mt-0.5">
                {warnCount}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/90">
              <div className="text-[11px] text-slate-400">Critical Blocks</div>
              <div className="text-xl font-extrabold text-rose-400 mt-0.5">
                {failCount}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/90">
              <div className="text-[11px] text-slate-400">Unverified (Honest)</div>
              <div className="text-xl font-extrabold text-slate-300 mt-0.5">
                {unverifiedCount}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/90 flex flex-col justify-between">
              <div className="text-[11px] text-slate-400">Search Index Gate</div>
              <div className="mt-1">
                {renderVerdictBadge(
                  data.sections.websiteReadiness.searchComplianceVerdict
                )}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/90 flex flex-col justify-between">
              <div className="text-[11px] text-slate-400">AdSense Ready Gate</div>
              <div className="mt-1">
                {renderVerdictBadge(
                  data.sections.websiteReadiness.adSenseComplianceVerdict
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Single-Row Accessible Tablist (modern-web-guidance: tabs) */}
      <div className="apex-card px-3 pt-1">
        <div
          role="tablist"
          aria-label="Compliance Audit Modules"
          className="apex-tablist"
        >
          {TABS.map((t, idx) => {
            const isSelected = activeTab === t.id;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[t.id] = el;
                }}
                id={`compliance-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => handleSelectTab(t.id)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className={`apex-tab ${
                  isSelected
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {gateMessage && (
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-300 text-xs flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 font-medium">
            <Sparkles className="w-4 h-4 shrink-0" />
            {gateMessage}
          </span>
          <button
            type="button"
            onClick={() => setGateMessage(null)}
            className="text-xs underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {data && (
        <div
          role="tabpanel"
          aria-labelledby={`compliance-tab-${activeTab}`}
          className="apex-card p-6"
        >
          {activeTab === "search" &&
            renderAuditTable(
              data.sections.googleSearchCompliance,
              "caption-google-search-compliance",
              "Google Search Essentials, Spam Policies & E-E-A-T Audit Matrix"
            )}

          {activeTab === "adsense" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Scale className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Independent AdSense Program Policies &amp; Publisher Verdict (Decoupled from Search Rank):
                  </span>
                </div>
                {renderVerdictBadge(data.sections.adSenseCompliance.overallVerdict)}
              </div>
              {renderAuditTable(
                data.sections.adSenseCompliance.items,
                "caption-adsense-compliance",
                "Google AdSense Publisher Policies, Trust Pages, ads.txt & Ad Placement Audit"
              )}
            </div>
          )}

          {activeTab === "technical" &&
            renderAuditTable(
              data.sections.technicalSeo,
              "caption-technical-seo",
              "Technical SEO, Crawlability, Canonicalization, Core Web Vitals & Schema Parity"
            )}

          {activeTab === "quality" &&
            renderAuditTable(
              data.sections.contentQuality,
              "caption-content-quality",
              "People-First Content Quality, Originality, Source Attribution & Anti-Scaled-Abuse Checks"
            )}

          {activeTab === "readiness" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold">
                      Google Search Indexation Readiness
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Requires zero FAIL verdicts in Technical &amp; On-Page SEO
                    </div>
                  </div>
                  {renderVerdictBadge(
                    data.sections.websiteReadiness.searchComplianceVerdict
                  )}
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold">
                      Google AdSense Pre-Application Readiness
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Verifies mandatory pages, minimum depth, and zero policy violations
                    </div>
                  </div>
                  {renderVerdictBadge(
                    data.sections.websiteReadiness.adSenseComplianceVerdict
                  )}
                </div>
              </div>
              {renderAuditTable(
                data.sections.websiteReadiness.auditMatrix,
                "caption-website-readiness",
                "Pre-Application Website Readiness & Mandatory Trust Page Checklist"
              )}
            </div>
          )}

          {activeTab === "traffic" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold">
                    Invalid Traffic (IVT), Bot Ratio ({data.sections.trafficQuality.botTrafficRatioPct}%) &amp; Paid Traffic Protection:
                  </span>
                </div>
                {renderVerdictBadge(data.sections.trafficQuality.overallVerdict)}
              </div>
              {renderAuditTable(
                data.sections.trafficQuality.auditItems,
                "caption-traffic-quality",
                "Invalid Traffic (IVT) Prevention & AdSense Click-Safety Guardrails"
              )}
            </div>
          )}

          {activeTab === "policies" && (
            <div className="space-y-3">
              {data.sections.policyUpdates.map((pol) => (
                <div
                  key={pol.id}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 text-xs space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {pol.policyName}
                      </span>
                      <a
                        href={pol.officialUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-blue-500 hover:underline"
                      >
                        <span>Official Spec</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      Verified: {pol.lastCheckedDate} &bull; {pol.versionOrRevisionTag}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">{pol.changeSummary}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800/80 text-[11px]">
                    <span className="text-blue-600 dark:text-blue-400 font-mono">
                      Enforcement: {pol.requiredCodeOrContentChanges}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {pol.affectedModules.map((mod) => (
                        <span
                          key={mod}
                          className="px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-mono text-[10px]"
                        >
                          {mod}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "approvals" && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-500 shrink-0" />
                <span>
                  4-State Publishing Workflow: Any transition to{" "}
                  <strong className="text-slate-800 dark:text-slate-200">APPROVED</strong> or{" "}
                  <strong className="text-slate-800 dark:text-slate-200">PUBLISHED</strong>{" "}
                  executes the mandatory 5-Gate Validator (Search Essentials, AdSense Policy, Technical SEO, Factual Claims, Copyright).
                </span>
              </div>
              {data.sections.publishingApprovals.map((art) => (
                <div
                  key={art.articleId}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shrink-0 mt-0.5">
                      <FileCheck2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">
                        {art.title}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px] mt-0.5">
                        /{art.slug} &bull; Current State:{" "}
                        <span className="text-blue-500 font-semibold">
                          {art.currentState}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(["DRAFT", "NEEDS_REVIEW", "APPROVED", "PUBLISHED"] as const).map(
                      (st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleTransition(art.articleId, st)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                            art.currentState === st
                              ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30"
                              : "bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                          }`}
                        >
                          {st}
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
