import { NextRequest } from "next/server";
import { z } from "zod";
import {
  apiError,
  apiSuccess,
  parseAndValidateBody,
  requireApiAuth
} from "@/lib/api-response";
import {
  decryptJsonCredentials,
  encryptJsonCredentials,
  hasEncryptedCredentials
} from "@/lib/crypto";
import { recordAuditLog } from "@/lib/audit";
import { createCmsAdapter } from "@/services/cms/cms-adapter";
import { getWebsiteRepository } from "@/repositories/website-repository.factory";
import { WebsiteCmsTypeSchema, WebsiteStatusSchema } from "@/repositories/website-repository.types";

const updateWebsiteSchema = z.object({
  name: z.string().min(2).optional(),
  url: z.string().url().optional(),
  cmsType: WebsiteCmsTypeSchema.optional(),
  status: WebsiteStatusSchema.optional(),
  credentials: z
    .object({
      username: z.string().optional(),
      appPassword: z.string().optional(),
      apiToken: z.string().optional(),
      endpointUrl: z.string().optional()
    })
    .optional(),
  publishingConfig: z.record(z.unknown()).optional(),
  seoConfig: z.record(z.unknown()).optional(),
  testConnection: z.boolean().optional()
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireApiAuth(req, "websites:write");
  if (errorResponse || !user) return errorResponse!;

  const { id } = await context.params;
  const { data, errorResponse: valErr } = await parseAndValidateBody(
    req,
    updateWebsiteSchema
  );
  if (valErr || !data) return valErr!;

  const repo = getWebsiteRepository();
  const existing = await repo.findWebsiteById(id);
  if (!existing) {
    return apiError("WEBSITE_NOT_FOUND", "Website not found", 404);
  }

  // Tenant isolation check
  if (user.roleName !== "SUPER_ADMIN" && existing.ownerId !== user.id) {
    return apiError("FORBIDDEN", "You do not have permission to modify this website", 403);
  }

  if (data.testConnection) {
    const creds = decryptJsonCredentials(existing.encryptedCredentials);
    const adapter = createCmsAdapter({
      cmsType: existing.cmsType,
      siteUrl: existing.url,
      credentials: creds
    });
    const testResult = await adapter.testConnection();
    return apiSuccess({ connectionTest: testResult });
  }

  const encryptedCredentials =
    data.credentials && Object.keys(data.credentials).length > 0
      ? encryptJsonCredentials(data.credentials)
      : existing.encryptedCredentials;

  const updated = await repo.updateWebsite(id, {
    name: data.name,
    url: data.url,
    cmsType: data.cmsType,
    status: data.status,
    encryptedCredentials,
    publishingConfig: data.publishingConfig,
    seoConfig: data.seoConfig
  });

  if (!updated) {
    return apiError("UPDATE_FAILED", "Failed to update website record", 500);
  }

  await recordAuditLog({
    userId: user.id,
    action: "WEBSITE_UPDATED",
    module: "websites",
    entityType: "Website",
    entityId: updated.id,
    metadata: { name: updated.name, status: updated.status }
  });

  return apiSuccess({
    id: updated.id,
    name: updated.name,
    url: updated.url,
    cmsType: updated.cmsType,
    status: updated.status,
    credentialsConfigured: hasEncryptedCredentials(updated.encryptedCredentials),
    publishingConfig: updated.publishingConfig,
    seoConfig: updated.seoConfig,
    updatedAt: updated.updatedAt
  });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireApiAuth(req, "websites:delete");
  if (errorResponse || !user) return errorResponse!;

  const { id } = await context.params;
  const repo = getWebsiteRepository();
  const existing = await repo.findWebsiteById(id);
  if (!existing) {
    return apiError("WEBSITE_NOT_FOUND", "Website not found", 404);
  }

  // Tenant isolation check
  if (user.roleName !== "SUPER_ADMIN" && existing.ownerId !== user.id) {
    return apiError("FORBIDDEN", "You do not have permission to delete this website", 403);
  }

  await repo.deleteWebsite(id);

  await recordAuditLog({
    userId: user.id,
    action: "WEBSITE_DELETED",
    module: "websites",
    entityType: "Website",
    entityId: id,
    metadata: { name: existing.name, url: existing.url }
  });

  return apiSuccess({ deleted: true, id });
}

