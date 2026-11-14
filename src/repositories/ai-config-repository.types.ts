import { z } from "zod";

export const AIProviderTypeSchema = z.enum([
  "OLLAMA",
  "OPENAI_COMPATIBLE",
  "LOCAL_LLAMA",
  "CUSTOM"
]);
export type AIProviderType = z.infer<typeof AIProviderTypeSchema>;

export const AIProviderStatusSchema = z.enum([
  "UNTESTED",
  "CONFIGURED",
  "READY",
  "ONLINE",
  "OFFLINE_READY",
  "ERROR"
]);
export type AIProviderStatus = z.infer<typeof AIProviderStatusSchema>;

export const AIModelEntitySchema = z.object({
  id: z.string(),
  providerId: z.string(),
  name: z.string(),
  modelId: z.string(),
  capabilities: z.array(z.string()).default(["text"]),
  contextWindow: z.number().int().default(8192),
  temperature: z.number().default(0.7),
  isDefault: z.boolean().default(false),
  isEnabled: z.boolean().default(true),
  totalRequests: z.number().int().default(0),
  totalTokens: z.number().int().default(0),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});
export type AIModelEntity = z.infer<typeof AIModelEntitySchema>;

export const AIProviderEntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  providerType: AIProviderTypeSchema.default("OLLAMA"),
  baseUrl: z.string(),
  encryptedApiKey: z.string().nullable().optional(),
  isLocal: z.boolean().default(true),
  isEnabled: z.boolean().default(true),
  status: AIProviderStatusSchema.default("UNTESTED"),
  lastCheckedAt: z.date().or(z.string()).nullable().optional(),
  totalRequests: z.number().int().default(0),
  totalTokens: z.number().int().default(0),
  config: z.record(z.string(), z.unknown()).default({}),
  models: z.array(AIModelEntitySchema).default([]),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string())
});
export type AIProviderEntity = z.infer<typeof AIProviderEntitySchema>;

export interface CreateAIProviderInput {
  id?: string;
  name: string;
  providerType?: AIProviderType;
  baseUrl: string;
  encryptedApiKey?: string | null;
  isLocal?: boolean;
  isEnabled?: boolean;
  status?: AIProviderStatus;
  config?: Record<string, unknown>;
  defaultModel?: {
    id?: string;
    name: string;
    modelId: string;
    contextWindow?: number;
    capabilities?: string[];
    temperature?: number;
    isDefault?: boolean;
  };
}

export interface CreateAIModelInput {
  id?: string;
  providerId: string;
  name: string;
  modelId: string;
  capabilities?: string[];
  contextWindow?: number;
  temperature?: number;
  isDefault?: boolean;
  isEnabled?: boolean;
}

export interface IAIConfigRepository {
  initIndexes(): Promise<void>;
  findAllProviders(filter?: { isEnabled?: boolean }): Promise<AIProviderEntity[]>;
  findProviderById(id: string): Promise<AIProviderEntity | null>;
  findProviderByName(name: string): Promise<AIProviderEntity | null>;
  findFirstEnabledWithDefaultModel(): Promise<{
    provider: AIProviderEntity;
    defaultModel: AIModelEntity | null;
  } | null>;
  createProvider(input: CreateAIProviderInput): Promise<AIProviderEntity>;
  updateProvider(
    id: string,
    updates: Partial<Omit<AIProviderEntity, "id" | "models" | "createdAt" | "updatedAt">> & {
      incrementRequests?: boolean;
      incrementTokens?: number;
    }
  ): Promise<AIProviderEntity | null>;
  deleteProvider(id: string): Promise<boolean>;
  countHealthyProviders(): Promise<number>;

  // Model methods
  findModelsByProvider(providerId: string): Promise<AIModelEntity[]>;
  findModelById(id: string): Promise<AIModelEntity | null>;
  addModel(input: CreateAIModelInput): Promise<AIModelEntity>;
  updateModel(
    id: string,
    updates: Partial<Omit<AIModelEntity, "id" | "providerId" | "createdAt" | "updatedAt">>
  ): Promise<AIModelEntity | null>;
  deleteModel(id: string): Promise<boolean>;
  upsertProvider(input: CreateAIProviderInput): Promise<AIProviderEntity>;
  upsertModel(input: CreateAIModelInput): Promise<AIModelEntity>;
}
