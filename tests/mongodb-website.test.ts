import { describe, it, expect, beforeAll } from "vitest";
import { MongoWebsiteRepository } from "@/repositories/website-repository.factory";
import { getWebsiteRepository } from "@/repositories/website-repository.factory";
import { migrateWebsitesToMongo } from "@/services/migration/website-migration-engine";
import { encryptJsonCredentials, decryptJsonCredentials, hasEncryptedCredentials } from "@/lib/crypto";
import { ensureSystemSeeded } from "@/lib/seed-service";

describe("Phase C: MongoDB Website & Integration Migration Suite", () => {
  let repo: ReturnType<typeof getWebsiteRepository>;

  beforeAll(async () => {
    await ensureSystemSeeded();
    repo = getWebsiteRepository();
    await repo.ensureIndexes();
  });

  it("executes an idempotent dry-run migration without writing records", async () => {
    const dryRunRes = await migrateWebsitesToMongo({ dryRun: true });
    expect(dryRunRes.dryRun).toBe(true);
    expect(dryRunRes.websitesSourceCount).toBeGreaterThan(0);
    expect(dryRunRes.errors).toHaveLength(0);
  });

  it("migrates existing PostgreSQL websites and integrations to MongoDB idempotently", async () => {
    const liveRunRes = await migrateWebsitesToMongo({ dryRun: false });
    expect(liveRunRes.dryRun).toBe(false);
    expect(liveRunRes.websitesTargetCount).toBe(liveRunRes.websitesSourceCount);
    expect(liveRunRes.errors).toHaveLength(0);

    const websites = await repo.listWebsites();
    expect(websites.length).toBeGreaterThanOrEqual(1);
    expect(websites[0].id).toBeTruthy();
    expect(websites[0].url).toBeTruthy();
  });

  it("creates, updates, and deletes a website via MongoDB repository with encrypted credentials", async () => {
    const testUrl = `https://test-phase-c-${Date.now()}.local`;
    const creds = { username: "admin", appPassword: "wp-secret-password-123" };
    const cipher = encryptJsonCredentials(creds);

    const created = await repo.createWebsite({
      name: "Phase C Test Site",
      url: testUrl,
      ownerId: "00000000-0000-0000-0000-000000000001",
      cmsType: "WORDPRESS",
      status: "ACTIVE",
      encryptedCredentials: cipher
    });

    expect(created.id).toBeTruthy();
    expect(created.url).toBe(testUrl);
    expect(hasEncryptedCredentials(created.encryptedCredentials)).toBe(true);

    // Verify credential decryption
    const decrypted = decryptJsonCredentials<typeof creds>(created.encryptedCredentials);
    expect(decrypted).toEqual(creds);

    // Enforce unique URL constraint
    await expect(
      repo.createWebsite({
        name: "Duplicate Site",
        url: testUrl,
        ownerId: "00000000-0000-0000-0000-000000000001"
      })
    ).rejects.toThrow();

    // Update website
    const updated = await repo.updateWebsite(created.id, {
      name: "Updated Phase C Site",
      status: "PAUSED"
    });
    expect(updated?.name).toBe("Updated Phase C Site");
    expect(updated?.status).toBe("PAUSED");

    // Clean up
    const deleted = await repo.deleteWebsite(created.id);
    expect(deleted).toBe(true);

    const fetched = await repo.findWebsiteById(created.id);
    expect(fetched).toBeNull();
  });

  it("upserts and lists website integrations via MongoDB repository", async () => {
    const ws = await repo.createWebsite({
      name: "Integration Test Host",
      url: `https://integ-test-${Date.now()}.local`,
      ownerId: "00000000-0000-0000-0000-000000000001"
    });

    const gscCreds = { clientEmail: "gsc@service.iam.gserviceaccount.com" };
    const gscCipher = encryptJsonCredentials(gscCreds);

    const integration = await repo.upsertIntegration({
      websiteId: ws.id,
      integrationType: "GSC",
      name: "Google Search Console",
      encryptedCredentials: gscCipher,
      status: "CONNECTED"
    });

    expect(integration.id).toBeTruthy();
    expect(integration.websiteId).toBe(ws.id);
    expect(integration.integrationType).toBe("GSC");
    expect(integration.status).toBe("CONNECTED");

    // Reconcile list
    const list = await repo.listIntegrations(ws.id);
    expect(list.length).toBe(1);
    expect(list[0].integrationType).toBe("GSC");
    expect(list[0].website?.id).toBe(ws.id);

    // Clean up
    await repo.deleteWebsite(ws.id);
    const postDeleteIntegrations = await repo.listIntegrations(ws.id);
    expect(postDeleteIntegrations.length).toBe(0);
  });
});
