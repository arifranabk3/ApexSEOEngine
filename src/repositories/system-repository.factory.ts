import { ISystemRepository } from "./system-repository.types";
import { MongoSystemRepository } from "./mongo-system-repository";

let systemRepositoryInstance: ISystemRepository | null = null;

export function getSystemRepository(): ISystemRepository {
  if (!systemRepositoryInstance) {
    systemRepositoryInstance = new MongoSystemRepository();
  }
  return systemRepositoryInstance;
}

export function setSystemRepository(repo: ISystemRepository | null): void {
  systemRepositoryInstance = repo;
}
