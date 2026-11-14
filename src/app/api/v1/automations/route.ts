import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureSystemSeeded } from "@/lib/seed-service";
import {
  apiError,
  apiSuccess,
  parseAndValidateBody,
  requireApiAuth
} from "@/lib/api-response";
import { executeAutomationWorkflow } from "@/services/automation/workflow-engine";
import { recordAuditLog } from "@/lib/audit";
import { getAutomationRepository } from "@/repositories/automation-repository.factory";
import { getWebsiteRepository } from "@/repositories/website-repository.factory";

const createWorkflowSchema = z.object({
  websiteId: z.string().optional(),
  name: z.string().min(3),
  slug: z.string().min(3),
  description: z.string().optional(),
  workflowType: z.enum(["N8N_WEBHOOK", "INTERNAL_CRON", "MANUAL_PIPELINE"]).default("N8N_WEBHOOK"),
  n8nWorkflowId: z.string().optional(),
  webhookUrl: z.string().optional(),
  scheduleCron: z.string().optional(),
  maxRetries: z.number().min(0).max(10).default(3),
  retryBackoffMs: z.number().min(1000).max(60000).default(5000)
});

const triggerWorkflowSchema = z.object({
  workflowId: z.string().min(1),
  payload: z.record(z.unknown()).optional()
});

export async function GET(req: NextRequest) {
  await ensureSystemSeeded();
  const { errorResponse } = await requireApiAuth(req, "automations:read");
  if (errorResponse) return errorResponse;

  const repo = getAutomationRepository();
  const websiteRepo = getWebsiteRepository();

  const workflows = await repo.findWorkflowsByWebsite();
  const enriched = await Promise.all(
    workflows.map(async (wf) => {
      const [website, executions] = await Promise.all([
        wf.websiteId ? websiteRepo.findWebsiteById(wf.websiteId) : null,
        repo.findExecutions({ workflowId: wf.id, limit: 5 })
      ]);
      return {
        ...wf,
        website: website ? { id: website.id, name: website.name } : null,
        executions
      };
    })
  );

  return apiSuccess(enriched);
}

export async function POST(req: NextRequest) {
  await ensureSystemSeeded();
  const { user, errorResponse } = await requireApiAuth(req, "automations:write");
  if (errorResponse || !user) return errorResponse!;

  const { data, errorResponse: valErr } = await parseAndValidateBody(
    req,
    createWorkflowSchema
  );
  if (valErr || !data) return valErr!;

  const repo = getAutomationRepository();
  const existing = await repo.findWorkflowBySlug(data.slug);
  if (existing) {
    return apiError(
      "DUPLICATE_WORKFLOW_SLUG",
      `Workflow with slug ${data.slug} already exists`,
      409
    );
  }

  const created = await repo.createWorkflow({
    websiteId: data.websiteId || null,
    name: data.name,
    slug: data.slug,
    description: data.description || null,
    workflowType: data.workflowType,
    n8nWorkflowId: data.n8nWorkflowId || null,
    webhookUrl: data.webhookUrl || null,
    scheduleCron: data.scheduleCron || null,
    maxRetries: data.maxRetries,
    retryBackoffMs: data.retryBackoffMs,
    isEnabled: true,
    status: "IDLE"
  });

  await recordAuditLog({
    userId: user.id,
    action: "AUTOMATION_WORKFLOW_CREATED",
    module: "automations",
    entityType: "AutomationWorkflow",
    entityId: created.id,
    metadata: { name: created.name, slug: created.slug }
  });

  return apiSuccess(created, 201);
}

export async function PUT(req: NextRequest) {
  await ensureSystemSeeded();
  const { user, errorResponse } = await requireApiAuth(req, "automations:write");
  if (errorResponse || !user) return errorResponse!;

  const { data, errorResponse: valErr } = await parseAndValidateBody(
    req,
    triggerWorkflowSchema
  );
  if (valErr || !data) return valErr!;

  const execution = await executeAutomationWorkflow({
    workflowId: data.workflowId,
    triggerSource: "MANUAL",
    payload: data.payload
  });

  if (!execution) {
    return apiError("WORKFLOW_EXECUTION_FAILED", "Failed to execute workflow", 500);
  }

  await recordAuditLog({
    userId: user.id,
    action: "AUTOMATION_WORKFLOW_TRIGGERED",
    module: "automations",
    entityType: "AutomationExecution",
    entityId: execution.id,
    metadata: { workflowId: data.workflowId, status: execution.status }
  });

  return apiSuccess({ execution });
}

