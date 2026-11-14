import { Collection, Document } from "mongodb";
import { getMongoDb } from "@/lib/mongodb";
import { randomUUID } from "crypto";
import {
  ContentBriefEntity,
  ContentBriefEntitySchema,
  CreateContentBriefInput,
  IContentBriefRepository,
  UpdateContentBriefInput
} from "./content-brief-repository.types";

interface MongoContentBriefDoc extends Document {
  id: string;
  websiteId: string;
  keywordId?: string | null;
  clusterId?: string | null;
  title: string;
  targetWordCount: number;
  searchIntent: string;
  outline: unknown;
  secondaryKeywords: unknown;
  competitorNotes?: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoContentBriefRepository implements IContentBriefRepository {
  private async getColl(): Promise<Collection<MongoContentBriefDoc>> {
    const db = await getMongoDb();
    return db.collection<MongoContentBriefDoc>("content_briefs");
  }

  async initIndexes(): Promise<void> {
    const coll = await this.getColl();
    await Promise.all([
      coll.createIndex({ id: 1 }, { unique: true, name: "uniq_content_brief_id" }),
      coll.createIndex({ websiteId: 1 }, { name: "idx_content_brief_websiteId" }),
      coll.createIndex({ keywordId: 1 }, { name: "idx_content_brief_keywordId" }),
      coll.createIndex({ clusterId: 1 }, { name: "idx_content_brief_clusterId" }),
      coll.createIndex({ status: 1 }, { name: "idx_content_brief_status" }),
      coll.createIndex({ createdAt: -1 }, { name: "idx_content_brief_createdAt" })
    ]);
  }

  private mapDoc(doc: MongoContentBriefDoc): ContentBriefEntity {
    return ContentBriefEntitySchema.parse({
      id: doc.id,
      websiteId: doc.websiteId,
      keywordId: doc.keywordId ?? null,
      clusterId: doc.clusterId ?? null,
      title: doc.title,
      targetWordCount: doc.targetWordCount ?? 1500,
      searchIntent: doc.searchIntent ?? "INFORMATIONAL",
      outline: doc.outline ?? [],
      secondaryKeywords: doc.secondaryKeywords ?? [],
      competitorNotes: doc.competitorNotes ?? null,
      status: doc.status ?? "DRAFT",
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    });
  }

  async findById(id: string): Promise<ContentBriefEntity | null> {
    const coll = await this.getColl();
    const doc = await coll.findOne({ id });
    return doc ? this.mapDoc(doc) : null;
  }

  async findByWebsite(
    websiteId: string,
    filter?: { status?: string; limit?: number; offset?: number }
  ): Promise<ContentBriefEntity[]> {
    const coll = await this.getColl();
    const query: Record<string, unknown> = { websiteId };
    if (filter?.status) query.status = filter.status;

    let cursor = coll.find(query).sort({ createdAt: -1 });
    if (filter?.offset) cursor = cursor.skip(filter.offset);
    if (filter?.limit) cursor = cursor.limit(filter.limit);

    const docs = await cursor.toArray();
    return docs.map((d) => this.mapDoc(d));
  }

  async createBrief(input: CreateContentBriefInput): Promise<ContentBriefEntity> {
    const coll = await this.getColl();
    const now = new Date();
    const id = input.id || randomUUID();

    const doc: MongoContentBriefDoc = {
      id,
      websiteId: input.websiteId,
      keywordId: input.keywordId ?? null,
      clusterId: input.clusterId ?? null,
      title: input.title,
      targetWordCount: input.targetWordCount ?? 1500,
      searchIntent: input.searchIntent || "INFORMATIONAL",
      outline: input.outline ?? [],
      secondaryKeywords: input.secondaryKeywords ?? [],
      competitorNotes: input.competitorNotes ?? null,
      status: input.status || "DRAFT",
      createdAt: now,
      updatedAt: now
    };

    await coll.insertOne(doc);
    return this.mapDoc(doc);
  }

  async updateBrief(
    id: string,
    updates: UpdateContentBriefInput
  ): Promise<ContentBriefEntity | null> {
    const coll = await this.getColl();
    const now = new Date();

    const setFields: Record<string, unknown> = { updatedAt: now };
    if (updates.keywordId !== undefined) setFields.keywordId = updates.keywordId;
    if (updates.clusterId !== undefined) setFields.clusterId = updates.clusterId;
    if (updates.title !== undefined) setFields.title = updates.title;
    if (updates.targetWordCount !== undefined) setFields.targetWordCount = updates.targetWordCount;
    if (updates.searchIntent !== undefined) setFields.searchIntent = updates.searchIntent;
    if (updates.outline !== undefined) setFields.outline = updates.outline;
    if (updates.secondaryKeywords !== undefined) {
      setFields.secondaryKeywords = updates.secondaryKeywords;
    }
    if (updates.competitorNotes !== undefined) {
      setFields.competitorNotes = updates.competitorNotes;
    }
    if (updates.status !== undefined) setFields.status = updates.status;

    const res = await coll.findOneAndUpdate(
      { id },
      { $set: setFields },
      { returnDocument: "after" }
    );

    return res ? this.mapDoc(res) : null;
  }

  async upsertBrief(input: CreateContentBriefInput): Promise<ContentBriefEntity> {
    const coll = await this.getColl();
    if (input.id) {
      const existing = await coll.findOne({ id: input.id });
      if (existing) {
        return this.mapDoc(existing);
      }
    }

    const existingByTitle = await coll.findOne({
      websiteId: input.websiteId,
      title: input.title
    });
    if (existingByTitle) {
      return this.mapDoc(existingByTitle);
    }

    return this.createBrief(input);
  }

  async deleteBrief(id: string): Promise<boolean> {
    const coll = await this.getColl();
    const res = await coll.deleteOne({ id });
    return (res.deletedCount ?? 0) > 0;
  }

  async countBriefs(filter?: { websiteId?: string; status?: string }): Promise<number> {
    const coll = await this.getColl();
    const query: Record<string, unknown> = {};
    if (filter?.websiteId) query.websiteId = filter.websiteId;
    if (filter?.status) query.status = filter.status;
    return coll.countDocuments(query);
  }
}
