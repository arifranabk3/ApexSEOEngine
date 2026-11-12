import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import path from "path";
import fs from "fs";

const DATA_DIR = path.resolve(process.cwd(), ".pglite-data");
const PORT = Number(process.env.PG_PORT || 5432);

async function startLocalPostgresServer() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  console.log(`[Postgres-Engine] Initializing embedded PostgreSQL 16 engine at ${DATA_DIR}...`);
  const db = await PGlite.create({
    dataDir: DATA_DIR
  });

  const server = new PGLiteSocketServer({
    db,
    port: PORT,
    host: "127.0.0.1"
  });

  await server.start();
  console.log(`[Postgres-Engine] PostgreSQL wire-protocol server listening on 127.0.0.1:${PORT}`);

  process.on("SIGINT", async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  });
}

startLocalPostgresServer().catch((err) => {
  console.error("[Postgres-Engine] Fatal startup error:", err);
  process.exit(1);
});

