import { IAuthRepository } from "./auth-repository.types";
import { PostgresAuthRepository } from "./postgres-auth-repository";
import { MongoAuthRepository } from "./mongo-auth-repository";

let currentRepo: IAuthRepository | null = null;
let currentBackend: string | null = null;

export function getAuthRepository(): IAuthRepository {
  // If explicitly configured, honor AUTH_STORAGE_BACKEND.
  // Otherwise, default to MongoDB only if MONGODB_URI is available in environment;
  // if not, fall back cleanly to PostgreSQL to prevent Vercel outages during phased migration.
  const envBackend = process.env.AUTH_STORAGE_BACKEND?.toLowerCase();
  const backend = envBackend || (process.env.MONGODB_URI ? "mongodb" : "postgres");

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
