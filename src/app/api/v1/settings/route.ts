import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureSystemSeeded } from "@/lib/seed-service";
import {
  apiSuccess,
  requireApiAuth,
  parseAndValidateBody
} from "@/lib/api-response";
import { encryptSecret, maskSecretValue } from "@/lib/crypto";
import { recordAuditLog } from "@/lib/audit";
import { getSystemRepository } from "@/repositories/system-repository.factory";

const updateSettingsSchema = z.object({
  settings: z.array(
    z.object({
      category: z.string().min(1),
      key: z.string().min(1),
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

  const systemRepo = getSystemRepository();
  const settings = await systemRepo.findAllSettings();

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

  const systemRepo = getSystemRepository();
  const updatedKeys: string[] = [];

  for (const item of data.settings) {
    const storedValue = item.isSecret
      ? encryptSecret(String(item.value ?? ""))
      : item.value;

    await systemRepo.upsertSetting({
      key: item.key,
      value: storedValue,
      category: item.category,
      isSecret: item.isSecret,
      description: item.description,
    });
    updatedKeys.push(item.key);
  }

  await recordAuditLog({
    userId: user.id,
    action: "SYSTEM_SETTINGS_UPDATED",
    module: "settings",
    metadata: {
      updatedKeys,
      count: updatedKeys.length
    }
  });

  return apiSuccess({ updatedCount: updatedKeys.length, keys: updatedKeys });
}
