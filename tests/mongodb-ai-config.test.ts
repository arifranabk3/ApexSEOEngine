import { describe, it, expect, beforeAll } from "vitest";
import { getAIConfigRepository } from "../src/repositories/ai-config-repository.factory";
import { migrateAIConfigToMongo } from "../src/services/migration/ai-config-migration-engine";
import { encryptSecret, decryptSecret } from "../src/lib/crypto";

describe("Phase D — MongoDB AI Configuration Migration", () => {
  const repo = getAIConfigRepository();

  beforeAll(async () => {
    await repo.initIndexes();
  });

  it("migrates existing Postgres AI providers and models idempotently", async () => {
    // Dry-run
    const dryRun = await migrateAIConfigToMongo({ dryRun: true });
    expect(dryRun.dryRun).toBe(true);
    expect(dryRun.errors.length).toBe(0);

    // Live run
    const live = await migrateAIConfigToMongo({ dryRun: false });
    expect(live.dryRun).toBe(false);
    expect(live.errors.length).toBe(0);

    // Idempotent second live run
    const secondLive = await migrateAIConfigToMongo({ dryRun: false });
    expect(secondLive.errors.length).toBe(0);
    expect(secondLive.providersInserted).toBe(0);
  });

  it("performs full CRUD lifecycle on AIProvider and nested AIModels", async () => {
    const testName = "Test Custom AI Engine " + Date.now();
    const rawSecret = "sk-test-secret-key-12345";
    const encryptedApiKey = encryptSecret(rawSecret);

    // Create provider with default model
    const created = await repo.createProvider({
      name: testName,
      providerType: "OPENAI_COMPATIBLE",
      baseUrl: "https://api.together.xyz/v1",
      encryptedApiKey,
      isLocal: false,
      isEnabled: true,
      defaultModel: {
        name: "Meta Llama 3 70B",
        modelId: "meta-llama/Llama-3-70b-chat-hf",
        contextWindow: 8192,
        isDefault: true
      }
    });

    expect(created.id).toBeDefined();
    expect(created.name).toBe(testName);
    expect(created.models.length).toBe(1);
    expect(created.models[0].isDefault).toBe(true);

    // Verify secret decryption
    expect(created.encryptedApiKey).not.toBe(rawSecret);
    expect(decryptSecret(created.encryptedApiKey!)).toBe(rawSecret);

    // Add a secondary model
    const addedModel = await repo.addModel({
      providerId: created.id,
      name: "Mistral 7B Instruct",
      modelId: "mistralai/Mistral-7B-Instruct-v0.2",
      contextWindow: 32768,
      isDefault: false
    });

    expect(addedModel.id).toBeDefined();
    expect(addedModel.providerId).toBe(created.id);
    expect(addedModel.isDefault).toBe(false);

    // Promote secondary model to default
    const updatedModel = await repo.updateModel(addedModel.id, { isDefault: true });
    expect(updatedModel?.isDefault).toBe(true);

    // Verify previous model is no longer default
    const models = await repo.findModelsByProvider(created.id);
    const prevDefault = models.find((m) => m.modelId === "meta-llama/Llama-3-70b-chat-hf");
    expect(prevDefault?.isDefault).toBe(false);

    // Update Provider Status and Metrics
    const updatedProvider = await repo.updateProvider(created.id, {
      status: "ONLINE",
      incrementRequests: true,
      incrementTokens: 1500
    });
    expect(updatedProvider?.status).toBe("ONLINE");
    expect(updatedProvider?.totalRequests).toBe(1);
    expect(updatedProvider?.totalTokens).toBe(1500);

    // Clean up
    const deleted = await repo.deleteProvider(created.id);
    expect(deleted).toBe(true);

    // Verify cascade deletion of models
    const remainingModels = await repo.findModelsByProvider(created.id);
    expect(remainingModels.length).toBe(0);
  });

  it("enforces unique constraint on provider name", async () => {
    const duplicateName = "Unique Provider " + Date.now();
    await repo.createProvider({
      name: duplicateName,
      baseUrl: "http://localhost:11434"
    });

    await expect(
      repo.createProvider({
        name: duplicateName,
        baseUrl: "http://localhost:11434"
      })
    ).rejects.toThrow();

    // Clean up
    const found = await repo.findProviderByName(duplicateName);
    if (found) await repo.deleteProvider(found.id);
  });

  it("correctly resolves findFirstEnabledWithDefaultModel", async () => {
    const active = await repo.findFirstEnabledWithDefaultModel();
    if (active) {
      expect(active.provider.isEnabled).toBe(true);
      if (active.defaultModel) {
        expect(active.defaultModel.isEnabled).toBe(true);
        expect(active.defaultModel.providerId).toBe(active.provider.id);
      }
    }
  });
});
