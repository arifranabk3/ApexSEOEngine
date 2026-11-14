import { getMongoDb } from "@/lib/mongodb";
import {
  IWebsiteRepository,
  WebsiteEntity,
  WebsiteWithCounts,
  CreateWebsiteInput,
  UpdateWebsiteInput,
  WebsiteIntegrationEntity,
  UpsertIntegrationInput,
  IntegrationWithWebsite,
  WebsiteIntegrationType,
  WebsiteEntitySchema,
  WebsiteIntegrationEntitySchema
} from "./website-repository.types";
import crypto from "crypto";

export class MongoWebsiteRepository implements IWebsiteRepository {
  async ensureIndexes(): Promise<void> {
    const db = await getMongoDb();
    await Promise.all([
      db.collection("websites").createIndexes([
        { key: { id: 1 }, unique: true, name: "uniq_website_id" },
        { key: { url: 1 }, unique: true, name: "uniq_website_url" },
        { key: { ownerId: 1 }, name: "idx_website_ownerId" },
        { key: { status: 1 }, name: "idx_website_status" },
        { key: { createdAt: -1 }, name: "idx_website_createdAt" }
      ]),
      db.collection("website_integrations").createIndexes([
        { key: { id: 1 }, unique: true, name: "uniq_integration_id" },
        {
          key: { websiteId: 1, integrationType: 1 },
          unique: true,
          name: "uniq_website_integration_type"
        },
        { key: { websiteId: 1 }, name: "idx_integration_websiteId" }
      ])
    ]);
  }

  async findWebsiteById(id: string): Promise<WebsiteEntity | null> {
    const db = await getMongoDb();
    const doc = await db.collection("websites").findOne({ id });
    if (!doc) return null;

    const parsed = WebsiteEntitySchema.safeParse({
      id: doc.id,
      name: doc.name,
      url: doc.url,
      cmsType: doc.cmsType,
      status: doc.status,
      ownerId: doc.ownerId,
      encryptedCredentials: doc.encryptedCredentials ?? null,
      publishingConfig: doc.publishingConfig ?? {},
      seoConfig: doc.seoConfig ?? {},
      createdAt: new Date(doc.createdAt),
      updatedAt: new Date(doc.updatedAt)
    });

    return parsed.success ? parsed.data : null;
  }

  async findWebsiteByUrl(url: string): Promise<WebsiteEntity | null> {
    const db = await getMongoDb();
    const doc = await db.collection("websites").findOne({ url });
    if (!doc) return null;

    const parsed = WebsiteEntitySchema.safeParse({
      id: doc.id,
      name: doc.name,
      url: doc.url,
      cmsType: doc.cmsType,
      status: doc.status,
      ownerId: doc.ownerId,
      encryptedCredentials: doc.encryptedCredentials ?? null,
      publishingConfig: doc.publishingConfig ?? {},
      seoConfig: doc.seoConfig ?? {},
      createdAt: new Date(doc.createdAt),
      updatedAt: new Date(doc.updatedAt)
    });

    return parsed.success ? parsed.data : null;
  }

  async listWebsites(ownerId?: string): Promise<WebsiteWithCounts[]> {
    const db = await getMongoDb();
    const query = ownerId ? { ownerId } : {};
    const docs = await db
      .collection("websites")
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    const results: WebsiteWithCounts[] = [];

    for (const doc of docs) {
      const parsed = WebsiteEntitySchema.safeParse({
        id: doc.id,
        name: doc.name,
        url: doc.url,
        cmsType: doc.cmsType,
        status: doc.status,
        ownerId: doc.ownerId,
        encryptedCredentials: doc.encryptedCredentials ?? null,
        publishingConfig: doc.publishingConfig ?? {},
        seoConfig: doc.seoConfig ?? {},
        createdAt: new Date(doc.createdAt),
        updatedAt: new Date(doc.updatedAt)
      });

      if (!parsed.success) continue;

      // Count related assets
      const [articles, keywords, categories, integrations] = await Promise.all([
        db.collection("articles").countDocuments({ websiteId: doc.id }),
        db.collection("keywords").countDocuments({ websiteId: doc.id }),
        db.collection("categories").countDocuments({ websiteId: doc.id }),
        db.collection("website_integrations").countDocuments({ websiteId: doc.id })
      ]);

      results.push({
        ...parsed.data,
        counts: { articles, keywords, categories, integrations }
      });
    }

    return results;
  }

  async countWebsites(ownerId?: string): Promise<number> {
    const db = await getMongoDb();
    const query: Record<string, unknown> = {};
    if (ownerId) query.ownerId = ownerId;
    return db.collection("websites").countDocuments(query);
  }

  async createWebsite(input: CreateWebsiteInput): Promise<WebsiteEntity> {
    const db = await getMongoDb();
    const now = new Date();
    const id = crypto.randomUUID();

    const doc = {
      id,
      name: input.name,
      url: input.url,
      cmsType: input.cmsType ?? "WORDPRESS",
      status: input.status ?? "ACTIVE",
      ownerId: input.ownerId,
      encryptedCredentials: input.encryptedCredentials ?? null,
      publishingConfig: input.publishingConfig ?? {
        defaultStatus: "draft",
        autoPublishApproved: false,
        requireFeaturedImage: true
      },
      seoConfig: input.seoConfig ?? {
        defaultAuthor: "Editorial Team",
        requireSearchIntentAlignment: true,
        requireSourceCitations: true,
        enforceHelpfulContentGate: true
      },
      createdAt: now,
      updatedAt: now
    };

    await db.collection("websites").insertOne(doc);

    return {
      ...doc
    };
  }

  async updateWebsite(id: string, input: UpdateWebsiteInput): Promise<WebsiteEntity | null> {
    const db = await getMongoDb();
    const existing = await this.findWebsiteById(id);
    if (!existing) return null;

    const now = new Date();
    const updateDoc: Record<string, unknown> = {
      updatedAt: now
    };

    if (input.name !== undefined) updateDoc.name = input.name;
    if (input.url !== undefined) updateDoc.url = input.url;
    if (input.cmsType !== undefined) updateDoc.cmsType = input.cmsType;
    if (input.status !== undefined) updateDoc.status = input.status;
    if (input.encryptedCredentials !== undefined) updateDoc.encryptedCredentials = input.encryptedCredentials;
    if (input.publishingConfig !== undefined) updateDoc.publishingConfig = input.publishingConfig;
    if (input.seoConfig !== undefined) updateDoc.seoConfig = input.seoConfig;

    await db.collection("websites").updateOne({ id }, { $set: updateDoc });

    return this.findWebsiteById(id);
  }

  async deleteWebsite(id: string): Promise<boolean> {
    const db = await getMongoDb();
    const res = await db.collection("websites").deleteOne({ id });
    if (res.deletedCount > 0) {
      // Cascading cleanups for integrations
      await db.collection("website_integrations").deleteMany({ websiteId: id });
      return true;
    }
    return false;
  }

  // ============================================================================
  // INTEGRATIONS
  // ============================================================================

  async findIntegrationById(id: string): Promise<WebsiteIntegrationEntity | null> {
    const db = await getMongoDb();
    const doc = await db.collection("website_integrations").findOne({ id });
    if (!doc) return null;

    const parsed = WebsiteIntegrationEntitySchema.safeParse({
      id: doc.id,
      websiteId: doc.websiteId,
      integrationType: doc.integrationType,
      name: doc.name,
      endpointUrl: doc.endpointUrl ?? null,
      encryptedCredentials: doc.encryptedCredentials ?? null,
      status: doc.status,
      lastSyncedAt: doc.lastSyncedAt ? new Date(doc.lastSyncedAt) : null,
      createdAt: new Date(doc.createdAt),
      updatedAt: new Date(doc.updatedAt)
    });

    return parsed.success ? parsed.data : null;
  }

  async findIntegration(
    websiteId: string,
    type: WebsiteIntegrationType
  ): Promise<WebsiteIntegrationEntity | null> {
    const db = await getMongoDb();
    const doc = await db.collection("website_integrations").findOne({
      websiteId,
      integrationType: type
    });
    if (!doc) return null;

    const parsed = WebsiteIntegrationEntitySchema.safeParse({
      id: doc.id,
      websiteId: doc.websiteId,
      integrationType: doc.integrationType,
      name: doc.name,
      endpointUrl: doc.endpointUrl ?? null,
      encryptedCredentials: doc.encryptedCredentials ?? null,
      status: doc.status,
      lastSyncedAt: doc.lastSyncedAt ? new Date(doc.lastSyncedAt) : null,
      createdAt: new Date(doc.createdAt),
      updatedAt: new Date(doc.updatedAt)
    });

    return parsed.success ? parsed.data : null;
  }

  async listIntegrations(websiteId?: string): Promise<IntegrationWithWebsite[]> {
    const db = await getMongoDb();
    const query = websiteId ? { websiteId } : {};
    const docs = await db
      .collection("website_integrations")
      .find(query)
      .sort({ updatedAt: -1 })
      .toArray();

    const results: IntegrationWithWebsite[] = [];

    for (const doc of docs) {
      const parsed = WebsiteIntegrationEntitySchema.safeParse({
        id: doc.id,
        websiteId: doc.websiteId,
        integrationType: doc.integrationType,
        name: doc.name,
        endpointUrl: doc.endpointUrl ?? null,
        encryptedCredentials: doc.encryptedCredentials ?? null,
        status: doc.status,
        lastSyncedAt: doc.lastSyncedAt ? new Date(doc.lastSyncedAt) : null,
        createdAt: new Date(doc.createdAt),
        updatedAt: new Date(doc.updatedAt)
      });

      if (!parsed.success) continue;

      const ws = await this.findWebsiteById(doc.websiteId);
      results.push({
        ...parsed.data,
        website: ws ? { id: ws.id, name: ws.name, url: ws.url } : null
      });
    }

    return results;
  }

  async upsertIntegration(input: UpsertIntegrationInput): Promise<WebsiteIntegrationEntity> {
    const db = await getMongoDb();
    const now = new Date();
    const existing = await this.findIntegration(input.websiteId, input.integrationType);

    if (existing) {
      const updateFields: Record<string, unknown> = {
        name: input.name,
        endpointUrl: input.endpointUrl || null,
        status: input.status ?? existing.status,
        updatedAt: now
      };
      if (input.encryptedCredentials !== undefined) {
        updateFields.encryptedCredentials = input.encryptedCredentials;
      }

      await db
        .collection("website_integrations")
        .updateOne({ id: existing.id }, { $set: updateFields });

      return (await this.findIntegrationById(existing.id))!;
    } else {
      const id = crypto.randomUUID();
      const doc = {
        id,
        websiteId: input.websiteId,
        integrationType: input.integrationType,
        name: input.name,
        endpointUrl: input.endpointUrl || null,
        encryptedCredentials: input.encryptedCredentials || null,
        status: input.status ?? "CONFIGURED",
        lastSyncedAt: null,
        createdAt: now,
        updatedAt: now
      };

      await db.collection("website_integrations").insertOne(doc);
      return (await this.findIntegrationById(id))!;
    }
  }

  async deleteIntegration(id: string): Promise<boolean> {
    const db = await getMongoDb();
    const res = await db.collection("website_integrations").deleteOne({ id });
    return res.deletedCount > 0;
  }
}
