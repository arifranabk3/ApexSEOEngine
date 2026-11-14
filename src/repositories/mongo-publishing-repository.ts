import { Collection, Document } from "mongodb";
import { getMongoDb } from "@/lib/mongodb";
import { randomUUID } from "crypto";
import {
  CreateInternalLinkInput,
  CreatePublishingJobInput,
  InternalLinkEntity,
  InternalLinkEntitySchema,
  IPublishingRepository,
  PublishingJobEntity,
  PublishingJobEntitySchema,
  UpdateInternalLinkInput,
  UpdatePublishingJobInput
} from "./publishing-repository.types";

interface MongoInternalLinkDoc extends Document {
  id: string;
  websiteId: string;
  sourceArticleId: string;
  targetArticleId: string;
  anchorText: string;
  targetUrl: string;
  status: string;
  relevanceScore: number;
  createdAt: Date;
  updatedAt: Date;
}

interface MongoPublishingJobDoc extends Document {
  id: string;
  websiteId: string;
  articleId: string;
  cmsType: string;
  status: string;
  scheduledFor: Date;
  startedAt?: Date | null;
  completedAt?: Date | null;
  attempts: number;
  maxAttempts: number;
  remotePostId?: string | null;
  publishedUrl?: string | null;
  errorMessage?: string | null;
  responseLog: Record<string, unknown> | unknown;
  lockedBy?: string | null;
  lockedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoPublishingRepository implements IPublishingRepository {
  private async getLinkColl(): Promise<Collection<MongoInternalLinkDoc>> {
    const db = await getMongoDb();
    return db.collection<MongoInternalLinkDoc>("internal_links");
  }

  private async getJobColl(): Promise<Collection<MongoPublishingJobDoc>> {
    const db = await getMongoDb();
    return db.collection<MongoPublishingJobDoc>("publishing_jobs");
  }

  async initIndexes(): Promise<void> {
    const linkColl = await this.getLinkColl();
    const jobColl = await this.getJobColl();

    await Promise.all([
      // InternalLink Indexes
      linkColl.createIndex({ id: 1 }, { unique: true, name: "uniq_internal_link_id" }),
      linkColl.createIndex(
        { websiteId: 1, sourceArticleId: 1, targetArticleId: 1, anchorText: 1 },
        { unique: true, name: "uniq_internal_link_tuple" }
      ),
      linkColl.createIndex({ websiteId: 1, status: 1 }, { name: "idx_internal_link_website_status" }),
      linkColl.createIndex({ sourceArticleId: 1 }, { name: "idx_internal_link_source" }),
      linkColl.createIndex({ targetArticleId: 1 }, { name: "idx_internal_link_target" }),

      // PublishingJob Indexes
      jobColl.createIndex({ id: 1 }, { unique: true, name: "uniq_publishing_job_id" }),
      jobColl.createIndex({ websiteId: 1, status: 1 }, { name: "idx_publishing_job_website_status" }),
      jobColl.createIndex({ articleId: 1 }, { name: "idx_publishing_job_article" }),
      jobColl.createIndex({ status: 1, scheduledFor: 1 }, { name: "idx_publishing_job_queue" })
    ]);
  }

  // --- Mappers ---
  private mapInternalLink(doc: MongoInternalLinkDoc): InternalLinkEntity {
    return InternalLinkEntitySchema.parse({
      id: doc.id,
      websiteId: doc.websiteId,
      sourceArticleId: doc.sourceArticleId,
      targetArticleId: doc.targetArticleId,
      anchorText: doc.anchorText,
      targetUrl: doc.targetUrl,
      status: doc.status || "SUGGESTED",
      relevanceScore: doc.relevanceScore ?? 0.8,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    });
  }

  private mapPublishingJob(doc: MongoPublishingJobDoc): PublishingJobEntity {
    return PublishingJobEntitySchema.parse({
      id: doc.id,
      websiteId: doc.websiteId,
      articleId: doc.articleId,
      cmsType: doc.cmsType,
      status: doc.status || "QUEUED",
      scheduledFor: doc.scheduledFor,
      startedAt: doc.startedAt ?? null,
      completedAt: doc.completedAt ?? null,
      attempts: doc.attempts ?? 0,
      maxAttempts: doc.maxAttempts ?? 3,
      remotePostId: doc.remotePostId ?? null,
      publishedUrl: doc.publishedUrl ?? null,
      errorMessage: doc.errorMessage ?? null,
      responseLog: doc.responseLog ?? {},
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    });
  }

  // ============================================================================
  // InternalLink Methods
  // ============================================================================

  async createInternalLink(input: CreateInternalLinkInput): Promise<InternalLinkEntity> {
    const coll = await this.getLinkColl();
    const id = input.id || randomUUID();
    const now = new Date();

    const doc: MongoInternalLinkDoc = {
      id,
      websiteId: input.websiteId,
      sourceArticleId: input.sourceArticleId,
      targetArticleId: input.targetArticleId,
      anchorText: input.anchorText,
      targetUrl: input.targetUrl,
      status: input.status || "SUGGESTED",
      relevanceScore: input.relevanceScore ?? 0.8,
      createdAt: now,
      updatedAt: now
    };

    await coll.insertOne(doc);
    return this.mapInternalLink(doc);
  }

  async findInternalLinkById(id: string): Promise<InternalLinkEntity | null> {
    const coll = await this.getLinkColl();
    const doc = await coll.findOne({ id });
    return doc ? this.mapInternalLink(doc) : null;
  }

  async findInternalLinksByWebsite(
    websiteId: string,
    filter?: { status?: string; limit?: number; offset?: number }
  ): Promise<InternalLinkEntity[]> {
    const coll = await this.getLinkColl();
    const query: Record<string, unknown> = { websiteId };
    if (filter?.status) query.status = filter.status;

    let cursor = coll.find(query).sort({ createdAt: -1 });
    if (filter?.offset) cursor = cursor.skip(filter.offset);
    if (filter?.limit) cursor = cursor.limit(filter.limit);

    const docs = await cursor.toArray();
    return docs.map((d) => this.mapInternalLink(d));
  }

  async findInternalLinksBySourceArticle(sourceArticleId: string): Promise<InternalLinkEntity[]> {
    const coll = await this.getLinkColl();
    const docs = await coll.find({ sourceArticleId }).sort({ createdAt: -1 }).toArray();
    return docs.map((d) => this.mapInternalLink(d));
  }

  async findInternalLinksByTargetArticle(targetArticleId: string): Promise<InternalLinkEntity[]> {
    const coll = await this.getLinkColl();
    const docs = await coll.find({ targetArticleId }).sort({ createdAt: -1 }).toArray();
    return docs.map((d) => this.mapInternalLink(d));
  }

  async updateInternalLink(id: string, updates: UpdateInternalLinkInput): Promise<InternalLinkEntity | null> {
    const coll = await this.getLinkColl();
    const now = new Date();

    const setFields: Record<string, unknown> = { updatedAt: now };
    if (updates.anchorText !== undefined) setFields.anchorText = updates.anchorText;
    if (updates.targetUrl !== undefined) setFields.targetUrl = updates.targetUrl;
    if (updates.status !== undefined) setFields.status = updates.status;
    if (updates.relevanceScore !== undefined) setFields.relevanceScore = updates.relevanceScore;

    const res = await coll.findOneAndUpdate(
      { id },
      { $set: setFields },
      { returnDocument: "after" }
    );
    return res ? this.mapInternalLink(res) : null;
  }

  async upsertInternalLink(input: CreateInternalLinkInput): Promise<InternalLinkEntity> {
    const coll = await this.getLinkColl();
    const existing = await coll.findOne({
      websiteId: input.websiteId,
      sourceArticleId: input.sourceArticleId,
      targetArticleId: input.targetArticleId,
      anchorText: input.anchorText
    });

    if (existing) {
      const updated = await this.updateInternalLink(existing.id, {
        targetUrl: input.targetUrl,
        status: input.status,
        relevanceScore: input.relevanceScore
      });
      return updated!;
    }
    return this.createInternalLink(input);
  }

  async deleteInternalLink(id: string): Promise<boolean> {
    const coll = await this.getLinkColl();
    const res = await coll.deleteOne({ id });
    return (res.deletedCount ?? 0) > 0;
  }

  async deleteInternalLinksByArticle(articleId: string): Promise<number> {
    const coll = await this.getLinkColl();
    const res = await coll.deleteMany({
      $or: [{ sourceArticleId: articleId }, { targetArticleId: articleId }]
    });
    return res.deletedCount ?? 0;
  }

  async countInternalLinks(filter?: { websiteId?: string; status?: string }): Promise<number> {
    const coll = await this.getLinkColl();
    const query: Record<string, unknown> = {};
    if (filter?.websiteId) query.websiteId = filter.websiteId;
    if (filter?.status) query.status = filter.status;
    return coll.countDocuments(query);
  }

  // ============================================================================
  // PublishingJob Methods
  // ============================================================================

  async createPublishingJob(input: CreatePublishingJobInput): Promise<PublishingJobEntity> {
    const coll = await this.getJobColl();
    const id = input.id || randomUUID();
    const now = new Date();

    const scheduledFor = input.scheduledFor ? new Date(input.scheduledFor) : now;
    const startedAt = input.startedAt ? new Date(input.startedAt) : null;
    const completedAt = input.completedAt ? new Date(input.completedAt) : null;

    const doc: MongoPublishingJobDoc = {
      id,
      websiteId: input.websiteId,
      articleId: input.articleId,
      cmsType: input.cmsType,
      status: input.status || "QUEUED",
      scheduledFor,
      startedAt,
      completedAt,
      attempts: input.attempts ?? 0,
      maxAttempts: input.maxAttempts ?? 3,
      remotePostId: input.remotePostId ?? null,
      publishedUrl: input.publishedUrl ?? null,
      errorMessage: input.errorMessage ?? null,
      responseLog: input.responseLog ?? {},
      createdAt: now,
      updatedAt: now
    };

    await coll.insertOne(doc);
    return this.mapPublishingJob(doc);
  }

  async findPublishingJobById(id: string): Promise<PublishingJobEntity | null> {
    const coll = await this.getJobColl();
    const doc = await coll.findOne({ id });
    return doc ? this.mapPublishingJob(doc) : null;
  }

  async findPublishingJobsByWebsite(
    websiteId: string,
    filter?: { status?: string; limit?: number; offset?: number }
  ): Promise<PublishingJobEntity[]> {
    const coll = await this.getJobColl();
    const query: Record<string, unknown> = { websiteId };
    if (filter?.status) query.status = filter.status;

    let cursor = coll.find(query).sort({ scheduledFor: -1 });
    if (filter?.offset) cursor = cursor.skip(filter.offset);
    if (filter?.limit) cursor = cursor.limit(filter.limit);

    const docs = await cursor.toArray();
    return docs.map((d) => this.mapPublishingJob(d));
  }

  async findPublishingJobsByArticle(articleId: string): Promise<PublishingJobEntity[]> {
    const coll = await this.getJobColl();
    const docs = await coll.find({ articleId }).sort({ scheduledFor: -1 }).toArray();
    return docs.map((d) => this.mapPublishingJob(d));
  }

  async updatePublishingJob(id: string, updates: UpdatePublishingJobInput): Promise<PublishingJobEntity | null> {
    const coll = await this.getJobColl();
    const now = new Date();

    const setFields: Record<string, unknown> = { updatedAt: now };
    if (updates.status !== undefined) setFields.status = updates.status;
    if (updates.scheduledFor !== undefined) {
      setFields.scheduledFor = updates.scheduledFor ? new Date(updates.scheduledFor) : now;
    }
    if (updates.startedAt !== undefined) {
      setFields.startedAt = updates.startedAt ? new Date(updates.startedAt) : null;
    }
    if (updates.completedAt !== undefined) {
      setFields.completedAt = updates.completedAt ? new Date(updates.completedAt) : null;
    }
    if (updates.attempts !== undefined) setFields.attempts = updates.attempts;
    if (updates.remotePostId !== undefined) setFields.remotePostId = updates.remotePostId;
    if (updates.publishedUrl !== undefined) setFields.publishedUrl = updates.publishedUrl;
    if (updates.errorMessage !== undefined) setFields.errorMessage = updates.errorMessage;
    if (updates.responseLog !== undefined) setFields.responseLog = updates.responseLog;

    const res = await coll.findOneAndUpdate(
      { id },
      { $set: setFields },
      { returnDocument: "after" }
    );
    return res ? this.mapPublishingJob(res) : null;
  }

  async upsertPublishingJob(input: CreatePublishingJobInput): Promise<PublishingJobEntity> {
    const coll = await this.getJobColl();
    const existing = input.id ? await coll.findOne({ id: input.id }) : null;
    if (existing) {
      const updated = await this.updatePublishingJob(existing.id, {
        status: input.status,
        scheduledFor: input.scheduledFor,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        attempts: input.attempts,
        remotePostId: input.remotePostId,
        publishedUrl: input.publishedUrl,
        errorMessage: input.errorMessage,
        responseLog: input.responseLog
      });
      return updated!;
    }
    return this.createPublishingJob(input);
  }

  async deletePublishingJob(id: string): Promise<boolean> {
    const coll = await this.getJobColl();
    const res = await coll.deleteOne({ id });
    return (res.deletedCount ?? 0) > 0;
  }

  async countPublishingJobs(filter?: { websiteId?: string; status?: string }): Promise<number> {
    const coll = await this.getJobColl();
    const query: Record<string, unknown> = {};
    if (filter?.websiteId) query.websiteId = filter.websiteId;
    if (filter?.status) query.status = filter.status;
    return coll.countDocuments(query);
  }

  // ============================================================================
  // Worker Claim & State Transitions (Atomic)
  // ============================================================================

  async claimNextDueJob(workerId: string): Promise<PublishingJobEntity | null> {
    const coll = await this.getJobColl();
    const now = new Date();

    const res = await coll.findOneAndUpdate(
      {
        status: "QUEUED",
        scheduledFor: { $lte: now }
      },
      {
        $set: {
          status: "PROCESSING",
          startedAt: now,
          lockedBy: workerId,
          lockedAt: now,
          updatedAt: now
        },
        $inc: { attempts: 1 }
      },
      {
        sort: { scheduledFor: 1 },
        returnDocument: "after"
      }
    );

    return res ? this.mapPublishingJob(res) : null;
  }

  async completeJob(
    id: string,
    result: { remotePostId?: string | null; publishedUrl?: string | null; responseLog?: unknown }
  ): Promise<PublishingJobEntity | null> {
    const coll = await this.getJobColl();
    const now = new Date();

    const res = await coll.findOneAndUpdate(
      { id, status: "PROCESSING" },
      {
        $set: {
          status: "COMPLETED",
          completedAt: now,
          remotePostId: result.remotePostId ?? null,
          publishedUrl: result.publishedUrl ?? null,
          responseLog: result.responseLog ?? {},
          lockedBy: null,
          lockedAt: null,
          updatedAt: now
        }
      },
      { returnDocument: "after" }
    );

    return res ? this.mapPublishingJob(res) : null;
  }

  async failJob(
    id: string,
    error: { errorMessage: string; retryInMs?: number; responseLog?: unknown }
  ): Promise<PublishingJobEntity | null> {
    const coll = await this.getJobColl();
    const now = new Date();

    const current = await coll.findOne({ id });
    if (!current) return null;

    const willRetry = current.attempts < current.maxAttempts && Boolean(error.retryInMs);
    const nextStatus = willRetry ? "QUEUED" : "FAILED";
    const nextScheduledFor = willRetry
      ? new Date(now.getTime() + (error.retryInMs || 60000))
      : current.scheduledFor;

    const res = await coll.findOneAndUpdate(
      { id },
      {
        $set: {
          status: nextStatus,
          scheduledFor: nextScheduledFor,
          errorMessage: error.errorMessage,
          responseLog: error.responseLog ?? current.responseLog ?? {},
          lockedBy: null,
          lockedAt: null,
          updatedAt: now
        }
      },
      { returnDocument: "after" }
    );

    return res ? this.mapPublishingJob(res) : null;
  }
}
