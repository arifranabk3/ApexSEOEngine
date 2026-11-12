import { ensureSystemSeeded } from "../src/lib/seed-service";
import { getDb } from "../src/lib/db";

async function main() {
  console.log("[Seed] Initializing Phase 01 database seed...");
  await ensureSystemSeeded();
  const db = await getDb();
  const users = await db.user.count();
  const roles = await db.role.count();
  const websites = await db.website.count();
  const providers = await db.aIProvider.count();
  const workflows = await db.automationWorkflow.count();
  const settings = await db.systemSetting.count();
  console.log(
    `[Seed] Complete: ${users} user(s), ${roles} role(s), ${websites} website(s), ${providers} AI provider(s), ${workflows} workflow(s), ${settings} setting(s).`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[Seed] Error:", err);
  process.exit(1);
});
