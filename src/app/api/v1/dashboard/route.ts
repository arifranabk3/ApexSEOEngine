import { NextRequest } from "next/server";
import { ensureSystemSeeded } from "@/lib/seed-service";
import { apiSuccess, requireApiAuth } from "@/lib/api-response";
import { DashboardSummaryMetrics } from "@/types/domain";
import { getAIConfigRepository } from "@/repositories/ai-config-repository.factory";
import { getKeywordDomainRepository } from "@/repositories/keyword-repository.factory";
import { getArticleRepository } from "@/repositories/article-repository.factory";
import { getAutomationRepository } from "@/repositories/automation-repository.factory";
import { getWebsiteRepository } from "@/repositories/website-repository.factory";
import { getAuthRepository } from "@/repositories/auth-repository.factory";
import { getSystemRepository } from "@/repositories/system-repository.factory";

export async function GET(req: NextRequest) {
  await ensureSystemSeeded();
  const { errorResponse } = await requireApiAuth(req);
  if (errorResponse) return errorResponse;

  const websiteRepo = getWebsiteRepository();
  const websites = await websiteRepo.listWebsites();
  const totalWebsites = websites.length;

  const keywordRepo = getKeywordDomainRepository();
  const totalKeywords = await keywordRepo.countKeywords();
  const totalKeywordClusters = await keywordRepo.countClusters();

  const articleRepo = getArticleRepository();
  const totalArticles = await articleRepo.countArticles();
  const publishedArticles = await articleRepo.countArticles({ status: "PUBLISHED" });
  const draftArticles = await articleRepo.countArticles({ status: "DRAFT" });
  const pendingApprovals = await articleRepo.countArticles({ status: "PENDING_APPROVAL" });

  const automationRepo = getAutomationRepository();
  const activeAutomations = await automationRepo.countWorkflows({ isEnabled: true });

  const aiConfigRepo = getAIConfigRepository();
  const healthyAIProviders = await aiConfigRepo.countHealthyProviders();

  const systemRepo = getSystemRepository();
  const perfRecords = await systemRepo.findSearchPerformance({ limit: 500 });

  const totalClicks = perfRecords.reduce((acc, r) => acc + r.clicks, 0);
  const totalImpressions = perfRecords.reduce((acc, r) => acc + r.impressions, 0);
  const averageCtr =
    totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0;
  const averagePosition =
    perfRecords.length > 0
      ? Number(
          (
            perfRecords.reduce((acc, r) => acc + r.position, 0) / perfRecords.length
          ).toFixed(1)
        )
      : 0;

  const rawExecs = await automationRepo.findExecutions({ limit: 8 });
  const recentExecs = await Promise.all(
    rawExecs.map(async (ex) => {
      const wf = await automationRepo.findWorkflowById(ex.workflowId);
      return {
        ...ex,
        workflow: wf ? { name: wf.name } : null
      };
    })
  );

  const rawAudits = await systemRepo.findAuditLogs({ limit: 8 });
  const authRepo = getAuthRepository();
  const recentAuditLogs = await Promise.all(
    rawAudits.map(async (a) => {
      let userEmail: string | null = null;
      if (a.userId) {
        try {
          const authRecord = await authRepo.findUserById(a.userId);
          if (authRecord?.user?.email) userEmail = authRecord.user.email;
        } catch {
          userEmail = null;
        }
      }
      return {
        id: a.id,
        action: a.action,
        module: a.module,
        createdAt: a.createdAt.toISOString(),
        userEmail
      };
    })
  );

  const summary: DashboardSummaryMetrics = {
    totalWebsites,
    totalKeywords,
    totalKeywordClusters,
    totalArticles,
    publishedArticles,
    draftArticles,
    pendingApprovals,
    activeAutomations,
    healthyAIProviders,
    seoPerformanceOverview: {
      totalClicks,
      totalImpressions,
      averageCtr,
      averagePosition,
      hasData: perfRecords.length > 0
    },
    recentExecutions: recentExecs.map((e) => ({
      id: e.id,
      workflowName: e.workflow?.name || "Automated Pipeline",
      status: e.status,
      triggerSource: e.triggerSource,
      startedAt: new Date(e.startedAt).toISOString(),
      durationMs: e.durationMs ?? null
    })),
    recentAuditLogs
  };

  return apiSuccess(summary);
}
