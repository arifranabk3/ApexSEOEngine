import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { ensureSystemSeeded } from "@/lib/seed-service";
import {
  apiSuccess,
  parseAndValidateBody,
  requireApiAuth
} from "@/lib/api-response";
import {
  encryptJsonCredentials,
  hasEncryptedCredentials
} from "@/lib/crypto";
import { recordAuditLog } from "@/lib/audit";

const upsertIntegrationSchema = z.object({
  websiteId: z.string().min(1),
  integrationType: z.enum(["WORDPRESS", "GSC", "GA4", "N8N", "CUSTOM_CMS"]),
  name: z.string().min(2),
  endpointUrl: z.string().optional(),
  credentials: z.record(z.unknown()).optional(),
  status: z.enum(["CONFIGURED", "CONNECTED", "DISCONNECTED"]).default("CONFIGURED")
});

export async function GET(req: NextRequest) {
  await ensureSystemSeeded();
  const { errorResponse } = await requireApiAuth(req);
  if (errorResponse) return errorResponse;

  const db = await getDb();
  const integrations = await db.websiteIntegration.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      website: { select: { id: true, name: true, url: true } }
    }
  });

  const sanitized = integrations.map((item) => ({
    id: item.id,
    websiteId: item.websiteId,
    website: item.website,
    integrationType: item.integrationType,
    name: item.name,
    endpointUrl: item.endpointUrl,
    hasEncryptedCredentials: hasEncryptedCredentials(item.encryptedCredentials),
    status: item.status,
    lastSyncedAt: item.lastSyncedAt,
    updatedAt: item.updatedAt
  }));

  return apiSuccess(sanitized);
}

export async function POST(req: NextRequest) {
  await ensureSystemSeeded();
  const { user, errorResponse } = await requireApiAuth(req, "integrations:write");
  if (errorResponse || !user) return errorResponse!;

  const { data, errorResponse: valErr } = await parseAndValidateBody(
    req,
    upsertIntegrationSchema
  );
  if (valErr || !data) return valErr!;

  const encryptedCredentials =
    data.credentials && Object.keys(data.credentials).length > 0
      ? encryptJsonCredentials(data.credentials)
      : undefined;

  const db = await getDb();
  const record = await db.websiteIntegration.upsert({
    where: {
      websiteId_integrationType: {
        websiteId: data.websiteId,
        integrationType: data.integrationType
      }
    },
    update: {
      name: data.name,
      endpointUrl: data.endpointUrl || null,
      ...(encryptedCredentials ? { encryptedCredentials } : {}),
      status: data.status
    },
    create: {
      websiteId: data.websiteId,
      integrationType: data.integrationType,
      name: data.name,
      endpointUrl: data.endpointUrl || null,
      encryptedCredentials: encryptedCredentials || null,
      status: data.status
    }
  });

  await recordAuditLog({
    userId: user.id,
    action: "INTEGRATION_UPDATED",
    module: "integrations",
    entityType: "WebsiteIntegration",
    entityId: record.id,
    metadata: { websiteId: record.websiteId, integrationType: record.integrationType }
  });

  return apiSuccess({
    id: record.id,
    websiteId: record.websiteId,
    integrationType: record.integrationType,
    name: record.name,
    endpointUrl: record.endpointUrl,
    hasEncryptedCredentials: hasEncryptedCredentials(record.encryptedCredentials),
    status: record.status
  });
}

