import { getDb } from "@/lib/db";
import { getMongoDb } from "@/lib/mongodb";
import { MongoWebsiteRepository } from "@/repositories/mongo-website-repository";

export interface WebsiteMigrationOptions {
  dryRun?: boolean;
}

export interface WebsiteMigrationSummary {
  dryRun: boolean;
  websitesSourceCount: number;
  websitesTargetCount: number;
  integrationsSourceCount: number;
  integrationsTargetCount: number;
  errors: string[];
  durationMs: number;
}

export async function migrateWebsitesToMongo(
  options: WebsiteMigrationOptions = {}
): Promise<WebsiteMigrationSummary> {
  const startTime = Date.now();
  const dryRun = !!options.dryRun;
  const errors: string[] = [];

  const pgDb = await getDb();
  const mongoDb = await getMongoDb();
  const repo = new MongoWebsiteRepository();

  if (!dryRun) {
    await repo.ensureIndexes();
  }

  // 1. Websites Migration
  const pgWebsites = await pgDb.website.findMany();
  let websitesMigrated = 0;

  for (const ws of pgWebsites) {
    try {
      if (!dryRun) {
        await mongoDb.collection("websites").updateOne(
          { id: ws.id },
          {
            $set: {
              id: ws.id,
              name: ws.name,
              url: ws.url,
              cmsType: ws.cmsType,
              status: ws.status,
              ownerId: ws.ownerId,
              encryptedCredentials: ws.encryptedCredentials,
              publishingConfig: ws.publishingConfig || {},
              seoConfig: ws.seoConfig || {},
              createdAt: ws.createdAt,
              updatedAt: ws.updatedAt
            }
          },
          { upsert: true }
        );
      }
      websitesMigrated++;
    } catch (err: unknown) {
      errors.push(`Website migration error for ${ws.url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 2. Integrations Migration
  const pgIntegrations = await pgDb.websiteIntegration.findMany();
  let integrationsMigrated = 0;

  for (const integ of pgIntegrations) {
    try {
      if (!dryRun) {
        await mongoDb.collection("website_integrations").updateOne(
          { id: integ.id },
          {
            $set: {
              id: integ.id,
              websiteId: integ.websiteId,
              integrationType: integ.integrationType,
              name: integ.name,
              endpointUrl: integ.endpointUrl,
              encryptedCredentials: integ.encryptedCredentials,
              status: integ.status,
              lastSyncedAt: integ.lastSyncedAt,
              createdAt: integ.createdAt,
              updatedAt: integ.updatedAt
            }
          },
          { upsert: true }
        );
      }
      integrationsMigrated++;
    } catch (err: unknown) {
      errors.push(`Integration migration error for ${integ.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    dryRun,
    websitesSourceCount: pgWebsites.length,
    websitesTargetCount: websitesMigrated,
    integrationsSourceCount: pgIntegrations.length,
    integrationsTargetCount: integrationsMigrated,
    errors,
    durationMs: Date.now() - startTime
  };
}
