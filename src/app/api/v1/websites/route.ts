import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { ensureSystemSeeded } from "@/lib/seed-service";
import {
  apiError,
  apiSuccess,
  parseAndValidateBody,
  requireApiAuth
} from "@/lib/api-response";
import { encryptJsonCredentials, hasEncryptedCredentials } from "@/lib/crypto";
import { recordAuditLog } from "@/lib/audit";

const createWebsiteSchema = z.object({
  name: z.string().min(2, "Website name must be at least 2 characters"),
  url: z.string().url("Website URL must be a valid URL"),
  cmsType: z.enum(["WORDPRESS", "CUSTOM_REST", "GHOST", "WEBFLOW", "HEADLESS"]).default("WORDPRESS"),
  status: z.enum(["ACTIVE", "PAUSED", "MAINTENANCE"]).default("ACTIVE"),
  credentials: z
    .object({
      username: z.string().optional(),
      appPassword: z.string().optional(),
      apiToken: z.string().optional(),
      endpointUrl: z.string().optional()
    })
    .optional(),
  publishingConfig: z
    .object({
      defaultStatus: z.enum(["draft", "publish"]).default("draft"),
      autoPublishApproved: z.boolean().default(false),
      requireFeaturedImage: z.boolean().default(true)
    })
    .optional(),
  seoConfig: z
    .object({
      defaultAuthor: z.string().default("Editorial Team"),
      requireSearchIntentAlignment: z.boolean().default(true),
      requireSourceCitations: z.boolean().default(true),
      enforceHelpfulContentGate: z.boolean().default(true)
    })
    .optional()
});

export async function GET(req: NextRequest) {
  await ensureSystemSeeded();
  const { errorResponse } = await requireApiAuth(req, "websites:read");
  if (errorResponse) return errorResponse;

  const db = await getDb();
  const websites = await db.website.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          articles: true,
          keywords: true,
          categories: true,
          integrations: true
        }
      }
    }
  });

  const sanitized = websites.map((w) => ({
    id: w.id,
    name: w.name,
    url: w.url,
    cmsType: w.cmsType,
    status: w.status,
    credentialsConfigured: hasEncryptedCredentials(w.encryptedCredentials),
    publishingConfig: w.publishingConfig,
    seoConfig: w.seoConfig,
    counts: w._count,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt
  }));

  return apiSuccess(sanitized);
}

export async function POST(req: NextRequest) {
  await ensureSystemSeeded();
  const { user, errorResponse } = await requireApiAuth(req, "websites:write");
  if (errorResponse || !user) return errorResponse!;

  const { data, errorResponse: valErr } = await parseAndValidateBody(
    req,
    createWebsiteSchema
  );
  if (valErr || !data) return valErr!;

  const db = await getDb();
  const existing = await db.website.findUnique({ where: { url: data.url } });
  if (existing) {
    return apiError(
      "DUPLICATE_WEBSITE_URL",
      `A website with URL ${data.url} is already registered`,
      409
    );
  }

  const encryptedCredentials =
    data.credentials && Object.keys(data.credentials).length > 0
      ? encryptJsonCredentials(data.credentials)
      : null;

  const created = await db.website.create({
    data: {
      name: data.name,
      url: data.url,
      cmsType: data.cmsType,
      status: data.status,
      ownerId: user.id,
      encryptedCredentials,
      publishingConfig: (data.publishingConfig || {
        defaultStatus: "draft",
        autoPublishApproved: false,
        requireFeaturedImage: true
      }) as Prisma.InputJsonValue,
      seoConfig: (data.seoConfig || {
        defaultAuthor: "Editorial Team",
        requireSearchIntentAlignment: true,
        requireSourceCitations: true,
        enforceHelpfulContentGate: true
      }) as Prisma.InputJsonValue
    }
  });

  await recordAuditLog({
    userId: user.id,
    action: "WEBSITE_CREATED",
    module: "websites",
    entityType: "Website",
    entityId: created.id,
    metadata: { name: created.name, url: created.url, cmsType: created.cmsType }
  });

  return apiSuccess(
    {
      id: created.id,
      name: created.name,
      url: created.url,
      cmsType: created.cmsType,
      status: created.status,
      credentialsConfigured: hasEncryptedCredentials(created.encryptedCredentials),
      publishingConfig: created.publishingConfig,
      seoConfig: created.seoConfig,
      createdAt: created.createdAt
    },
    201
  );
}

