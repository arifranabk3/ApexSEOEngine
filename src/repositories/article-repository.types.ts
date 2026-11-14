import { z } from "zod";

// --- Article Image ---
export const ArticleImageEntitySchema = z.object({
  id: z.string(),
  articleId: z.string(),
  url: z.string(),
  altText: z.string(),
  caption: z.string().nullable().optional(),
  prompt: z.string().nullable().optional(),
  provider: z.string().default("LOCAL_GENERATOR"),
  isFeatured: z.boolean().default(false),
  width: z.number().int().default(1200),
  height: z.number().int().default(630),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});
export type ArticleImageEntity = z.infer<typeof ArticleImageEntitySchema>;

export interface CreateArticleImageInput {
  id?: string;
  articleId: string;
  url: string;
  altText: string;
  caption?: string | null;
  prompt?: string | null;
  provider?: string;
  isFeatured?: boolean;
  width?: number;
  height?: number;
}

// --- Article Version ---
export const ArticleVersionEntitySchema = z.object({
  id: z.string(),
  articleId: z.string(),
  versionNumber: z.number().int(),
  title: z.string(),
  content: z.string(),
  metaTitle: z.string().nullable().optional(),
  metaDesc: z.string().nullable().optional(),
  changeSummary: z.string().nullable().optional(),
  createdBy: z.string().nullable().optional(),
  createdAt: z.date().or(z.string())
});
export type ArticleVersionEntity = z.infer<typeof ArticleVersionEntitySchema>;

export interface CreateArticleVersionInput {
  id?: string;
  articleId: string;
  versionNumber?: number;
  title: string;
  content: string;
  metaTitle?: string | null;
  metaDesc?: string | null;
  changeSummary?: string | null;
  createdBy?: string | null;
}

// --- Article Entity ---
export const ArticleStatusSchema = z.enum([
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED"
]);
export type ArticleStatus = z.infer<typeof ArticleStatusSchema>;

export const ArticleEntitySchema = z.object({
  id: z.string(),
  websiteId: z.string(),
  categoryId: z.string().nullable().optional(),
  briefId: z.string().nullable().optional(),
  authorId: z.string().nullable().optional(),
  title: z.string().min(1),
  slug: z.string().min(1),
  excerpt: z.string().nullable().optional(),
  content: z.string(),
  status: z.string().default("DRAFT"),
  focusKeyword: z.string().nullable().optional(),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
  canonicalUrl: z.string().nullable().optional(),
  seoScore: z.number().int().default(0),
  wordCount: z.number().int().default(0),
  externalPostId: z.string().nullable().optional(),
  publishedUrl: z.string().nullable().optional(),
  publishedAt: z.date().or(z.string()).nullable().optional(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});
export type ArticleEntity = z.infer<typeof ArticleEntitySchema>;

export interface CreateArticleInput {
  id?: string;
  websiteId: string;
  categoryId?: string | null;
  briefId?: string | null;
  authorId?: string | null;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  status?: string;
  focusKeyword?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  seoScore?: number;
  wordCount?: number;
  externalPostId?: string | null;
  publishedUrl?: string | null;
  publishedAt?: Date | string | null;
  initialVersion?: {
    title?: string;
    content?: string;
    metaTitle?: string | null;
    metaDesc?: string | null;
    changeSummary?: string | null;
    createdBy?: string | null;
  };
}

export interface UpdateArticleInput {
  categoryId?: string | null;
  briefId?: string | null;
  authorId?: string | null;
  title?: string;
  slug?: string;
  excerpt?: string | null;
  content?: string;
  status?: string;
  focusKeyword?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  seoScore?: number;
  wordCount?: number;
  externalPostId?: string | null;
  publishedUrl?: string | null;
  publishedAt?: Date | string | null;
  newVersion?: {
    title?: string;
    content?: string;
    metaTitle?: string | null;
    metaDesc?: string | null;
    changeSummary?: string | null;
    createdBy?: string | null;
  };
}

export interface IArticleRepository {
  initIndexes(): Promise<void>;

  // Article
  findArticleById(id: string): Promise<ArticleEntity | null>;
  findArticleBySlug(websiteId: string, slug: string): Promise<ArticleEntity | null>;
  findArticlesByWebsite(
    websiteId: string,
    filter?: {
      status?: string;
      categoryId?: string;
      limit?: number;
      offset?: number;
      orderBy?: "createdAt" | "updatedAt" | "publishedAt";
      orderDir?: "asc" | "desc";
    }
  ): Promise<ArticleEntity[]>;
  createArticle(input: CreateArticleInput): Promise<ArticleEntity>;
  updateArticle(id: string, updates: UpdateArticleInput): Promise<ArticleEntity | null>;
  upsertArticle(input: CreateArticleInput): Promise<ArticleEntity>;
  deleteArticle(id: string): Promise<boolean>;
  countArticles(filter?: { websiteId?: string; status?: string }): Promise<number>;

  // Article Version
  createVersion(input: CreateArticleVersionInput): Promise<ArticleVersionEntity>;
  getVersionsByArticle(articleId: string): Promise<ArticleVersionEntity[]>;
  getLatestVersion(articleId: string): Promise<ArticleVersionEntity | null>;

  // Article Image
  addImage(input: CreateArticleImageInput): Promise<ArticleImageEntity>;
  getImagesByArticle(articleId: string): Promise<ArticleImageEntity[]>;
  setFeaturedImage(articleId: string, imageId: string): Promise<boolean>;
  deleteImage(id: string): Promise<boolean>;
}
