import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { ensureSystemSeeded } from "@/lib/seed-service";
import {
  apiSuccess,
  parseAndValidateBody,
  requireApiAuth
} from "@/lib/api-response";
import { encryptSecret, maskSecretValue } from "@/lib/crypto";
import { recordAuditLog } from "@/lib/audit";

const updateSettingsSchema = z.object({
  settings: z.array(
    z.object({
      category: z.enum(["GENERAL", "SECURITY", "AI", "PUBLISHING", "AUTOMATION"]),
      key: z.string().min(2),
      value: z.any(),
      isSecret: z.boolean().default(false),
      description: z.string().optional()
    })
  )
});

export async function GET(req: NextRequest) {
  await ensureSystemSeeded();
  const { errorResponse } = await requireApiAuth(req, "settings:read");
  if (errorResponse) return errorResponse;

  const db = await getDb();
  const settings = await db.systemSetting.findMany({
    orderBy: [{ category: "asc" }, { key: "asc" }]
  });

  const safeSettings = settings.map((s) => ({
    id: s.id,
    category: s.category,
    key: s.key,
    value: s.isSecret ? maskSecretValue(String(s.value || "")) : s.value,
    isSecret: s.isSecret,
    description: s.description,
    updatedAt: s.updatedAt
  }));

  return apiSuccess(safeSettings);
}

export async function PUT(req: NextRequest) {
  await ensureSystemSeeded();
  const { user, errorResponse } = await requireApiAuth(req, "settings:write");
  if (errorResponse || !user) return errorResponse!;

  const { data, errorResponse: valErr } = await parseAndValidateBody(
    req,
    updateSettingsSchema
  );
  if (valErr || !data) return valErr!;

  const db = await getDb();
  const updatedKeys: string[] = [];

  for (const item of data.settings) {
    const storedValue = item.isSecret
      ? encryptSecret(String(item.value ?? ""))
      : item.value;

    await db.systemSetting.upsert({
      where: { key: item.key },
      update: {
        category: item.category,
        value: storedValue as Prisma.InputJsonValue,
        isSecret: item.isSecret,
        description: item.description
      },
      create: {
        category: item.category,
        key: item.key,
        value: storedValue as Prisma.InputJsonValue,
        isSecret: item.isSecret,
        description: item.description
      }
    });
    updatedKeys.push(item.key);
  }

  await recordAuditLog({
    userId: user.id,
    action: "SYSTEM_SETTINGS_UPDATED",
    module: "settings",
    metadata: { updatedKeys }
  });

  return apiSuccess({ updatedKeys, count: updatedKeys.length });
}
