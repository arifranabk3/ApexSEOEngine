import { PrismaClient } from "@prisma/client";
import net from "net";
import path from "path";
import fs from "fs";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgliteServerStarted?: Promise<void>;
  pgliteDb?: unknown;
};

/**
 * Determines whether the current DATABASE_URL points to an external managed PostgreSQL
 * provider (e.g., Neon, Supabase, Vercel Postgres, RDS) or a Vercel serverless environment,
 * vs. local fallback development on 127.0.0.1 / localhost.
 */
export function isExternalManagedDatabase(): boolean {
  if (process.env.VERCEL === "1" || process.env.DISABLE_EMBEDDED_PGLITE === "true") {
    return true;
  }
  const dbUrl = process.env.DATABASE_URL || "";
  if (!dbUrl) return false;
  try {
    const parsed = new URL(dbUrl);
    const host = parsed.hostname.toLowerCase();
    return host !== "127.0.0.1" && host !== "localhost";
  } catch {
    return false;
  }
}

function isTcpPortOpen(host: string, port: number, timeoutMs = 400): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (ok: boolean) => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve(ok);
      }
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

export async function ensureDatabaseDaemon(): Promise<void> {
  // Never spawn a local socket daemon when running on Vercel Functions or connected to external managed PostgreSQL
  if (isExternalManagedDatabase()) {
    return;
  }

  if (globalForPrisma.pgliteServerStarted) {
    return globalForPrisma.pgliteServerStarted;
  }

  globalForPrisma.pgliteServerStarted = (async () => {
    const dbUrl =
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@127.0.0.1:5432/seo_automation?schema=public";
    let parsedPort = 5432;
    let parsedHost = "127.0.0.1";
    try {
      const u = new URL(dbUrl);
      parsedPort = Number(u.port || 5432);
      parsedHost = u.hostname === "localhost" ? "127.0.0.1" : u.hostname;
    } catch {
      // fallback to 127.0.0.1:5432
    }

    const alreadyRunning = await isTcpPortOpen(parsedHost, parsedPort);
    if (alreadyRunning) {
      return;
    }

    const { PGlite } = await import("@electric-sql/pglite");
    const { PGLiteSocketServer } = await import("@electric-sql/pglite-socket");

    const dataDir = path.resolve(process.cwd(), ".pglite-data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const pglite = await PGlite.create({ dataDir });
    globalForPrisma.pgliteDb = pglite;

    const tableCheck = await pglite.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'User'
      ) AS "exists";
    `);

    if (!tableCheck.rows[0]?.exists) {
      const migrationFile = path.resolve(
        process.cwd(),
        "prisma/migrations/20261112000000_init_phase01/migration.sql"
      );
      if (fs.existsSync(migrationFile)) {
        const rawSql = fs.readFileSync(migrationFile, "utf8").replace(/^\uFEFF/, "");
        await pglite.exec(rawSql);
      }
    }

    // Ensure DurableJob table exists on existing local .pglite-data directories
    const durableJobCheck = await pglite.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'DurableJob'
      ) AS "exists";
    `);

    if (!durableJobCheck.rows[0]?.exists) {
      await pglite.exec(`
        CREATE TABLE IF NOT EXISTS "DurableJob" (
          "id" TEXT NOT NULL,
          "websiteId" TEXT,
          "jobType" TEXT NOT NULL,
          "idempotencyKey" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'QUEUED',
          "priority" INTEGER NOT NULL DEFAULT 10,
          "payload" JSONB NOT NULL DEFAULT '{}',
          "result" JSONB,
          "errorLog" TEXT,
          "attempts" INTEGER NOT NULL DEFAULT 0,
          "maxAttempts" INTEGER NOT NULL DEFAULT 3,
          "nextRetryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "lockedBy" TEXT,
          "lockedUntil" TIMESTAMP(3),
          "startedAt" TIMESTAMP(3),
          "completedAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "DurableJob_pkey" PRIMARY KEY ("id")
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "DurableJob_idempotencyKey_key" ON "DurableJob"("idempotencyKey");
        CREATE INDEX IF NOT EXISTS "DurableJob_status_nextRetryAt_priority_idx" ON "DurableJob"("status", "nextRetryAt", "priority");
        CREATE INDEX IF NOT EXISTS "DurableJob_websiteId_jobType_idx" ON "DurableJob"("websiteId", "jobType");
        CREATE INDEX IF NOT EXISTS "DurableJob_lockedUntil_idx" ON "DurableJob"("lockedUntil");
      `);
    }

    // Apply external-scheduler migration (idempotent CREATE ... IF NOT EXISTS)
    const schedulerMigration = path.resolve(
      process.cwd(),
      "prisma/migrations/20261112100000_external_scheduler/migration.sql"
    );
    if (fs.existsSync(schedulerMigration)) {
      await pglite.exec(fs.readFileSync(schedulerMigration, "utf8").replace(/^\uFEFF/, ""));
    }

    // Apply security-hardening migration (idempotent ALTER TABLE ... ADD COLUMN IF NOT EXISTS)
    const securityMigration = path.resolve(
      process.cwd(),
      "prisma/migrations/20261114000000_security_hardening/migration.sql"
    );
    if (fs.existsSync(securityMigration)) {
      await pglite.exec(fs.readFileSync(securityMigration, "utf8").replace(/^\uFEFF/, ""));
    }

    const server = new PGLiteSocketServer({
      db: pglite,
      port: parsedPort,
      host: "127.0.0.1"
    });
    try {
      await server.start();
    } catch (err) {
      if (!(err instanceof Error && err.message.includes("EADDRINUSE"))) {
        throw err;
      }
    }
    await new Promise((r) => setTimeout(r, 150));
  })();

  return globalForPrisma.pgliteServerStarted;
}

function getSafeDatabaseUrl(): string {
  const raw =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@127.0.0.1:5432/seo_automation?schema=public&sslmode=disable&connection_limit=1";
  if (!raw.includes("connection_limit=")) {
    return `${raw}${raw.includes("?") ? "&" : "?"}connection_limit=1`;
  }
  return raw;
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: getSafeDatabaseUrl()
      }
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function getDb(): Promise<PrismaClient> {
  await ensureDatabaseDaemon();
  return prisma;
}
