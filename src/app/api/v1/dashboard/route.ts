import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ensureSystemSeeded } from "@/lib/seed-service";
import { apiSuccess, requireApiAuth } from "@/lib/api-response";
import { DashboardSummaryMetrics } from "@/types/domain";
import { getAIConfigRepository } from "@/repositories/ai-config-repository.factory";

export async function GET(req: NextRequest) {
  await ensureSystemSeeded();
  const { errorResponse } = await requireApiAuth(req);
  if (errorResponse) return errorResponse;

  const db = await getDb();

  const totalWebsites = await db.website.count();
  const totalKeywords = await db.keyword.count();
  const totalKeywordClusters = await db.keywordCluster.count();
  const totalArticles = await db.article.count();
  const publishedArticles = await db.article.count({ where: { status: "PUBLISHED" } });
  const draftArticles = await db.article.count({ where: { status: "DRAFT" } });
  const pendingApprovals = await db.article.count({
    where: { status: "PENDING_APPROVAL" }
  });
  const activeAutomations = await db.automationWorkflow.count({
    where: { isEnabled: true }
  });
  const aiConfigRepo = getAIConfigRepository();
  const healthyAIProviders = await aiConfigRepo.countHealthyProviders();

  const perfRecords = await db.searchPerformance.findMany({
    take: 500,
    orderBy: { date: "desc" }
  });

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

  const recentExecs = await db.automationExecution.findMany({
    take: 8,
    orderBy: { startedAt: "desc" },
    include: { workflow: { select: { name: true } } }
  });

  const recentAudits = await db.auditLog.findMany({
    take: 8,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { email: true } } }
  });

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
      workflowName: e.workflow.name,
      status: e.status,
      triggerSource: e.triggerSource,
      startedAt: e.startedAt.toISOString(),
      durationMs: e.durationMs
    })),
    recentAuditLogs: recentAudits.map((a) => ({
      id: a.id,
      action: a.action,
      module: a.module,
      createdAt: a.createdAt.toISOString(),
      userEmail: a.user?.email || null
    }))
  };

  return apiSuccess(summary);
}

