import { Collection, Document } from "mongodb";
import { getMongoDb } from "@/lib/mongodb";
import { randomUUID } from "crypto";
import {
  ArticleEntity,
  ArticleEntitySchema,
  ArticleImageEntity,
  ArticleImageEntitySchema,
  ArticleVersionEntity,
  ArticleVersionEntitySchema,
  CreateArticleImageInput,
  CreateArticleInput,
  CreateArticleVersionInput,
  IArticleRepository,
  UpdateArticleInput
} from "./article-repository.types";

interface MongoArticleDoc extends Document {
  id: string;
  websiteId: string;
  categoryId?: string | null;
  briefId?: string | null;
  authorId?: string | null;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  status: string;
  focusKeyword?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  seoScore: number;
  wordCount: number;
  externalPostId?: string | null;
  publishedUrl?: string | null;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MongoArticleVersionDoc extends Document {
  id: string;
  articleId: string;
  versionNumber: number;
  title: string;
  content: string;
  metaTitle?: string | null;
  metaDesc?: string | null;
  changeSummary?: string | null;
  createdBy?: string | null;
  createdAt: Date;
}

interface MongoArticleImageDoc extends Document {
  id: string;
  articleId: string;
  url: string;
  altText: string;
  caption?: string | null;
  prompt?: string | null;
  provider: string;
  isFeatured: boolean;
  width: number;
  height: number;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoArticleRepository implements IArticleRepository {
  private async getArticleColl(): Promise<Collection<MongoArticleDoc>> {
    const db = await getMongoDb();
    return db.collection<MongoArticleDoc>("articles");
  }

  private async getVersionColl(): Promise<Collection<MongoArticleVersionDoc>> {
    const db = await getMongoDb();
    return db.collection<MongoArticleVersionDoc>("article_versions");
  }

  private async getImageColl(): Promise<Collection<MongoArticleImageDoc>> {
    const db = await getMongoDb();
    return db.collection<MongoArticleImageDoc>("article_images");
  }

  async initIndexes(): Promise<void> {
    const artColl = await this.getArticleColl();
    const verColl = await this.getVersionColl();
    const imgColl = await this.getImageColl();

    await Promise.all([
      // Articles
      artColl.createIndex({ id: 1 }, { unique: true, name: "uniq_article_id" }),
      artColl.createIndex(
        { websiteId: 1, slug: 1 },
        { unique: true, name: "uniq_article_website_slug" }
      ),
      artColl.createIndex({ websiteId: 1, status: 1 }, { name: "idx_article_website_status" }),
      artColl.createIndex({ categoryId: 1 }, { name: "idx_article_categoryId" }),
      artColl.createIndex({ briefId: 1 }, { name: "idx_article_briefId" }),
      artColl.createIndex({ publishedAt: -1 }, { name: "idx_article_publishedAt" }),

      // Versions
      verColl.createIndex({ id: 1 }, { unique: true, name: "uniq_article_version_id" }),
      verColl.createIndex(
        { articleId: 1, versionNumber: 1 },
        { unique: true, name: "uniq_article_version_number" }
      ),
      verColl.createIndex({ articleId: 1 }, { name: "idx_article_version_articleId" }),

      // Images
      imgColl.createIndex({ id: 1 }, { unique: true, name: "uniq_article_image_id" }),
      imgColl.createIndex({ articleId: 1 }, { name: "idx_article_image_articleId" }),
      imgColl.createIndex({ articleId: 1, isFeatured: 1 }, { name: "idx_article_image_isFeatured" })
    ]);
  }

  // --- Article Mapping ---
  private mapArticle(doc: MongoArticleDoc): ArticleEntity {
    return ArticleEntitySchema.parse({
      id: doc.id,
      websiteId: doc.websiteId,
      categoryId: doc.categoryId ?? null,
      briefId: doc.briefId ?? null,
      authorId: doc.authorId ?? null,
      title: doc.title,
      slug: doc.slug,
      excerpt: doc.excerpt ?? null,
      content: doc.content,
      status: doc.status ?? "DRAFT",
      focusKeyword: doc.focusKeyword ?? null,
      metaTitle: doc.metaTitle ?? null,
      metaDescription: doc.metaDescription ?? null,
      canonicalUrl: doc.canonicalUrl ?? null,
      seoScore: doc.seoScore ?? 0,
      wordCount: doc.wordCount ?? 0,
      externalPostId: doc.externalPostId ?? null,
      publishedUrl: doc.publishedUrl ?? null,
      publishedAt: doc.publishedAt ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    });
  }

  private mapVersion(doc: MongoArticleVersionDoc): ArticleVersionEntity {
    return ArticleVersionEntitySchema.parse({
      id: doc.id,
      articleId: doc.articleId,
      versionNumber: doc.versionNumber,
      title: doc.title,
      content: doc.content,
      metaTitle: doc.metaTitle ?? null,
      metaDesc: doc.metaDesc ?? null,
      changeSummary: doc.changeSummary ?? null,
      createdBy: doc.createdBy ?? null,
      createdAt: doc.createdAt
    });
  }

  private mapImage(doc: MongoArticleImageDoc): ArticleImageEntity {
    return ArticleImageEntitySchema.parse({
      id: doc.id,
      articleId: doc.articleId,
      url: doc.url,
      altText: doc.altText,
      caption: doc.caption ?? null,
      prompt: doc.prompt ?? null,
      provider: doc.provider ?? "LOCAL_GENERATOR",
      isFeatured: doc.isFeatured ?? false,
      width: doc.width ?? 1200,
      height: doc.height ?? 630,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    });
  }

  // --- Article Methods ---
  async findArticleById(id: string): Promise<ArticleEntity | null> {
    const coll = await this.getArticleColl();
    const doc = await coll.findOne({ id });
    return doc ? this.mapArticle(doc) : null;
  }

  async findArticleBySlug(websiteId: string, slug: string): Promise<ArticleEntity | null> {
    const coll = await this.getArticleColl();
    const doc = await coll.findOne({ websiteId, slug });
    return doc ? this.mapArticle(doc) : null;
  }

  async findArticlesByWebsite(
    websiteId: string,
    filter?: {
      status?: string;
      categoryId?: string;
      limit?: number;
      offset?: number;
      orderBy?: "createdAt" | "updatedAt" | "publishedAt";
      orderDir?: "asc" | "desc";
    }
  ): Promise<ArticleEntity[]> {
    const coll = await this.getArticleColl();
    const query: Record<string, unknown> = { websiteId };
    if (filter?.status) query.status = filter.status;
    if (filter?.categoryId) query.categoryId = filter.categoryId;

    const sortField = filter?.orderBy || "createdAt";
    const sortDir = filter?.orderDir === "asc" ? 1 : -1;

    let cursor = coll.find(query).sort({ [sortField]: sortDir });
    if (filter?.offset) cursor = cursor.skip(filter.offset);
    if (filter?.limit) cursor = cursor.limit(filter.limit);

    const docs = await cursor.toArray();
    return docs.map((d) => this.mapArticle(d));
  }

  async createArticle(input: CreateArticleInput): Promise<ArticleEntity> {
    const coll = await this.getArticleColl();
    const now = new Date();
    const id = input.id || randomUUID();

    const publishedAt = input.publishedAt ? new Date(input.publishedAt) : null;

    const doc: MongoArticleDoc = {
      id,
      websiteId: input.websiteId,
      categoryId: input.categoryId ?? null,
      briefId: input.briefId ?? null,
      authorId: input.authorId ?? null,
      title: input.title,
      slug: input.slug,
      excerpt: input.excerpt ?? null,
      content: input.content,
      status: input.status || "DRAFT",
      focusKeyword: input.focusKeyword ?? null,
      metaTitle: input.metaTitle ?? null,
      metaDescription: input.metaDescription ?? null,
      canonicalUrl: input.canonicalUrl ?? null,
      seoScore: input.seoScore ?? 0,
      wordCount: input.wordCount ?? (input.content ? input.content.split(/\s+/).filter(Boolean).length : 0),
      externalPostId: input.externalPostId ?? null,
      publishedUrl: input.publishedUrl ?? null,
      publishedAt,
      createdAt: now,
      updatedAt: now
    };

    await coll.insertOne(doc);

    // Initial version
    const versionData = input.initialVersion || {
      title: input.title,
      content: input.content,
      metaTitle: input.metaTitle,
      metaDesc: input.metaDescription,
      changeSummary: "Initial version",
      createdBy: input.authorId || null
    };

    await this.createVersion({
      articleId: id,
      versionNumber: 1,
      title: versionData.title || input.title,
      content: versionData.content || input.content,
      metaTitle: versionData.metaTitle ?? input.metaTitle ?? null,
      metaDesc: versionData.metaDesc ?? input.metaDescription ?? null,
      changeSummary: versionData.changeSummary || "Initial version",
      createdBy: versionData.createdBy ?? null
    });

    return this.mapArticle(doc);
  }

  async updateArticle(id: string, updates: UpdateArticleInput): Promise<ArticleEntity | null> {
    const coll = await this.getArticleColl();
    const now = new Date();

    const setFields: Record<string, unknown> = { updatedAt: now };
    if (updates.categoryId !== undefined) setFields.categoryId = updates.categoryId;
    if (updates.briefId !== undefined) setFields.briefId = updates.briefId;
    if (updates.authorId !== undefined) setFields.authorId = updates.authorId;
    if (updates.title !== undefined) setFields.title = updates.title;
    if (updates.slug !== undefined) setFields.slug = updates.slug;
    if (updates.excerpt !== undefined) setFields.excerpt = updates.excerpt;
    if (updates.content !== undefined) {
      setFields.content = updates.content;
      if (updates.wordCount === undefined) {
        setFields.wordCount = updates.content.split(/\s+/).filter(Boolean).length;
      }
    }
    if (updates.status !== undefined) setFields.status = updates.status;
    if (updates.focusKeyword !== undefined) setFields.focusKeyword = updates.focusKeyword;
    if (updates.metaTitle !== undefined) setFields.metaTitle = updates.metaTitle;
    if (updates.metaDescription !== undefined) setFields.metaDescription = updates.metaDescription;
    if (updates.canonicalUrl !== undefined) setFields.canonicalUrl = updates.canonicalUrl;
    if (updates.seoScore !== undefined) setFields.seoScore = updates.seoScore;
    if (updates.wordCount !== undefined) setFields.wordCount = updates.wordCount;
    if (updates.externalPostId !== undefined) setFields.externalPostId = updates.externalPostId;
    if (updates.publishedUrl !== undefined) setFields.publishedUrl = updates.publishedUrl;
    if (updates.publishedAt !== undefined) {
      setFields.publishedAt = updates.publishedAt ? new Date(updates.publishedAt) : null;
    }

    const res = await coll.findOneAndUpdate(
      { id },
      { $set: setFields },
      { returnDocument: "after" }
    );
    if (!res) return null;

    if (updates.newVersion) {
      const latest = await this.getLatestVersion(id);
      const nextVersionNumber = (latest?.versionNumber || 0) + 1;
      await this.createVersion({
        articleId: id,
        versionNumber: nextVersionNumber,
        title: updates.newVersion.title || res.title,
        content: updates.newVersion.content || res.content,
        metaTitle: updates.newVersion.metaTitle ?? res.metaTitle,
        metaDesc: updates.newVersion.metaDesc ?? res.metaDescription,
        changeSummary: updates.newVersion.changeSummary || `Version ${nextVersionNumber}`,
        createdBy: updates.newVersion.createdBy || null
      });
    }

    return this.mapArticle(res);
  }

  async upsertArticle(input: CreateArticleInput): Promise<ArticleEntity> {
    const coll = await this.getArticleColl();
    const existing = await coll.findOne({ websiteId: input.websiteId, slug: input.slug });
    if (existing) {
      const updated = await this.updateArticle(existing.id, {
        title: input.title,
        content: input.content,
        excerpt: input.excerpt,
        status: input.status,
        focusKeyword: input.focusKeyword,
        metaTitle: input.metaTitle,
        metaDescription: input.metaDescription,
        seoScore: input.seoScore,
        wordCount: input.wordCount,
        publishedAt: input.publishedAt
      });
      return updated!;
    }
    return this.createArticle(input);
  }

  async deleteArticle(id: string): Promise<boolean> {
    const artColl = await this.getArticleColl();
    const verColl = await this.getVersionColl();
    const imgColl = await this.getImageColl();

    const res = await artColl.deleteOne({ id });
    if ((res.deletedCount ?? 0) > 0) {
      await Promise.all([
        verColl.deleteMany({ articleId: id }),
        imgColl.deleteMany({ articleId: id })
      ]);
      return true;
    }
    return false;
  }

  async countArticles(filter?: { websiteId?: string; status?: string }): Promise<number> {
    const coll = await this.getArticleColl();
    const query: Record<string, unknown> = {};
    if (filter?.websiteId) query.websiteId = filter.websiteId;
    if (filter?.status) query.status = filter.status;
    return coll.countDocuments(query);
  }

  // --- Article Version Methods ---
  async createVersion(input: CreateArticleVersionInput): Promise<ArticleVersionEntity> {
    const coll = await this.getVersionColl();
    const id = input.id || randomUUID();
    const now = new Date();

    let versionNumber = input.versionNumber;
    if (!versionNumber) {
      const latest = await this.getLatestVersion(input.articleId);
      versionNumber = (latest?.versionNumber || 0) + 1;
    }

    const doc: MongoArticleVersionDoc = {
      id,
      articleId: input.articleId,
      versionNumber,
      title: input.title,
      content: input.content,
      metaTitle: input.metaTitle ?? null,
      metaDesc: input.metaDesc ?? null,
      changeSummary: input.changeSummary ?? null,
      createdBy: input.createdBy ?? null,
      createdAt: now
    };

    await coll.insertOne(doc);
    return this.mapVersion(doc);
  }

  async getVersionsByArticle(articleId: string): Promise<ArticleVersionEntity[]> {
    const coll = await this.getVersionColl();
    const docs = await coll.find({ articleId }).sort({ versionNumber: -1 }).toArray();
    return docs.map((d) => this.mapVersion(d));
  }

  async getLatestVersion(articleId: string): Promise<ArticleVersionEntity | null> {
    const coll = await this.getVersionColl();
    const doc = await coll.findOne({ articleId }, { sort: { versionNumber: -1 } });
    return doc ? this.mapVersion(doc) : null;
  }

  // --- Article Image Methods ---
  async addImage(input: CreateArticleImageInput): Promise<ArticleImageEntity> {
    const coll = await this.getImageColl();
    const id = input.id || randomUUID();
    const now = new Date();

    if (input.isFeatured) {
      await coll.updateMany(
        { articleId: input.articleId },
        { $set: { isFeatured: false, updatedAt: now } }
      );
    }

    const doc: MongoArticleImageDoc = {
      id,
      articleId: input.articleId,
      url: input.url,
      altText: input.altText,
      caption: input.caption ?? null,
      prompt: input.prompt ?? null,
      provider: input.provider || "LOCAL_GENERATOR",
      isFeatured: Boolean(input.isFeatured),
      width: input.width || 1200,
      height: input.height || 630,
      createdAt: now,
      updatedAt: now
    };

    await coll.insertOne(doc);
    return this.mapImage(doc);
  }

  async getImagesByArticle(articleId: string): Promise<ArticleImageEntity[]> {
    const coll = await this.getImageColl();
    const docs = await coll.find({ articleId }).sort({ isFeatured: -1, createdAt: 1 }).toArray();
    return docs.map((d) => this.mapImage(d));
  }

  async setFeaturedImage(articleId: string, imageId: string): Promise<boolean> {
    const coll = await this.getImageColl();
    const now = new Date();
    await coll.updateMany({ articleId }, { $set: { isFeatured: false, updatedAt: now } });
    const res = await coll.updateOne(
      { id: imageId, articleId },
      { $set: { isFeatured: true, updatedAt: now } }
    );
    return (res.modifiedCount ?? 0) > 0;
  }

  async deleteImage(id: string): Promise<boolean> {
    const coll = await this.getImageColl();
    const res = await coll.deleteOne({ id });
    return (res.deletedCount ?? 0) > 0;
  }
}
