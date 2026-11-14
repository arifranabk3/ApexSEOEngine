import { IAIConfigRepository } from "./ai-config-repository.types";
import { MongoAIConfigRepository } from "./mongo-ai-config-repository";

let aiConfigRepoInstance: IAIConfigRepository | null = null;

export function getAIConfigRepository(): IAIConfigRepository {
  if (!aiConfigRepoInstance) {
    aiConfigRepoInstance = new MongoAIConfigRepository();
  }
  return aiConfigRepoInstance;
}
