import { z } from "zod";

// --- Category ---
export const CategoryEntitySchema = z.object({
  id: z.string(),
  websiteId: z.string(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});
export type CategoryEntity = z.infer<typeof CategoryEntitySchema>;

export interface CreateCategoryInput {
  id?: string;
  websiteId: string;
  name: string;
  slug: string;
  description?: string | null;
  parentId?: string | null;
}

export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  description?: string | null;
  parentId?: string | null;
}

// --- KeywordCluster ---
export const KeywordClusterEntitySchema = z.object({
  id: z.string(),
  websiteId: z.string(),
  name: z.string().min(1),
  pillarKeyword: z.string().min(1),
  intent: z.string().default("INFORMATIONAL"),
  status: z.string().default("PLANNED"),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});
export type KeywordClusterEntity = z.infer<typeof KeywordClusterEntitySchema>;

export interface CreateKeywordClusterInput {
  id?: string;
  websiteId: string;
  name: string;
  pillarKeyword: string;
  intent?: string;
  status?: string;
}

export interface UpdateKeywordClusterInput {
  name?: string;
  pillarKeyword?: string;
  intent?: string;
  status?: string;
}

// --- Keyword ---
export const KeywordEntitySchema = z.object({
  id: z.string(),
  websiteId: z.string(),
  clusterId: z.string().nullable().optional(),
  term: z.string().min(1),
  searchIntent: z.string().default("INFORMATIONAL"),
  searchVolume: z.number().int().default(0),
  difficulty: z.number().default(0),
  cpc: z.number().default(0),
  currentPosition: z.number().nullable().optional(),
  status: z.string().default("TRACKED"),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});
export type KeywordEntity = z.infer<typeof KeywordEntitySchema>;

export interface CreateKeywordInput {
  id?: string;
  websiteId: string;
  clusterId?: string | null;
  term: string;
  searchIntent?: string;
  searchVolume?: number;
  difficulty?: number;
  cpc?: number;
  currentPosition?: number | null;
  status?: string;
}

export interface UpdateKeywordInput {
  clusterId?: string | null;
  searchIntent?: string;
  searchVolume?: number;
  difficulty?: number;
  cpc?: number;
  currentPosition?: number | null;
  status?: string;
}

// --- Main Repository Contract ---
export interface IKeywordDomainRepository {
  initIndexes(): Promise<void>;

  // Category
  findCategoriesByWebsite(websiteId: string): Promise<CategoryEntity[]>;
  findCategoryById(id: string): Promise<CategoryEntity | null>;
  findCategoryBySlug(websiteId: string, slug: string): Promise<CategoryEntity | null>;
  createCategory(input: CreateCategoryInput): Promise<CategoryEntity>;
  updateCategory(id: string, updates: UpdateCategoryInput): Promise<CategoryEntity | null>;
  upsertCategory(input: CreateCategoryInput): Promise<CategoryEntity>;
  deleteCategory(id: string): Promise<boolean>;

  // KeywordCluster
  findClustersByWebsite(websiteId: string): Promise<KeywordClusterEntity[]>;
  findClusterById(id: string): Promise<KeywordClusterEntity | null>;
  createCluster(input: CreateKeywordClusterInput): Promise<KeywordClusterEntity>;
  updateCluster(id: string, updates: UpdateKeywordClusterInput): Promise<KeywordClusterEntity | null>;
  deleteCluster(id: string): Promise<boolean>;
  countClusters(filter?: { websiteId?: string }): Promise<number>;

  // Keyword
  findKeywordsByWebsite(
    websiteId: string,
    filter?: { clusterId?: string | null; status?: string; limit?: number; offset?: number }
  ): Promise<KeywordEntity[]>;
  findKeywordById(id: string): Promise<KeywordEntity | null>;
  findKeywordByTerm(websiteId: string, term: string): Promise<KeywordEntity | null>;
  createKeyword(input: CreateKeywordInput): Promise<KeywordEntity>;
  updateKeyword(id: string, updates: UpdateKeywordInput): Promise<KeywordEntity | null>;
  upsertKeyword(input: CreateKeywordInput): Promise<KeywordEntity>;
  deleteKeyword(id: string): Promise<boolean>;
  countKeywords(filter?: { websiteId?: string }): Promise<number>;
}
