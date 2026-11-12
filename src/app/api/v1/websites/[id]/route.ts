import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getDb } from "@/lib/db";
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

const updateWebsiteSchema = z.object({
  name: z.string().min(2).optional(),
  url: z.string().url().optional(),
  cmsType: z.enum(["WORDPRESS", "CUSTOM_REST", "GHOST", "WEBFLOW", "HEADLESS"]).optional(),
  status: z.enum(["ACTIVE", "PAUSED", "MAINTENANCE"]).optional(),
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

  const db = await getDb();
  const existing = await db.website.findUnique({ where: { id } });
  if (!existing) {
    return apiError("WEBSITE_NOT_FOUND", "Website not found", 404);
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

  const updated = await db.website.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      url: data.url ?? existing.url,
      cmsType: data.cmsType ?? existing.cmsType,
      status: data.status ?? existing.status,
      encryptedCredentials,
      publishingConfig: (data.publishingConfig ??
        existing.publishingConfig) as Prisma.InputJsonValue,
      seoConfig: (data.seoConfig ?? existing.seoConfig) as Prisma.InputJsonValue
    }
  });

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
  const db = await getDb();
  const existing = await db.website.findUnique({ where: { id } });
  if (!existing) {
    return apiError("WEBSITE_NOT_FOUND", "Website not found", 404);
  }

  await db.website.delete({ where: { id } });

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

