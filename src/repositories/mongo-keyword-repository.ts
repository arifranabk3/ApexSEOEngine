import { Collection, Document } from "mongodb";
import { getMongoDb } from "@/lib/mongodb";
import { randomUUID } from "crypto";
import {
  CategoryEntity,
  CategoryEntitySchema,
  CreateCategoryInput,
  CreateKeywordClusterInput,
  CreateKeywordInput,
  IKeywordDomainRepository,
  KeywordClusterEntity,
  KeywordClusterEntitySchema,
  KeywordEntity,
  KeywordEntitySchema,
  UpdateCategoryInput,
  UpdateKeywordClusterInput,
  UpdateKeywordInput
} from "./keyword-repository.types";

interface MongoCategoryDoc extends Document {
  id: string;
  websiteId: string;
  name: string;
  slug: string;
  description?: string | null;
  parentId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MongoClusterDoc extends Document {
  id: string;
  websiteId: string;
  name: string;
  pillarKeyword: string;
  intent: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MongoKeywordDoc extends Document {
  id: string;
  websiteId: string;
  clusterId?: string | null;
  term: string;
  searchIntent: string;
  searchVolume: number;
  difficulty: number;
  cpc: number;
  currentPosition?: number | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoKeywordDomainRepository implements IKeywordDomainRepository {
  private async getCategoryColl(): Promise<Collection<MongoCategoryDoc>> {
    const db = await getMongoDb();
    return db.collection<MongoCategoryDoc>("categories");
  }

  private async getClusterColl(): Promise<Collection<MongoClusterDoc>> {
    const db = await getMongoDb();
    return db.collection<MongoClusterDoc>("keyword_clusters");
  }

  private async getKeywordColl(): Promise<Collection<MongoKeywordDoc>> {
    const db = await getMongoDb();
    return db.collection<MongoKeywordDoc>("keywords");
  }

  async initIndexes(): Promise<void> {
    const catColl = await this.getCategoryColl();
    const clusColl = await this.getClusterColl();
    const kwColl = await this.getKeywordColl();

    await Promise.all([
      // Categories
      catColl.createIndex({ id: 1 }, { unique: true, name: "uniq_category_id" }),
      catColl.createIndex(
        { websiteId: 1, slug: 1 },
        { unique: true, name: "uniq_category_website_slug" }
      ),
      catColl.createIndex({ websiteId: 1 }, { name: "idx_category_websiteId" }),
      catColl.createIndex({ parentId: 1 }, { name: "idx_category_parentId" }),

      // KeywordClusters
      clusColl.createIndex({ id: 1 }, { unique: true, name: "uniq_keyword_cluster_id" }),
      clusColl.createIndex({ websiteId: 1 }, { name: "idx_keyword_cluster_websiteId" }),
      clusColl.createIndex({ status: 1 }, { name: "idx_keyword_cluster_status" }),

      // Keywords
      kwColl.createIndex({ id: 1 }, { unique: true, name: "uniq_keyword_id" }),
      kwColl.createIndex(
        { websiteId: 1, term: 1 },
        { unique: true, name: "uniq_keyword_website_term" }
      ),
      kwColl.createIndex({ websiteId: 1 }, { name: "idx_keyword_websiteId" }),
      kwColl.createIndex({ clusterId: 1 }, { name: "idx_keyword_clusterId" }),
      kwColl.createIndex({ status: 1 }, { name: "idx_keyword_status" })
    ]);
  }

  // --- Category Methods ---
  private mapCategory(doc: MongoCategoryDoc): CategoryEntity {
    return CategoryEntitySchema.parse({
      id: doc.id,
      websiteId: doc.websiteId,
      name: doc.name,
      slug: doc.slug,
      description: doc.description ?? null,
      parentId: doc.parentId ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    });
  }

  async findCategoriesByWebsite(websiteId: string): Promise<CategoryEntity[]> {
    const coll = await this.getCategoryColl();
    const docs = await coll.find({ websiteId }).sort({ name: 1 }).toArray();
    return docs.map((d) => this.mapCategory(d));
  }

  async findCategoryById(id: string): Promise<CategoryEntity | null> {
    const coll = await this.getCategoryColl();
    const doc = await coll.findOne({ id });
    return doc ? this.mapCategory(doc) : null;
  }

  async findCategoryBySlug(websiteId: string, slug: string): Promise<CategoryEntity | null> {
    const coll = await this.getCategoryColl();
    const doc = await coll.findOne({ websiteId, slug });
    return doc ? this.mapCategory(doc) : null;
  }

  async createCategory(input: CreateCategoryInput): Promise<CategoryEntity> {
    const coll = await this.getCategoryColl();
    const now = new Date();
    const id = input.id || randomUUID();

    const doc: MongoCategoryDoc = {
      id,
      websiteId: input.websiteId,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      parentId: input.parentId ?? null,
      createdAt: now,
      updatedAt: now
    };

    await coll.insertOne(doc);
    return this.mapCategory(doc);
  }

  async updateCategory(id: string, updates: UpdateCategoryInput): Promise<CategoryEntity | null> {
    const coll = await this.getCategoryColl();
    const now = new Date();

    const setFields: Record<string, unknown> = { updatedAt: now };
    if (updates.name !== undefined) setFields.name = updates.name;
    if (updates.slug !== undefined) setFields.slug = updates.slug;
    if (updates.description !== undefined) setFields.description = updates.description;
    if (updates.parentId !== undefined) setFields.parentId = updates.parentId;

    const res = await coll.findOneAndUpdate(
      { id },
      { $set: setFields },
      { returnDocument: "after" }
    );
    return res ? this.mapCategory(res) : null;
  }

  async upsertCategory(input: CreateCategoryInput): Promise<CategoryEntity> {
    const coll = await this.getCategoryColl();
    const existing = await coll.findOne({ websiteId: input.websiteId, slug: input.slug });
    if (existing) {
      return this.mapCategory(existing);
    }
    return this.createCategory(input);
  }

  async deleteCategory(id: string): Promise<boolean> {
    const coll = await this.getCategoryColl();
    const res = await coll.deleteOne({ id });
    return (res.deletedCount ?? 0) > 0;
  }

  // --- KeywordCluster Methods ---
  private mapCluster(doc: MongoClusterDoc): KeywordClusterEntity {
    return KeywordClusterEntitySchema.parse({
      id: doc.id,
      websiteId: doc.websiteId,
      name: doc.name,
      pillarKeyword: doc.pillarKeyword,
      intent: doc.intent,
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    });
  }

  async findClustersByWebsite(websiteId: string): Promise<KeywordClusterEntity[]> {
    const coll = await this.getClusterColl();
    const docs = await coll.find({ websiteId }).sort({ createdAt: -1 }).toArray();
    return docs.map((d) => this.mapCluster(d));
  }

  async findClusterById(id: string): Promise<KeywordClusterEntity | null> {
    const coll = await this.getClusterColl();
    const doc = await coll.findOne({ id });
    return doc ? this.mapCluster(doc) : null;
  }

  async createCluster(input: CreateKeywordClusterInput): Promise<KeywordClusterEntity> {
    const coll = await this.getClusterColl();
    const now = new Date();
    const id = input.id || randomUUID();

    const doc: MongoClusterDoc = {
      id,
      websiteId: input.websiteId,
      name: input.name,
      pillarKeyword: input.pillarKeyword,
      intent: input.intent || "INFORMATIONAL",
      status: input.status || "PLANNED",
      createdAt: now,
      updatedAt: now
    };

    await coll.insertOne(doc);
    return this.mapCluster(doc);
  }

  async updateCluster(
    id: string,
    updates: UpdateKeywordClusterInput
  ): Promise<KeywordClusterEntity | null> {
    const coll = await this.getClusterColl();
    const now = new Date();

    const setFields: Record<string, unknown> = { updatedAt: now };
    if (updates.name !== undefined) setFields.name = updates.name;
    if (updates.pillarKeyword !== undefined) setFields.pillarKeyword = updates.pillarKeyword;
    if (updates.intent !== undefined) setFields.intent = updates.intent;
    if (updates.status !== undefined) setFields.status = updates.status;

    const res = await coll.findOneAndUpdate(
      { id },
      { $set: setFields },
      { returnDocument: "after" }
    );
    return res ? this.mapCluster(res) : null;
  }

  async deleteCluster(id: string): Promise<boolean> {
    const coll = await this.getClusterColl();
    const kwColl = await this.getKeywordColl();

    const res = await coll.deleteOne({ id });
    if ((res.deletedCount ?? 0) > 0) {
      await kwColl.updateMany({ clusterId: id }, { $set: { clusterId: null, updatedAt: new Date() } });
      return true;
    }
    return false;
  }

  async countClusters(filter?: { websiteId?: string }): Promise<number> {
    const coll = await this.getClusterColl();
    const query: Record<string, unknown> = {};
    if (filter?.websiteId) query.websiteId = filter.websiteId;
    return coll.countDocuments(query);
  }

  // --- Keyword Methods ---
  private mapKeyword(doc: MongoKeywordDoc): KeywordEntity {
    return KeywordEntitySchema.parse({
      id: doc.id,
      websiteId: doc.websiteId,
      clusterId: doc.clusterId ?? null,
      term: doc.term,
      searchIntent: doc.searchIntent,
      searchVolume: doc.searchVolume ?? 0,
      difficulty: doc.difficulty ?? 0,
      cpc: doc.cpc ?? 0,
      currentPosition: doc.currentPosition ?? null,
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    });
  }

  async findKeywordsByWebsite(
    websiteId: string,
    filter?: { clusterId?: string | null; status?: string; limit?: number; offset?: number }
  ): Promise<KeywordEntity[]> {
    const coll = await this.getKeywordColl();
    const query: Record<string, unknown> = { websiteId };
    if (filter?.clusterId !== undefined) query.clusterId = filter.clusterId;
    if (filter?.status !== undefined) query.status = filter.status;

    let cursor = coll.find(query).sort({ searchVolume: -1, createdAt: -1 });
    if (filter?.offset) cursor = cursor.skip(filter.offset);
    if (filter?.limit) cursor = cursor.limit(filter.limit);

    const docs = await cursor.toArray();
    return docs.map((d) => this.mapKeyword(d));
  }

  async findKeywordById(id: string): Promise<KeywordEntity | null> {
    const coll = await this.getKeywordColl();
    const doc = await coll.findOne({ id });
    return doc ? this.mapKeyword(doc) : null;
  }

  async findKeywordByTerm(websiteId: string, term: string): Promise<KeywordEntity | null> {
    const coll = await this.getKeywordColl();
    const doc = await coll.findOne({ websiteId, term });
    return doc ? this.mapKeyword(doc) : null;
  }

  async createKeyword(input: CreateKeywordInput): Promise<KeywordEntity> {
    const coll = await this.getKeywordColl();
    const now = new Date();
    const id = input.id || randomUUID();

    const doc: MongoKeywordDoc = {
      id,
      websiteId: input.websiteId,
      clusterId: input.clusterId ?? null,
      term: input.term,
      searchIntent: input.searchIntent || "INFORMATIONAL",
      searchVolume: input.searchVolume ?? 0,
      difficulty: input.difficulty ?? 0,
      cpc: input.cpc ?? 0,
      currentPosition: input.currentPosition ?? null,
      status: input.status || "TRACKED",
      createdAt: now,
      updatedAt: now
    };

    await coll.insertOne(doc);
    return this.mapKeyword(doc);
  }

  async updateKeyword(id: string, updates: UpdateKeywordInput): Promise<KeywordEntity | null> {
    const coll = await this.getKeywordColl();
    const now = new Date();

    const setFields: Record<string, unknown> = { updatedAt: now };
    if (updates.clusterId !== undefined) setFields.clusterId = updates.clusterId;
    if (updates.searchIntent !== undefined) setFields.searchIntent = updates.searchIntent;
    if (updates.searchVolume !== undefined) setFields.searchVolume = updates.searchVolume;
    if (updates.difficulty !== undefined) setFields.difficulty = updates.difficulty;
    if (updates.cpc !== undefined) setFields.cpc = updates.cpc;
    if (updates.currentPosition !== undefined) setFields.currentPosition = updates.currentPosition;
    if (updates.status !== undefined) setFields.status = updates.status;

    const res = await coll.findOneAndUpdate(
      { id },
      { $set: setFields },
      { returnDocument: "after" }
    );
    return res ? this.mapKeyword(res) : null;
  }

  async upsertKeyword(input: CreateKeywordInput): Promise<KeywordEntity> {
    const coll = await this.getKeywordColl();
    const existing = await coll.findOne({ websiteId: input.websiteId, term: input.term });

    if (existing) {
      const updates: UpdateKeywordInput = {};
      if (input.clusterId !== undefined) updates.clusterId = input.clusterId;
      if (input.searchIntent !== undefined) updates.searchIntent = input.searchIntent;
      if (input.searchVolume !== undefined) updates.searchVolume = input.searchVolume;
      if (input.difficulty !== undefined) updates.difficulty = input.difficulty;
      if (input.cpc !== undefined) updates.cpc = input.cpc;
      if (input.currentPosition !== undefined) updates.currentPosition = input.currentPosition;
      if (input.status !== undefined) updates.status = input.status;

      const updated = await this.updateKeyword(existing.id, updates);
      return updated!;
    }

    return this.createKeyword(input);
  }

  async deleteKeyword(id: string): Promise<boolean> {
    const coll = await this.getKeywordColl();
    const res = await coll.deleteOne({ id });
    return (res.deletedCount ?? 0) > 0;
  }

  async countKeywords(filter?: { websiteId?: string }): Promise<number> {
    const coll = await this.getKeywordColl();
    const query: Record<string, unknown> = {};
    if (filter?.websiteId) query.websiteId = filter.websiteId;
    return coll.countDocuments(query);
  }
}
