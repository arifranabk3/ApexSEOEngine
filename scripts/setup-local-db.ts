import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), ".pglite-data");
const MIGRATION_FILE = path.resolve(
  process.cwd(),
  "prisma/migrations/20261112000000_init_phase01/migration.sql"
);

export async function ensureLocalDatabaseSchema(existingDb?: PGlite): Promise<PGlite> {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = existingDb ?? (await PGlite.create({ dataDir: DATA_DIR }));

  const tableCheck = await db.query<{ exists: boolean }>(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'User'
    ) AS "exists";
  `);

  if (!tableCheck.rows[0]?.exists) {
    console.log("[DB-Migration] Applying Phase 01 PostgreSQL DDL migration...");
    const rawSql = fs.readFileSync(MIGRATION_FILE, "utf8").replace(/^\uFEFF/, "");
    await db.exec(rawSql);
    console.log("[DB-Migration] All 20 Phase 01 PostgreSQL tables & indexes created successfully.");
  } else {
    console.log("[DB-Migration] Phase 01 PostgreSQL schema already present.");
  }

  return db;
}

if (require.main === module) {
  ensureLocalDatabaseSchema()
    .then(async (db) => {
      const tables = await db.query<{ table_name: string }>(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `);
      console.log(
        `[DB-Migration] Verified ${tables.rows.length} tables:`,
        tables.rows.map((r) => r.table_name).join(", ")
      );
      await db.close();
    })
    .catch((err) => {
      console.error("[DB-Migration] Failed:", err);
      process.exit(1);
    });
}

