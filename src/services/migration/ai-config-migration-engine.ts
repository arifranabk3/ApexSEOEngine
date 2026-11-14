import { getDb } from "@/lib/db";
import { getAIConfigRepository } from "@/repositories/ai-config-repository.factory";
import { AIProviderStatus, AIProviderType } from "@/repositories/ai-config-repository.types";

export interface AIConfigMigrationReport {
  dryRun: boolean;
  providersExamined: number;
  providersInserted: number;
  providersUpdated: number;
  modelsExamined: number;
  modelsInserted: number;
  modelsUpdated: number;
  skipped: number;
  errors: string[];
}

export async function migrateAIConfigToMongo(
  options: { dryRun?: boolean } = {}
): Promise<AIConfigMigrationReport> {
  const dryRun = options.dryRun ?? false;
  const report: AIConfigMigrationReport = {
    dryRun,
    providersExamined: 0,
    providersInserted: 0,
    providersUpdated: 0,
    modelsExamined: 0,
    modelsInserted: 0,
    modelsUpdated: 0,
    skipped: 0,
    errors: []
  };

  const db = await getDb();
  const mongoRepo = getAIConfigRepository();

  if (!dryRun) {
    await mongoRepo.initIndexes();
  }

  // 1. Fetch AIProviders from Postgres
  const pgProviders = await db.aIProvider.findMany({
    include: { models: true }
  });

  report.providersExamined = pgProviders.length;

  for (const pgP of pgProviders) {
    try {
      const existingMongoP = await mongoRepo.findProviderByName(pgP.name);
      const configObj =
        typeof pgP.config === "object" && pgP.config !== null
          ? (pgP.config as Record<string, unknown>)
          : {};

      if (!existingMongoP) {
        if (!dryRun) {
          await mongoRepo.createProvider({
            id: pgP.id,
            name: pgP.name,
            providerType: pgP.providerType as AIProviderType,
            baseUrl: pgP.baseUrl,
            encryptedApiKey: pgP.encryptedApiKey,
            isLocal: pgP.isLocal,
            isEnabled: pgP.isEnabled,
            status: pgP.status as AIProviderStatus,
            config: configObj
          });
        }
        report.providersInserted++;
      } else {
        if (!dryRun) {
          await mongoRepo.updateProvider(existingMongoP.id, {
            baseUrl: pgP.baseUrl,
            encryptedApiKey: pgP.encryptedApiKey,
            isLocal: pgP.isLocal,
            isEnabled: pgP.isEnabled,
            status: pgP.status as AIProviderStatus,
            config: configObj
          });
        }
        report.providersUpdated++;
      }

      // Process Child Models
      report.modelsExamined += pgP.models.length;
      for (const pgM of pgP.models) {
        try {
          const providerId = existingMongoP ? existingMongoP.id : pgP.id;
          const existingModels = await mongoRepo.findModelsByProvider(providerId);
          const foundModel = existingModels.find((m) => m.modelId === pgM.modelId);

          if (!foundModel) {
            if (!dryRun) {
              await mongoRepo.addModel({
                id: pgM.id,
                providerId,
                name: pgM.name,
                modelId: pgM.modelId,
                capabilities: Array.isArray(pgM.capabilities) ? (pgM.capabilities as string[]) : ["text"],
                contextWindow: pgM.contextWindow,
                temperature: pgM.temperature,
                isDefault: pgM.isDefault,
                isEnabled: pgM.isEnabled
              });
            }
            report.modelsInserted++;
          } else {
            if (!dryRun) {
              await mongoRepo.updateModel(foundModel.id, {
                name: pgM.name,
                capabilities: Array.isArray(pgM.capabilities) ? (pgM.capabilities as string[]) : ["text"],
                contextWindow: pgM.contextWindow,
                temperature: pgM.temperature,
                isDefault: pgM.isDefault,
                isEnabled: pgM.isEnabled
              });
            }
            report.modelsUpdated++;
          }
        } catch (mErr) {
          report.errors.push(
            `Failed to migrate model ${pgM.modelId} for provider ${pgP.name}: ${
              mErr instanceof Error ? mErr.message : String(mErr)
            }`
          );
        }
      }
    } catch (pErr) {
      report.errors.push(
        `Failed to migrate provider ${pgP.name}: ${
          pErr instanceof Error ? pErr.message : String(pErr)
        }`
      );
    }
  }

  return report;
}
