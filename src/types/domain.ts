export type CmsType = "WORDPRESS" | "CUSTOM_REST" | "GHOST" | "WEBFLOW" | "HEADLESS";

export type AIProviderType = "OLLAMA" | "OPENAI_COMPATIBLE" | "LOCAL_LLAMA" | "CUSTOM";

export type ArticleStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHED"
  | "ARCHIVED";

export type WorkflowType = "N8N_WEBHOOK" | "INTERNAL_CRON" | "MANUAL_PIPELINE";

export interface DashboardSummaryMetrics {
  totalWebsites: number;
  totalKeywords: number;
  totalKeywordClusters: number;
  totalArticles: number;
  publishedArticles: number;
  draftArticles: number;
  pendingApprovals: number;
  activeAutomations: number;
  healthyAIProviders: number;
  seoPerformanceOverview: {
    totalClicks: number;
    totalImpressions: number;
    averageCtr: number;
    averagePosition: number;
    hasData: boolean;
  };
  recentExecutions: Array<{
    id: string;
    workflowName: string;
    status: string;
    triggerSource: string;
    startedAt: string;
    durationMs: number | null;
  }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    module: string;
    createdAt: string;
    userEmail: string | null;
  }>;
}

