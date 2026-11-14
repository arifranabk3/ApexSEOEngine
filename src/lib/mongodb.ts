import { MongoClient, Db, MongoClientOptions } from "mongodb";
import fs from "fs";
import path from "path";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const options: MongoClientOptions = {
  maxPoolSize: 10,
  minPoolSize: 1,
  serverSelectionTimeoutMS: 8000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 30000
};

let clientPromise: Promise<MongoClient>;

function normalizeMongoUri(rawUri: string): string {
  if (!rawUri.startsWith("mongodb://") && !rawUri.startsWith("mongodb+srv://")) {
    return rawUri;
  }
  const isSrv = rawUri.startsWith("mongodb+srv://");
  const prefix = isSrv ? "mongodb+srv://" : "mongodb://";
  const rest = rawUri.slice(prefix.length);
  const lastAt = rest.lastIndexOf("@");
  if (lastAt === -1) return rawUri;

  const authPart = rest.slice(0, lastAt);
  const hostPart = rest.slice(lastAt + 1);
  const colonIdx = authPart.indexOf(":");
  if (colonIdx === -1) return rawUri;

  const user = decodeURIComponent(authPart.slice(0, colonIdx));
  const pass = decodeURIComponent(authPart.slice(colonIdx + 1));
  return `${prefix}${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${hostPart}`;
}

function loadEnvFallback(): void {
  if (process.env.MONGODB_URI) return;
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("MONGODB_URI=")) {
          const val = trimmed.slice("MONGODB_URI=".length).trim().replace(/^["']|["']$/g, "");
          process.env.MONGODB_URI = val;
          break;
        }
      }
    }
  } catch {
    // silent
  }
}

function getClientPromise(): Promise<MongoClient> {
  loadEnvFallback();
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is missing in .env");
  }

  const normalizedUri = normalizeMongoUri(process.env.MONGODB_URI);

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      const client = new MongoClient(normalizedUri, options);
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
  } else {
    if (!clientPromise) {
      const client = new MongoClient(normalizedUri, options);
      clientPromise = client.connect();
    }
    return clientPromise;
  }
}

/**
 * Returns connected MongoDB database instance.
 */
export async function getMongoDb(databaseName?: string): Promise<Db> {
  const client = await getClientPromise();
  // If databaseName is omitted, MongoDB driver uses the database specified in connection string
  return client.db(databaseName);
}

/**
 * Checks connection health and returns active ping latency.
 */
export async function pingMongo(): Promise<{ ok: boolean; latencyMs: number; databaseName: string }> {
  const start = Date.now();
  const db = await getMongoDb();
  await db.command({ ping: 1 });
  const latencyMs = Date.now() - start;
  return {
    ok: true,
    latencyMs,
    databaseName: db.databaseName
  };
}
