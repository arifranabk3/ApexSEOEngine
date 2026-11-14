import { IAutomationRepository } from "./automation-repository.types";
import { MongoAutomationRepository } from "./mongo-automation-repository";

let automationRepoInstance: IAutomationRepository | null = null;

export function getAutomationRepository(): IAutomationRepository {
  if (!automationRepoInstance) {
    automationRepoInstance = new MongoAutomationRepository();
  }
  return automationRepoInstance;
}
