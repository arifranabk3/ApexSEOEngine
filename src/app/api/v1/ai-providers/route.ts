import { NextRequest } from "next/server";
import { z } from "zod";
import { ensureSystemSeeded } from "@/lib/seed-service";
import {
  apiError,
  apiSuccess,
  parseAndValidateBody,
  requireApiAuth
} from "@/lib/api-response";
import {
  decryptSecret,
  encryptSecret,
  hasEncryptedCredentials
} from "@/lib/crypto";
import { createAIAdapter } from "@/services/ai/provider-adapter";
import { recordAuditLog } from "@/lib/audit";
import { getAIConfigRepository } from "@/repositories/ai-config-repository.factory";

const createProviderSchema = z.object({
  name: z.string().min(2, "Provider name required"),
  providerType: z
    .enum(["OLLAMA", "OPENAI_COMPATIBLE", "LOCAL_LLAMA", "CUSTOM"])
    .default("OLLAMA"),
  baseUrl: z.string().url("Base URL must be a valid URL"),
  apiKey: z.string().optional(),
  isLocal: z.boolean().default(true),
  isEnabled: z.boolean().default(true),
  defaultModelId: z.string().min(1).default("llama3.2:latest"),
  defaultModelName: z.string().min(1).default("Llama 3.2 Local")
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("test_connection"),
    providerId: z.string().min(1)
  }),
  z.object({
    action: z.literal("discover_models"),
    providerId: z.string().min(1)
  }),
  z.object({
    action: z.literal("verify_model"),
    providerId: z.string().min(1),
    modelId: z.string().min(1)
  }),
  z.object({
    action: z.literal("add_model"),
    providerId: z.string().min(1),
    name: z.string().min(1),
    modelId: z.string().min(1),
    contextWindow: z.number().min(512).default(8192),
    isDefault: z.boolean().default(false)
  }),
  z.object({
    action: z.literal("toggle_provider"),
    providerId: z.string().min(1),
    isEnabled: z.boolean()
  })
]);

export async function GET(req: NextRequest) {
  await ensureSystemSeeded();
  const { errorResponse } = await requireApiAuth(req, "ai:read");
  if (errorResponse) return errorResponse;

  const repo = getAIConfigRepository();
  const providers = await repo.findAllProviders();

  const sanitized = providers.map((p) => ({
    id: p.id,
    name: p.name,
    providerType: p.providerType,
    baseUrl: p.baseUrl,
    hasApiKey: hasEncryptedCredentials(p.encryptedApiKey),
    isLocal: p.isLocal,
    isEnabled: p.isEnabled,
    status: p.status,
    lastCheckedAt: p.lastCheckedAt,
    totalRequests: p.totalRequests,
    totalTokens: p.totalTokens,
    models: p.models
  }));

  return apiSuccess(sanitized);
}

export async function POST(req: NextRequest) {
  await ensureSystemSeeded();
  const { user, errorResponse } = await requireApiAuth(req, "ai:write");
  if (errorResponse || !user) return errorResponse!;

  const { data, errorResponse: valErr } = await parseAndValidateBody(
    req,
    createProviderSchema
  );
  if (valErr || !data) return valErr!;

  const repo = getAIConfigRepository();
  const existing = await repo.findProviderByName(data.name);
  if (existing) {
    return apiError("DUPLICATE_PROVIDER", `AI Provider ${data.name} already exists`, 409);
  }

  const encryptedApiKey = data.apiKey ? encryptSecret(data.apiKey) : null;

  const created = await repo.createProvider({
    name: data.name,
    providerType: data.providerType,
    baseUrl: data.baseUrl,
    encryptedApiKey,
    isLocal: data.isLocal,
    isEnabled: data.isEnabled,
    status: "CONFIGURED",
    defaultModel: {
      name: data.defaultModelName || "Llama 3.2 Local",
      modelId: data.defaultModelId || "llama3.2:latest",
      contextWindow: 32768,
      isDefault: true
    }
  });

  await recordAuditLog({
    userId: user.id,
    action: "AI_PROVIDER_CREATED",
    module: "ai",
    entityType: "AIProvider",
    entityId: created.id,
    metadata: { name: created.name, providerType: created.providerType, isLocal: created.isLocal }
  });

  return apiSuccess(
    {
      id: created.id,
      name: created.name,
      providerType: created.providerType,
      baseUrl: created.baseUrl,
      hasApiKey: hasEncryptedCredentials(created.encryptedApiKey),
      isLocal: created.isLocal,
      isEnabled: created.isEnabled,
      status: created.status,
      models: created.models
    },
    201
  );
}

export async function PATCH(req: NextRequest) {
  await ensureSystemSeeded();
  const { user, errorResponse } = await requireApiAuth(req, "ai:write");
  if (errorResponse || !user) return errorResponse!;

  const { data, errorResponse: valErr } = await parseAndValidateBody(req, actionSchema);
  if (valErr || !data) return valErr!;

  const repo = getAIConfigRepository();

  if (data.action === "test_connection") {
    const provider = await repo.findProviderById(data.providerId);
    if (!provider) {
      return apiError("PROVIDER_NOT_FOUND", "AI provider not found", 404);
    }

    const decryptedKey = provider.encryptedApiKey
      ? decryptSecret(provider.encryptedApiKey)
      : null;

    const adapter = createAIAdapter({
      providerType: provider.providerType,
      baseUrl: provider.baseUrl,
      apiKey: decryptedKey,
      name: provider.name
    });

    const result = await adapter.testConnection();

    await repo.updateProvider(provider.id, {
      status: result.connected ? "ONLINE" : "OFFLINE_READY",
      lastCheckedAt: new Date(),
      incrementRequests: true
    });

    return apiSuccess({ testResult: result });
  }

  if (data.action === "discover_models") {
    const provider = await repo.findProviderById(data.providerId);
    if (!provider) {
      return apiError("PROVIDER_NOT_FOUND", "AI provider not found", 404);
    }

    const decryptedKey = provider.encryptedApiKey
      ? decryptSecret(provider.encryptedApiKey)
      : null;

    const adapter = createAIAdapter({
      providerType: provider.providerType,
      baseUrl: provider.baseUrl,
      apiKey: decryptedKey,
      name: provider.name
    });

    if (!adapter.listModelsDetailed) {
      const basic = await adapter.testConnection();
      return apiSuccess({
        providerId: provider.id,
        models: basic.availableModels.map((m) => ({ name: m, model: m, size: 0 }))
      });
    }

    try {
      const detailedModels = await adapter.listModelsDetailed();
      return apiSuccess({
        providerId: provider.id,
        models: detailedModels
      });
    } catch (err) {
      return apiError(
        "MODEL_DISCOVERY_FAILED",
        err instanceof Error ? err.message : "Failed to discover models from provider",
        502
      );
    }
  }

  if (data.action === "verify_model") {
    const provider = await repo.findProviderById(data.providerId);
    if (!provider) {
      return apiError("PROVIDER_NOT_FOUND", "AI provider not found", 404);
    }

    const decryptedKey = provider.encryptedApiKey
      ? decryptSecret(provider.encryptedApiKey)
      : null;

    const adapter = createAIAdapter({
      providerType: provider.providerType,
      baseUrl: provider.baseUrl,
      apiKey: decryptedKey,
      name: provider.name
    });

    if (adapter.checkModelAvailable) {
      const check = await adapter.checkModelAvailable(data.modelId);
      return apiSuccess(check);
    }

    const test = await adapter.testConnection();
    const available = test.availableModels.includes(data.modelId);
    return apiSuccess({
      available,
      modelId: data.modelId,
      message: available
        ? `Model ${data.modelId} available`
        : `Model ${data.modelId} not found in provider models`
    });
  }

  if (data.action === "add_model") {
    const model = await repo.addModel({
      providerId: data.providerId,
      name: data.name,
      modelId: data.modelId,
      contextWindow: data.contextWindow,
      isDefault: data.isDefault,
      isEnabled: true
    });
    return apiSuccess({ model }, 201);
  }

  const updated = await repo.updateProvider(data.providerId, {
    isEnabled: data.isEnabled
  });

  if (!updated) {
    return apiError("PROVIDER_NOT_FOUND", "AI provider not found", 404);
  }

  return apiSuccess({ providerId: updated.id, isEnabled: updated.isEnabled });
}
