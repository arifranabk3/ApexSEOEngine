import { IAuthRepository } from "./auth-repository.types";
import { PostgresAuthRepository } from "./postgres-auth-repository";
import { MongoAuthRepository } from "./mongo-auth-repository";

let currentRepo: IAuthRepository | null = null;
let currentBackend: string | null = null;

export function getAuthRepository(): IAuthRepository {
  const backend = (process.env.AUTH_STORAGE_BACKEND || "mongodb").toLowerCase();

  if (currentRepo && currentBackend === backend) {
    return currentRepo;
  }

  currentBackend = backend;
  if (backend === "postgres") {
    currentRepo = new PostgresAuthRepository();
  } else {
    currentRepo = new MongoAuthRepository();
  }

  return currentRepo;
}

export function resetAuthRepositoryForTesting(override?: IAuthRepository): void {
  currentRepo = override || null;
  currentBackend = null;
}
