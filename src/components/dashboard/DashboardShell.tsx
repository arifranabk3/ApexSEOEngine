"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Globe,
  Search,
  Layers,
  Calendar,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Link2,
  Send,
  BarChart3,
  LineChart,
  Workflow,
  Cpu,
  Settings,
  LogOut,
  Sun,
  Moon,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Play,
  Trash2,
  Database,
  History,
  ArrowUpRight,
  Lock,
  Activity,
  ChevronRight,
  Clock,
  Server
} from "lucide-react";
import type { DashboardSummaryMetrics } from "@/types/domain";
import ComplianceCenterPanel from "./ComplianceCenterPanel";

export type NavSectionId =
  | "overview"
  | "websites"
  | "keyword-research"
  | "keyword-clusters"
  | "content-planner"
  | "ai-article-writer"
  | "image-generator"
  | "seo-optimizer"
  | "internal-linking"
  | "publishing"
  | "google-analytics"
  | "search-console"
  | "automations"
  | "ai-providers"
  | "settings";

interface NavItem {
  id: NavSectionId;
  label: string;
  group:
    | "CORE CONTROL"
    | "SEO & CONTENT ENGINE"
    | "COMPLIANCE & PUBLISHING"
    | "ANALYTICS & INFRASTRUCTURE";
  phase: "PHASE_01" | "PHASE_02_READY";
  icon: React.ComponentType<{ className?: string }>;
}

export const NAVIGATION_ITEMS: NavItem[] = [
  {
    id: "overview",
    label: "1. Overview",
    group: "CORE CONTROL",
    phase: "PHASE_01",
    icon: LayoutDashboard
  },
  {
    id: "websites",
    label: "2. Websites",
    group: "CORE CONTROL",
    phase: "PHASE_01",
    icon: Globe
  },
  {
    id: "keyword-research",
    label: "3. Keyword Research",
    group: "SEO & CONTENT ENGINE",
    phase: "PHASE_02_READY",
    icon: Search
  },
  {
    id: "keyword-clusters",
    label: "4. Keyword Clusters",
    group: "SEO & CONTENT ENGINE",
    phase: "PHASE_02_READY",
    icon: Layers
  },
  {
    id: "content-planner",
    label: "5. Content Planner",
    group: "SEO & CONTENT ENGINE",
    phase: "PHASE_01",
    icon: Calendar
  },
  {
    id: "ai-article-writer",
    label: "6. AI Article Writer",
    group: "SEO & CONTENT ENGINE",
    phase: "PHASE_01",
    icon: FileText
  },
  {
    id: "image-generator",
    label: "7. Image Generator",
    group: "SEO & CONTENT ENGINE",
    phase: "PHASE_02_READY",
    icon: ImageIcon
  },
  {
    id: "seo-optimizer",
    label: "8. SEO & AdSense Gate",
    group: "COMPLIANCE & PUBLISHING",
    phase: "PHASE_01",
    icon: Sparkles
  },
  {
    id: "internal-linking",
    label: "9. Internal Linking",
    group: "COMPLIANCE & PUBLISHING",
    phase: "PHASE_02_READY",
    icon: Link2
  },
  {
    id: "publishing",
    label: "10. Publishing",
    group: "COMPLIANCE & PUBLISHING",
    phase: "PHASE_01",
    icon: Send
  },
  {
    id: "google-analytics",
    label: "11. Google Analytics",
    group: "ANALYTICS & INFRASTRUCTURE",
    phase: "PHASE_02_READY",
    icon: BarChart3
  },
  {
    id: "search-console",
    label: "12. Search Console",
    group: "ANALYTICS & INFRASTRUCTURE",
    phase: "PHASE_01",
    icon: LineChart
  },
  {
    id: "automations",
    label: "13. Automations",
    group: "ANALYTICS & INFRASTRUCTURE",
    phase: "PHASE_01",
    icon: Workflow
  },
  {
    id: "ai-providers",
    label: "14. AI Providers",
    group: "ANALYTICS & INFRASTRUCTURE",
    phase: "PHASE_01",
    icon: Cpu
  },
  {
    id: "settings",
    label: "15. Settings",
    group: "ANALYTICS & INFRASTRUCTURE",
    phase: "PHASE_01",
    icon: Settings
  }
];

const NAV_GROUPS: NavItem["group"][] = [
  "CORE CONTROL",
  "SEO & CONTENT ENGINE",
  "COMPLIANCE & PUBLISHING",
  "ANALYTICS & INFRASTRUCTURE"
];

interface WebsiteRecord {
  id: string;
  name: string;
  url: string;
  cmsType: string;
  status: string;
  credentialsConfigured: boolean;
  counts?: {
    articles: number;
    keywords: number;
    categories: number;
    integrations: number;
  };
}

interface AIProviderRecord {
  id: string;
  name: string;
  providerType: string;
  baseUrl: string;
  hasApiKey: boolean;
  isLocal: boolean;
  isEnabled: boolean;
  status: string;
  totalRequests: number;
  totalTokens: number;
  models: Array<{
    id: string;
    name: string;
    modelId: string;
    contextWindow: number;
    isDefault: boolean;
  }>;
}

interface WorkflowRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  workflowType: string;
  webhookUrl: string | null;
  scheduleCron: string | null;
  status: string;
  maxRetries: number;
  retryBackoffMs: number;
  lastRunAt: string | null;
  executions: Array<{
    id: string;
    status: string;
    triggerSource: string;
    startedAt: string;
    durationMs: number | null;
  }>;
}

interface ArticleRecord {
  id: string;
  websiteId: string;
  title: string;
  slug: string;
  status: string;
  focusKeyword: string | null;
  seoScore: number;
  wordCount: number;
  updatedAt: string;
  website?: { id: string; name: string; url: string };
  category?: { id: string; name: string; slug: string } | null;
  versions: Array<{
    id: string;
    versionNumber: number;
    changeSummary: string | null;
    createdBy: string | null;
    createdAt: string;
  }>;
}

interface IntegrationRecord {
  id: string;
  websiteId: string;
  integrationType: string;
  name: string;
  endpointUrl: string | null;
  hasEncryptedCredentials: boolean;
  status: string;
  website?: { id: string; name: string; url: string };
}

interface SystemSettingRecord {
  id: string;
  category: string;
  key: string;
  value: unknown;
  isSecret: boolean;
  description: string | null;
}

interface DurableJobRecord {
  id: string;
  websiteId: string | null;
  jobType: string;
  idempotencyKey: string;
  status: string;
  priority: number;
  attempts: number;
  maxAttempts: number;
  errorLog: string | null;
  createdAt: string;
  completedAt: string | null;
}

export default function DashboardShell({
  initialUser
}: {
  initialUser: { id: string; email: string; name: string; roleName: string };
}) {
  const router = useRouter();
  const [activeNav, setActiveNav] = useState<NavSectionId>("overview");
  const [darkMode, setDarkMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const [summary, setSummary] = useState<DashboardSummaryMetrics | null>(null);
  const [websites, setWebsites] = useState<WebsiteRecord[]>([]);
  const [providers, setProviders] = useState<AIProviderRecord[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
  const [articles, setArticles] = useState<ArticleRecord[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationRecord[]>([]);
  const [settings, setSettings] = useState<SystemSettingRecord[]>([]);
  const [durableJobs, setDurableJobs] = useState<DurableJobRecord[]>([]);
  const [jobCounts, setJobCounts] = useState<{
    queued: number;
    running: number;
    completed: number;
    retryScheduled: number;
    deadLetter: number;
  }>({ queued: 0, running: 0, completed: 0, retryScheduled: 0, deadLetter: 0 });
  const [newJobType, setNewJobType] = useState("SEO_AUDITING");

  // Form states
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteUrl, setNewSiteUrl] = useState("");
  const [newSiteCms, setNewSiteCms] = useState("WORDPRESS");
  const [newSiteUser, setNewSiteUser] = useState("");
  const [newSiteSecret, setNewSiteSecret] = useState("");

  const [newProviderName, setNewProviderName] = useState("");
  const [newProviderType, setNewProviderType] = useState("OLLAMA");
  const [newProviderUrl, setNewProviderUrl] = useState("http://localhost:11434");
  const [newProviderModel, setNewProviderModel] = useState("llama3.2:latest");

  const [newArticleTitle, setNewArticleTitle] = useState("");
  const [newArticleSlug, setNewArticleSlug] = useState("");
  const [newArticleKeyword, setNewArticleKeyword] = useState("");
  const [newArticleContent, setNewArticleContent] = useState("");
  const [selectedWebsiteId, setSelectedWebsiteId] = useState("");

  const [newWfName, setNewWfName] = useState("");
  const [newWfSlug, setNewWfSlug] = useState("");
  const [newWfCron, setNewWfCron] = useState("0 */6 * * *");
  const [newWfWebhook, setNewWfWebhook] = useState("http://localhost:5678/webhook/custom");

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", next);
      document.documentElement.style.colorScheme = next ? "dark" : "light";
    }
  };

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, webRes, aiRes, wfRes, artRes, intRes, setRes, jobsRes] = await Promise.all([
        fetch("/api/v1/dashboard"),
        fetch("/api/v1/websites"),
        fetch("/api/v1/ai-providers"),
        fetch("/api/v1/automations"),
        fetch("/api/v1/content"),
        fetch("/api/v1/integrations"),
        fetch("/api/v1/settings"),
        fetch("/api/v1/jobs")
      ]);

      const [dashJson, webJson, aiJson, wfJson, artJson, intJson, setJson, jobsJson] =
        await Promise.all([
          dashRes.json(),
          webRes.json(),
          aiRes.json(),
          wfRes.json(),
          artRes.json(),
          intRes.json(),
          setRes.json(),
          jobsRes.json()
        ]);

      if (dashJson.success) setSummary(dashJson.data);
      if (webJson.success) {
        setWebsites(webJson.data);
        if (webJson.data.length > 0 && !selectedWebsiteId) {
          setSelectedWebsiteId(webJson.data[0].id);
        }
      }
      if (aiJson.success) setProviders(aiJson.data);
      if (wfJson.success) setWorkflows(wfJson.data);
      if (artJson.success) setArticles(artJson.data.articles || []);
      if (intJson.success) setIntegrations(intJson.data);
      if (setJson.success) setSettings(setJson.data);
      if (jobsJson.success) {
        setDurableJobs(jobsJson.data.jobs || []);
        setJobCounts(
          jobsJson.data.counts || {
            queued: 0,
            running: 0,
            completed: 0,
            retryScheduled: 0,
            deadLetter: 0
          }
        );
      }
    } catch {
      setBanner({ type: "error", text: "Failed to synchronize control plane state" });
    } finally {
      setLoading(false);
    }
  }, [selectedWebsiteId]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  async function handleLogout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function handleCreateWebsite(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    const res = await fetch("/api/v1/websites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newSiteName,
        url: newSiteUrl,
        cmsType: newSiteCms,
        credentials:
          newSiteUser || newSiteSecret
            ? { username: newSiteUser, appPassword: newSiteSecret }
            : undefined
      })
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setBanner({ type: "error", text: json.error?.message || "Failed to add website" });
      return;
    }
    setNewSiteName("");
    setNewSiteUrl("");
    setNewSiteUser("");
    setNewSiteSecret("");
    setBanner({
      type: "success",
      text: `Website "${json.data.name}" registered with AES-256-GCM encrypted credentials.`
    });
    fetchAllData();
  }

  async function handleDeleteWebsite(id: string) {
    const res = await fetch(`/api/v1/websites/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (res.ok && json.success) {
      setBanner({ type: "success", text: "Website removed." });
      fetchAllData();
    }
  }

  async function handleCreateAIProvider(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    const res = await fetch("/api/v1/ai-providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newProviderName,
        providerType: newProviderType,
        baseUrl: newProviderUrl,
        isLocal: true,
        defaultModelId: newProviderModel,
        defaultModelName: newProviderModel
      })
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setBanner({
        type: "error",
        text: json.error?.message || "Failed to register AI provider"
      });
      return;
    }
    setNewProviderName("");
    setBanner({ type: "success", text: `AI Provider "${json.data.name}" added.` });
    fetchAllData();
  }

  async function handleTestAIProvider(providerId: string) {
    setBanner({ type: "success", text: "Testing AI provider connection..." });
    const res = await fetch("/api/v1/ai-providers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test_connection", providerId })
    });
    const json = await res.json();
    if (json.success) {
      setBanner({
        type: json.data.testResult.connected ? "success" : "error",
        text: `${json.data.testResult.message} (${json.data.testResult.latencyMs}ms)`
      });
      fetchAllData();
    }
  }

  async function handleCreateArticle(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedWebsiteId) return;
    const res = await fetch("/api/v1/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        websiteId: selectedWebsiteId,
        title: newArticleTitle,
        slug: newArticleSlug,
        focusKeyword: newArticleKeyword,
        content: newArticleContent,
        status: "DRAFT"
      })
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setBanner({
        type: "error",
        text: json.error?.message || "Failed to create draft article"
      });
      return;
    }
    setNewArticleTitle("");
    setNewArticleSlug("");
    setNewArticleKeyword("");
    setNewArticleContent("");
    setBanner({
      type: "success",
      text: `Draft "${json.data.title}" saved with Version v1 history.`
    });
    fetchAllData();
  }

  async function handleCreateWorkflow(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/v1/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        websiteId: selectedWebsiteId || undefined,
        name: newWfName,
        slug: newWfSlug,
        workflowType: "N8N_WEBHOOK",
        scheduleCron: newWfCron,
        webhookUrl: newWfWebhook
      })
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setBanner({
        type: "error",
        text: json.error?.message || "Failed to register workflow"
      });
      return;
    }
    setNewWfName("");
    setNewWfSlug("");
    setBanner({ type: "success", text: `Workflow "${json.data.name}" registered.` });
    fetchAllData();
  }

  async function handleTriggerWorkflow(workflowId: string) {
    const res = await fetch("/api/v1/automations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowId })
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setBanner({
        type: "success",
        text: `Workflow executed (${json.data.execution.status}) in ${json.data.execution.durationMs}ms.`
      });
      fetchAllData();
    }
  }

  async function handleEnqueueDurableJob(e: React.FormEvent) {
    e.preventDefault();
    const idempotencyKey = `${newJobType.toLowerCase()}:${selectedWebsiteId || "global"}:${Date.now()}`;
    const res = await fetch("/api/v1/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        websiteId: selectedWebsiteId || null,
        jobType: newJobType,
        idempotencyKey,
        priority: 10,
        payload: {
          websiteId: selectedWebsiteId || null,
          articleId: articles[0]?.id || undefined
        }
      })
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setBanner({
        type: "success",
        text: `Durable job enqueued (${json.data.jobType}) with key ${json.data.idempotencyKey}.`
      });
      fetchAllData();
    }
  }

  async function handleProcessDurableBatch() {
    const res = await fetch("/api/v1/jobs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "process_batch",
        workerId: "dashboard-manual-worker-dispatch",
        maxBatchSize: 5
      })
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setBanner({
        type: "success",
        text: `Processed ${json.data.processedCount} durable background job(s) via worker service.`
      });
      fetchAllData();
    }
  }

  async function handleSaveSetting(setting: SystemSettingRecord, nextValue: unknown) {
    const res = await fetch("/api/v1/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: [
          {
            category: setting.category,
            key: setting.key,
            value: nextValue,
            isSecret: setting.isSecret,
            description: setting.description || undefined
          }
        ]
      })
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setBanner({ type: "success", text: `Updated setting "${setting.key}".` });
      fetchAllData();
    }
  }

  const renderPlaceholderModule = (
    title: string,
    description: string,
    zeroCostArchitectureNotes: string[],
    schemaTablesReady: string[]
  ) => (
    <div className="space-y-6">
      <div className="apex-card p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Phase 01 Foundation Ready &bull; Scheduled for Phase 02+ Execution
            </span>
            <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              {description}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
          <div className="p-5 rounded-2xl bg-slate-50/90 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-500 mb-3">
              Zero-Cost Policy Architecture
            </h3>
            <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              {zeroCostArchitectureNotes.map((note, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50/90 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-500 mb-3">
              Provisioned PostgreSQL Tables &amp; Relations
            </h3>
            <div className="flex flex-wrap gap-2 mt-2">
              {schemaTablesReady.map((tbl) => (
                <span
                  key={tbl}
                  className="px-3 py-1 rounded-lg text-xs font-mono font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/25"
                >
                  {tbl}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 leading-relaxed">
              Database tables, foreign keys, and multi-website isolation indexes are live and migrated in PostgreSQL 16.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const activeNavObj = NAVIGATION_ITEMS.find((n) => n.id === activeNav);

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 apex-mesh-bg">
      {/* Sidebar Navigation (All 15 Required Modules Grouped by Domain) */}
      <aside className="w-64 shrink-0 border-r border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl flex flex-col">
        <div className="p-4 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold shadow-md shadow-blue-600/25">
            A
          </div>
          <div>
            <div className="font-extrabold text-sm tracking-tight">ApexSEO Engine</div>
            <div className="text-[11px] text-emerald-500 font-semibold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Phase 01 Foundation
            </div>
          </div>
        </div>

        <nav
          aria-label="Primary Control Plane Navigation"
          className="flex-1 overflow-y-auto px-3 py-4 space-y-5"
        >
          {NAV_GROUPS.map((groupName) => {
            const groupItems = NAVIGATION_ITEMS.filter((i) => i.group === groupName);
            return (
              <div key={groupName} className="space-y-1">
                <div className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                  {groupName}
                </div>
                {groupItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeNav === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveNav(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/25 font-semibold"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                    >
                      <span className="flex items-center gap-2.5 truncate">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.phase === "PHASE_02_READY" ? (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-slate-200/80 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          P2
                        </span>
                      ) : (
                        isActive && <ChevronRight className="w-3.5 h-3.5 opacity-80" />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200/80 dark:border-slate-800/80 space-y-2 text-xs">
          <div className="p-3 rounded-xl bg-slate-100/90 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <div className="font-bold truncate">{initialUser.name}</div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 font-mono font-semibold">
                {initialUser.roleName}
              </span>
            </div>
            <div className="text-slate-500 dark:text-slate-400 text-[11px] truncate mt-0.5">
              {initialUser.email}
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 font-semibold transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                {activeNavObj?.group}
              </div>
              <h1 className="text-base font-extrabold tracking-tight">
                {activeNavObj?.label}
              </h1>
            </div>
            <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 ml-2">
              <Shield className="w-3.5 h-3.5" />
              Zero-Cost &amp; AdSense Policy Active
            </span>
          </div>

          <div className="flex items-center gap-3">
            {websites.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80">
                <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <select
                  aria-label="Active Website Context"
                  value={selectedWebsiteId}
                  onChange={(e) => setSelectedWebsiteId(e.target.value)}
                  className="text-xs font-semibold bg-transparent focus:outline-none text-slate-800 dark:text-slate-100"
                >
                  {websites.map((w) => (
                    <option
                      key={w.id}
                      value={w.id}
                      className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    >
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={fetchAllData}
              title="Refresh Control Plane State"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-500" : ""}`} />
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              title="Toggle Light/Dark Theme"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>
          </div>
        </header>

        {/* Notification Banner */}
        {banner && (
          <div
            className={`mx-6 mt-4 p-3.5 rounded-xl border text-xs flex items-center justify-between shadow-sm ${
              banner.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
            }`}
          >
            <span className="flex items-center gap-2 font-medium">
              {banner.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              {banner.text}
            </span>
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="text-xs font-semibold underline ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Active Module Content */}
        <main className="flex-1 p-6 overflow-y-auto space-y-6">
          {/* 1. OVERVIEW */}
          {activeNav === "overview" && (
            <div className="space-y-6">
              {/* System Architecture Status Strip */}
              <div className="apex-card p-4 bg-gradient-to-r from-blue-950/40 via-slate-900/90 to-indigo-950/40 border-slate-800 text-slate-100 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Server className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">
                      Autonomous Control Plane &bull; Multi-Website Isolation Active
                    </div>
                    <div className="text-[11px] text-slate-400">
                      PostgreSQL 16 + Local Ollama Adapter + n8n Community + Dual Search/AdSense Compliance Gate
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveNav("seo-optimizer")}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Open Compliance Center</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveNav("ai-article-writer")}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Article Draft</span>
                  </button>
                  {selectedWebsiteId && (
                    <a
                      href={`/p/${selectedWebsiteId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <Globe className="w-3.5 h-3.5 text-blue-400" />
                      <span>View Public Site</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {/* 6 Executive KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  {
                    label: "Total Websites",
                    value: summary?.totalWebsites ?? 0,
                    icon: Globe,
                    accent: "text-blue-500 bg-blue-500/10 border-blue-500/20",
                    targetNav: "websites" as NavSectionId
                  },
                  {
                    label: "Total Keywords",
                    value: summary?.totalKeywords ?? 0,
                    icon: Search,
                    accent: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
                    targetNav: "keyword-research" as NavSectionId
                  },
                  {
                    label: "Total Articles",
                    value: summary?.totalArticles ?? 0,
                    icon: FileText,
                    accent: "text-violet-500 bg-violet-500/10 border-violet-500/20",
                    targetNav: "content-planner" as NavSectionId
                  },
                  {
                    label: "Published Articles",
                    value: summary?.publishedArticles ?? 0,
                    icon: Send,
                    accent: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
                    targetNav: "publishing" as NavSectionId
                  },
                  {
                    label: "Draft Articles",
                    value: summary?.draftArticles ?? 0,
                    icon: Calendar,
                    accent: "text-amber-500 bg-amber-500/10 border-amber-500/20",
                    targetNav: "ai-article-writer" as NavSectionId
                  },
                  {
                    label: "Pending Approvals",
                    value: summary?.pendingApprovals ?? 0,
                    icon: Shield,
                    accent: "text-rose-500 bg-rose-500/10 border-rose-500/20",
                    targetNav: "seo-optimizer" as NavSectionId
                  }
                ].map((stat) => {
                  const StatIcon = stat.icon;
                  return (
                    <button
                      key={stat.label}
                      type="button"
                      onClick={() => setActiveNav(stat.targetNav)}
                      className="apex-card apex-card-hover p-4 text-left group"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div
                          className={`h-8 w-8 rounded-lg border flex items-center justify-center ${stat.accent}`}
                        >
                          <StatIcon className="w-4 h-4" />
                        </div>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition" />
                      </div>
                      <div className="text-2xl font-extrabold tracking-tight">
                        {stat.value}
                      </div>
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                        {stat.label}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Realistic Empty State / Live GSC Overview (No Fake Metrics) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 apex-card p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
                    <div>
                      <h2 className="text-sm font-bold flex items-center gap-2">
                        <LineChart className="w-4 h-4 text-blue-500" />
                        <span>SEO Performance Overview (Google Search Console)</span>
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Real database aggregation from SearchPerformance table (zero fake metrics)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveNav("search-console")}
                      className="text-xs font-semibold text-blue-500 hover:underline flex items-center gap-1"
                    >
                      <span>Configure GSC Sync</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {summary?.seoPerformanceOverview.hasData ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                        <div className="text-xs text-slate-400">Total Clicks</div>
                        <div className="text-2xl font-extrabold text-blue-500 mt-1">
                          {summary.seoPerformanceOverview.totalClicks}
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                        <div className="text-xs text-slate-400">Impressions</div>
                        <div className="text-2xl font-extrabold text-indigo-500 mt-1">
                          {summary.seoPerformanceOverview.totalImpressions}
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                        <div className="text-xs text-slate-400">Average CTR</div>
                        <div className="text-2xl font-extrabold text-emerald-500 mt-1">
                          {summary.seoPerformanceOverview.averageCtr}%
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                        <div className="text-xs text-slate-400">Avg Position</div>
                        <div className="text-2xl font-extrabold text-amber-500 mt-1">
                          {summary.seoPerformanceOverview.averagePosition}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-center space-y-2.5">
                      <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 mx-auto">
                        <LineChart className="w-5 h-5" />
                      </div>
                      <div className="text-sm font-bold">
                        No Search Console Impressions Recorded Yet
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                        In accordance with strict zero-fake-metrics policy, performance charts only render verified query and page telemetry synced from Google Search Console API.
                      </p>
                    </div>
                  )}
                </div>

                {/* Automation Activity */}
                <div className="apex-card p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-bold flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-500" />
                        <span>Automation Activity</span>
                      </h2>
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                        {summary?.activeAutomations ?? 0} Active Workflows
                      </span>
                    </div>
                    {summary?.recentExecutions && summary.recentExecutions.length > 0 ? (
                      <div className="space-y-2.5">
                        {summary.recentExecutions.map((exec) => (
                          <div
                            key={exec.id}
                            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between"
                          >
                            <div>
                              <div className="font-semibold">{exec.workflowName}</div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3" />
                                {exec.triggerSource} &bull; {exec.durationMs ?? 0}ms
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                              {exec.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 py-8 text-center">
                        No workflow executions triggered yet. Visit{" "}
                        <button
                          type="button"
                          onClick={() => setActiveNav("automations")}
                          className="text-blue-500 font-semibold underline"
                        >
                          Automations
                        </button>{" "}
                        to test a workflow run.
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveNav("automations")}
                    className="mt-4 w-full py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition"
                  >
                    Manage Workflow Schedules &rarr;
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. WEBSITES MANAGEMENT */}
          {activeNav === "websites" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="apex-card p-6">
                <h2 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-500" />
                  Add Website &amp; Encrypted Credentials
                </h2>
                <form onSubmit={handleCreateWebsite} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                      Website Name
                    </label>
                    <input
                      required
                      value={newSiteName}
                      onChange={(e) => setNewSiteName(e.target.value)}
                      placeholder="Engineering Blog"
                      className="apex-input"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                      Website URL
                    </label>
                    <input
                      type="url"
                      required
                      value={newSiteUrl}
                      onChange={(e) => setNewSiteUrl(e.target.value)}
                      placeholder="https://blog.example.com"
                      className="apex-input"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                      CMS Adapter Type
                    </label>
                    <select
                      value={newSiteCms}
                      onChange={(e) => setNewSiteCms(e.target.value)}
                      className="apex-input"
                    >
                      <option value="WORDPRESS">WordPress REST API</option>
                      <option value="CUSTOM_REST">Custom REST / Webhook CMS</option>
                      <option value="GHOST">Ghost Headless CMS</option>
                      <option value="HEADLESS">Headless JSON Adapter</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                      CMS Username (Encrypted at Rest)
                    </label>
                    <input
                      value={newSiteUser}
                      onChange={(e) => setNewSiteUser(e.target.value)}
                      placeholder="wp_publisher"
                      className="apex-input"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                      Application Password / API Token (AES-256-GCM)
                    </label>
                    <input
                      type="password"
                      value={newSiteSecret}
                      onChange={(e) => setNewSiteSecret(e.target.value)}
                      placeholder="••••••••••••"
                      className="apex-input"
                    />
                  </div>
                  <button type="submit" className="w-full apex-btn-primary">
                    <Plus className="w-4 h-4" />
                    <span>Register Website</span>
                  </button>
                </form>
              </div>

              <div className="lg:col-span-2 apex-card p-6">
                <h2 className="text-sm font-bold mb-4">
                  Managed Websites ({websites.length})
                </h2>
                <div className="space-y-3">
                  {websites.map((site) => (
                    <div
                      key={site.id}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{site.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/15 text-blue-500 border border-blue-500/25 font-mono font-semibold">
                            {site.cmsType}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 font-semibold">
                            {site.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-1">
                          {site.url}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-2.5 flex flex-wrap items-center gap-4">
                          <span>Articles: {site.counts?.articles ?? 0}</span>
                          <span>Keywords: {site.counts?.keywords ?? 0}</span>
                          <span className="flex items-center gap-1 text-emerald-500 font-medium">
                            <Lock className="w-3 h-3" />
                            {site.credentialsConfigured
                              ? "Encrypted (AES-256-GCM)"
                              : "Unconfigured"}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteWebsite(site.id)}
                        className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition"
                        title="Delete Website"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 3. KEYWORD RESEARCH */}
          {activeNav === "keyword-research" &&
            renderPlaceholderModule(
              "Keyword Research Engine",
              "Zero-cost keyword discovery powered by Google Search Console Query API, Autocomplete expansion, and local LLM intent classification.",
              [
                "No paid Ahrefs/SEMrush API required — uses official free Google Search Console Search Analytics API + Google Autocomplete.",
                "Automatic search intent classification (Informational, Commercial, Transactional) via local Ollama model.",
                "Website-level data isolation enforced on Keyword table."
              ],
              ["Keyword", "KeywordCluster", "SearchPerformance", "Website"]
            )}

          {/* 4. KEYWORD CLUSTERS */}
          {activeNav === "keyword-clusters" &&
            renderPlaceholderModule(
              "Semantic Keyword Clustering",
              "Groups discovered keywords into pillar-and-cluster topical maps using local embeddings (nomic-embed-text via Ollama).",
              [
                "Uses local Ollama embedding endpoint (/api/embeddings) with cosine similarity clustering.",
                "Prevents keyword cannibalization by assigning one target URL per KeywordCluster.",
                "Directly feeds approved clusters into the Content Planner."
              ],
              ["KeywordCluster", "Keyword", "ContentBrief"]
            )}

          {/* 5. CONTENT PLANNER & 6. AI ARTICLE WRITER */}
          {(activeNav === "content-planner" || activeNav === "ai-article-writer") && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="apex-card p-6">
                <h2 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-500" />
                  Create SEO Article Draft &amp; Version Snapshot
                </h2>
                <form onSubmit={handleCreateArticle} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                      Article Title
                    </label>
                    <input
                      required
                      value={newArticleTitle}
                      onChange={(e) => setNewArticleTitle(e.target.value)}
                      placeholder="Complete Guide to Technical SEO"
                      className="apex-input"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                      URL Slug
                    </label>
                    <input
                      required
                      value={newArticleSlug}
                      onChange={(e) => setNewArticleSlug(e.target.value)}
                      placeholder="complete-guide-technical-seo"
                      className="apex-input font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                      Focus Keyword
                    </label>
                    <input
                      value={newArticleKeyword}
                      onChange={(e) => setNewArticleKeyword(e.target.value)}
                      placeholder="technical seo guide"
                      className="apex-input"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                      Markdown Content Body
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={newArticleContent}
                      onChange={(e) => setNewArticleContent(e.target.value)}
                      placeholder="# Heading 1..."
                      className="apex-input font-mono"
                    />
                  </div>
                  <button type="submit" className="w-full apex-btn-primary">
                    <span>Save Draft &amp; Create Version v1</span>
                  </button>
                </form>
              </div>

              <div className="lg:col-span-2 apex-card p-6">
                <h2 className="text-sm font-bold mb-4">
                  Article Repository &amp; Version History ({articles.length})
                </h2>
                <div className="space-y-3">
                  {articles.map((art) => (
                    <div
                      key={art.id}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-sm">{art.title}</div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">
                            /{art.slug} &bull; Website: {art.website?.name || "Default"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-500 border border-blue-500/25">
                            SEO Score: {art.seoScore}/100
                          </span>
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/25">
                            {art.status}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                        <span>
                          Word Count: {art.wordCount} &bull; Focus Keyword:{" "}
                          <strong className="text-slate-700 dark:text-slate-300">
                            {art.focusKeyword || "Unassigned"}
                          </strong>
                        </span>
                        <span className="flex items-center gap-1 font-mono">
                          <History className="w-3.5 h-3.5 text-blue-500" />
                          {art.versions.length} Version(s)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 7. IMAGE GENERATOR */}
          {activeNav === "image-generator" &&
            renderPlaceholderModule(
              "Zero-Cost AI Featured Image & OG Card Generator",
              "Generates SEO-optimized featured images, alt text, and OpenGraph cards using local Stable Diffusion / ComfyUI API or deterministic SVG/Canvas templates.",
              [
                "Zero-cost compliance: connects to local Automatic1111 / ComfyUI API or built-in programmatic SVG banner renderer.",
                "Automatically populates SEO altText, width, height, and caption in ArticleImage table."
              ],
              ["ArticleImage", "Article"]
            )}

          {/* 8. SEO OPTIMIZER & GOOGLE SEARCH + ADSENSE COMPLIANCE CENTER */}
          {activeNav === "seo-optimizer" && (
            <ComplianceCenterPanel websiteId={selectedWebsiteId} />
          )}

          {/* 9. INTERNAL LINKING */}
          {activeNav === "internal-linking" &&
            renderPlaceholderModule(
              "Automated Internal Link Graph Engine",
              "Computes semantic relevance between published and draft articles within the same website to suggest natural anchor text links.",
              [
                "Strict website-level isolation ensures links are only suggested between articles belonging to the same Website.",
                "Tracks sourceArticleId, targetArticleId, anchorText, and relevanceScore in InternalLink table."
              ],
              ["InternalLink", "Article", "Website"]
            )}

          {/* 10. PUBLISHING */}
          {activeNav === "publishing" && (
            <div className="space-y-6">
              <div className="apex-card p-6">
                <h2 className="text-sm font-bold mb-1">
                  Modular CMS Publishing Architecture
                </h2>
                <p className="text-xs text-slate-400 mb-5">
                  Supports WordPress REST API v2 (Application Passwords) and Custom Headless REST CMS adapters with automatic retry queues.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {integrations.map((intg) => (
                    <div
                      key={intg.id}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800"
                    >
                      <div className="font-bold text-sm">{intg.name}</div>
                      <div className="text-slate-400 font-mono text-[11px] mt-1 truncate">
                        {intg.endpointUrl}
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                          {intg.status}
                        </span>
                        <span className="text-slate-500 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-blue-500" />
                          {intg.hasEncryptedCredentials ? "Vault Encrypted" : "No Key"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 11. GOOGLE ANALYTICS */}
          {activeNav === "google-analytics" &&
            renderPlaceholderModule(
              "Google Analytics (GA4) Organic Traffic Monitor",
              "Optional official free GA4 Data API integration for session engagement and conversion attribution on AI-published articles.",
              [
                "Uses official free Google Analytics Data API v1 with encrypted service account credentials in WebsiteIntegration.",
                "Displays honest empty state until a live GA4 property ID and service account are linked."
              ],
              ["WebsiteIntegration", "SearchPerformance"]
            )}

          {/* 12. SEARCH CONSOLE */}
          {activeNav === "search-console" && (
            <div className="apex-card p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold">
                    Google Search Console Integration (Official Free API)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Syncs daily clicks, impressions, CTR, and query positions per website and article.
                  </p>
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/25">
                  Adapter Ready
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {integrations
                  .filter((i) => i.integrationType === "GSC")
                  .map((gsc) => (
                    <div
                      key={gsc.id}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800"
                    >
                      <div className="font-bold text-sm">{gsc.name}</div>
                      <div className="text-slate-400 font-mono mt-1">
                        Property: {gsc.endpointUrl}
                      </div>
                      <div className="text-emerald-500 font-medium mt-2.5 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Status: {gsc.status} (AES-256-GCM Service Account Stored)
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* 13. AUTOMATIONS (Vercel-First Durable Queue + Standalone Worker Service) */}
          {activeNav === "automations" && (
            <div className="space-y-6">
              {/* Durable Job Queue Control Card */}
              <div className="apex-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-500 border border-blue-500/30 text-[11px] font-semibold mb-1.5">
                      <Server className="w-3.5 h-3.5" />
                      <span>Vercel-First Decoupled Worker Queue (Zero Persistent Loops in Vercel Functions)</span>
                    </div>
                    <h2 className="text-base font-extrabold">
                      Durable Background Job Queue (7 Pipeline Stages)
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Idempotent PostgreSQL job queue with lease locks, exponential backoff, dead-letter recovery, and HMAC-SHA256 authenticated worker dispatch.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <form onSubmit={handleEnqueueDurableJob} className="flex items-center gap-2">
                      <select
                        aria-label="Durable Job Type"
                        value={newJobType}
                        onChange={(e) => setNewJobType(e.target.value)}
                        className="apex-input !w-auto !py-1.5 font-mono"
                      >
                        <option value="KEYWORD_RESEARCH">KEYWORD_RESEARCH</option>
                        <option value="AI_ARTICLE_GENERATION">AI_ARTICLE_GENERATION</option>
                        <option value="IMAGE_GENERATION">IMAGE_GENERATION</option>
                        <option value="SEO_AUDITING">SEO_AUDITING</option>
                        <option value="ADSENSE_COMPLIANCE_AUDITING">ADSENSE_COMPLIANCE_AUDITING</option>
                        <option value="AUTOMATED_PUBLISHING">AUTOMATED_PUBLISHING</option>
                        <option value="SEARCH_PERFORMANCE_MONITORING">SEARCH_PERFORMANCE_MONITORING</option>
                      </select>
                      <button type="submit" className="apex-btn-primary !py-1.5 !px-3">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Enqueue Job</span>
                      </button>
                    </form>

                    <button
                      type="button"
                      onClick={handleProcessDurableBatch}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Run Worker Batch</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
                  {[
                    { label: "Queued", val: jobCounts.queued, cls: "text-blue-500" },
                    { label: "Running", val: jobCounts.running, cls: "text-indigo-500" },
                    { label: "Completed", val: jobCounts.completed, cls: "text-emerald-500" },
                    { label: "Retry Scheduled", val: jobCounts.retryScheduled, cls: "text-amber-500" },
                    { label: "Dead Letter", val: jobCounts.deadLetter, cls: "text-rose-500" }
                  ].map((c) => (
                    <div
                      key={c.label}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800"
                    >
                      <div className="text-[11px] text-slate-400">{c.label}</div>
                      <div className={`text-xl font-extrabold mt-0.5 ${c.cls}`}>{c.val}</div>
                    </div>
                  ))}
                </div>

                {durableJobs.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {durableJobs.slice(0, 8).map((job) => (
                      <div
                        key={job.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-blue-500">{job.jobType}</span>
                            <span className="text-[11px] font-mono text-slate-400">
                              Key: {job.idempotencyKey}
                            </span>
                          </div>
                          {job.errorLog && (
                            <div className="text-[11px] text-rose-400 mt-0.5">{job.errorLog}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-slate-400">
                            Attempts: {job.attempts}/{job.maxAttempts}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              job.status === "COMPLETED"
                                ? "bg-emerald-500/15 text-emerald-500"
                                : job.status === "DEAD_LETTER"
                                  ? "bg-rose-500/15 text-rose-500"
                                  : "bg-blue-500/15 text-blue-500"
                            }`}
                          >
                            {job.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="apex-card p-6">
                <h2 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <Workflow className="w-4 h-4 text-blue-500" />
                  Register n8n / Scheduled Automation Workflow
                </h2>
                <form onSubmit={handleCreateWorkflow} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                      Workflow Name
                    </label>
                    <input
                      required
                      value={newWfName}
                      onChange={(e) => setNewWfName(e.target.value)}
                      placeholder="Weekly Content Refresh Pipeline"
                      className="apex-input"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                      Unique Slug
                    </label>
                    <input
                      required
                      value={newWfSlug}
                      onChange={(e) => setNewWfSlug(e.target.value)}
                      placeholder="weekly-content-refresh"
                      className="apex-input font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                      Cron Schedule
                    </label>
                    <input
                      value={newWfCron}
                      onChange={(e) => setNewWfCron(e.target.value)}
                      placeholder="0 */6 * * *"
                      className="apex-input font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                      n8n Community Edition Webhook URL
                    </label>
                    <input
                      value={newWfWebhook}
                      onChange={(e) => setNewWfWebhook(e.target.value)}
                      className="apex-input font-mono"
                    />
                  </div>
                  <button type="submit" className="w-full apex-btn-primary">
                    <span>Register Workflow</span>
                  </button>
                </form>
              </div>

              <div className="lg:col-span-2 apex-card p-6">
                <h2 className="text-sm font-bold mb-4">
                  Workflow Registry &amp; Retry Architecture ({workflows.length})
                </h2>
                <div className="space-y-3">
                  {workflows.map((wf) => (
                    <div
                      key={wf.id}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-sm">{wf.name}</div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            Slug: <span className="font-mono">{wf.slug}</span> &bull; Cron:{" "}
                            <span className="font-mono">{wf.scheduleCron || "Manual"}</span>{" "}
                            &bull; Retries: {wf.maxRetries}x ({wf.retryBackoffMs}ms backoff)
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleTriggerWorkflow(wf.id)}
                          className="apex-btn-primary !py-1.5 !px-3"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Trigger Now</span>
                        </button>
                      </div>
                      {wf.executions.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                          Last Execution:{" "}
                          <strong className="text-emerald-500">
                            {wf.executions[0].status}
                          </strong>{" "}
                          ({wf.executions[0].durationMs ?? 0}ms)
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              </div>
            </div>
          )}

          {/* 14. AI PROVIDERS */}
          {activeNav === "ai-providers" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="apex-card p-6">
                <h2 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-500" />
                  Register Provider-Independent AI Adapter
                </h2>
                <form onSubmit={handleCreateAIProvider} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                      Provider Name
                    </label>
                    <input
                      required
                      value={newProviderName}
                      onChange={(e) => setNewProviderName(e.target.value)}
                      placeholder="Secondary Local vLLM / Ollama"
                      className="apex-input"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                      Adapter Type
                    </label>
                    <select
                      value={newProviderType}
                      onChange={(e) => setNewProviderType(e.target.value)}
                      className="apex-input"
                    >
                      <option value="OLLAMA">Ollama Local Adapter</option>
                      <option value="OPENAI_COMPATIBLE">
                        OpenAI-Compatible Local (LM Studio / vLLM)
                      </option>
                      <option value="LOCAL_LLAMA">llama.cpp HTTP Server</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                      Base Endpoint URL
                    </label>
                    <input
                      type="url"
                      required
                      value={newProviderUrl}
                      onChange={(e) => setNewProviderUrl(e.target.value)}
                      className="apex-input font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                      Default Model ID
                    </label>
                    <input
                      required
                      value={newProviderModel}
                      onChange={(e) => setNewProviderModel(e.target.value)}
                      className="apex-input font-mono"
                    />
                  </div>
                  <button type="submit" className="w-full apex-btn-primary">
                    <span>Add AI Provider</span>
                  </button>
                </form>
              </div>

              <div className="lg:col-span-2 apex-card p-6">
                <h2 className="text-sm font-bold mb-4">
                  Configured AI Providers &amp; Models ({providers.length})
                </h2>
                <div className="space-y-4">
                  {providers.map((prov) => (
                    <div
                      key={prov.id}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{prov.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/15 text-blue-500 border border-blue-500/25 font-mono font-semibold">
                              {prov.providerType}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 font-semibold">
                              {prov.status}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-1">
                            Endpoint: {prov.baseUrl} &bull; Requests: {prov.totalRequests}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleTestAIProvider(prov.id)}
                          className="px-3 py-1.5 rounded-xl border border-blue-500/40 text-blue-500 hover:bg-blue-500/10 text-xs font-semibold transition"
                        >
                          Test Connection
                        </button>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-2">
                        {prov.models.map((m) => (
                          <span
                            key={m.id}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 font-mono"
                          >
                            {m.modelId} ({m.contextWindow} ctx)
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 15. SYSTEM SETTINGS */}
          {activeNav === "settings" && (
            <div className="apex-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold">
                    System Settings (General, Security, AI, Publishing, Automation)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Persisted in PostgreSQL SystemSetting table with audit logging.
                  </p>
                </div>
                <Database className="w-5 h-5 text-blue-500" />
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {settings.map((st) => (
                  <div
                    key={st.id}
                    className="py-3.5 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px] font-semibold">
                          {st.category}
                        </span>
                        <span className="font-bold font-mono">{st.key}</span>
                      </div>
                      <div className="text-slate-400 mt-0.5">{st.description}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      {typeof st.value === "boolean" ? (
                        <button
                          type="button"
                          onClick={() => handleSaveSetting(st, !st.value)}
                          className={`px-3 py-1.5 rounded-xl font-semibold transition ${
                            st.value
                              ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30"
                              : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {st.value ? "ENABLED" : "DISABLED"}
                        </button>
                      ) : (
                        <input
                          defaultValue={String(st.value ?? "")}
                          onBlur={(e) => {
                            if (e.target.value !== String(st.value ?? "")) {
                              handleSaveSetting(st, e.target.value);
                            }
                          }}
                          className="apex-input !w-auto font-mono"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
