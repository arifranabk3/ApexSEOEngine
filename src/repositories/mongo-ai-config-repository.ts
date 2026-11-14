import { Collection, Document } from "mongodb";
import { getMongoDb } from "@/lib/mongodb";
import { randomUUID } from "crypto";
import {
  AIModelEntity,
  AIModelEntitySchema,
  AIProviderEntity,
  AIProviderEntitySchema,
  CreateAIModelInput,
  CreateAIProviderInput,
  IAIConfigRepository
} from "./ai-config-repository.types";

interface MongoAIProviderDoc extends Document {
  id: string;
  name: string;
  providerType: string;
  baseUrl: string;
  encryptedApiKey?: string | null;
  isLocal: boolean;
  isEnabled: boolean;
  status: string;
  lastCheckedAt?: Date | null;
  totalRequests: number;
  totalTokens: number;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface MongoAIModelDoc extends Document {
  id: string;
  providerId: string;
  name: string;
  modelId: string;
  capabilities: string[];
  contextWindow: number;
  temperature: number;
  isDefault: boolean;
  isEnabled: boolean;
  totalRequests: number;
  totalTokens: number;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoAIConfigRepository implements IAIConfigRepository {
  private async getProvidersColl(): Promise<Collection<MongoAIProviderDoc>> {
    const db = await getMongoDb();
    return db.collection<MongoAIProviderDoc>("ai_providers");
  }

  private async getModelsColl(): Promise<Collection<MongoAIModelDoc>> {
    const db = await getMongoDb();
    return db.collection<MongoAIModelDoc>("ai_models");
  }

  async initIndexes(): Promise<void> {
    const pColl = await this.getProvidersColl();
    const mColl = await this.getModelsColl();

    await Promise.all([
      pColl.createIndex({ id: 1 }, { unique: true, name: "uniq_ai_provider_id" }),
      pColl.createIndex({ name: 1 }, { unique: true, name: "uniq_ai_provider_name" }),
      pColl.createIndex({ providerType: 1 }, { name: "idx_ai_provider_type" }),
      pColl.createIndex({ isEnabled: 1 }, { name: "idx_ai_provider_isEnabled" }),

      mColl.createIndex({ id: 1 }, { unique: true, name: "uniq_ai_model_id" }),
      mColl.createIndex(
        { providerId: 1, modelId: 1 },
        { unique: true, name: "uniq_ai_model_provider_model" }
      ),
      mColl.createIndex({ providerId: 1 }, { name: "idx_ai_model_providerId" }),
      mColl.createIndex({ isDefault: 1 }, { name: "idx_ai_model_isDefault" }),
      mColl.createIndex({ isEnabled: 1 }, { name: "idx_ai_model_isEnabled" })
    ]);
  }

  private mapProvider(doc: MongoAIProviderDoc, models: AIModelEntity[] = []): AIProviderEntity {
    return AIProviderEntitySchema.parse({
      id: doc.id,
      name: doc.name,
      providerType: doc.providerType,
      baseUrl: doc.baseUrl,
      encryptedApiKey: doc.encryptedApiKey ?? null,
      isLocal: doc.isLocal,
      isEnabled: doc.isEnabled,
      status: doc.status,
      lastCheckedAt: doc.lastCheckedAt ?? null,
      totalRequests: doc.totalRequests ?? 0,
      totalTokens: doc.totalTokens ?? 0,
      config: doc.config ?? {},
      models,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    });
  }

  private mapModel(doc: MongoAIModelDoc): AIModelEntity {
    return AIModelEntitySchema.parse({
      id: doc.id,
      providerId: doc.providerId,
      name: doc.name,
      modelId: doc.modelId,
      capabilities: Array.isArray(doc.capabilities) ? doc.capabilities : ["text"],
      contextWindow: doc.contextWindow ?? 8192,
      temperature: doc.temperature ?? 0.7,
      isDefault: Boolean(doc.isDefault),
      isEnabled: Boolean(doc.isEnabled),
      totalRequests: doc.totalRequests ?? 0,
      totalTokens: doc.totalTokens ?? 0,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    });
  }

  async findAllProviders(filter?: { isEnabled?: boolean }): Promise<AIProviderEntity[]> {
    const pColl = await this.getProvidersColl();
    const mColl = await this.getModelsColl();

    const query: Record<string, unknown> = {};
    if (filter?.isEnabled !== undefined) query.isEnabled = filter.isEnabled;

    const pDocs = await pColl.find(query).sort({ createdAt: 1 }).toArray();
    if (pDocs.length === 0) return [];

    const providerIds = pDocs.map((p) => p.id);
    const mDocs = await mColl
      .find({ providerId: { $in: providerIds } })
      .sort({ isDefault: -1, createdAt: 1 })
      .toArray();

    const modelsByProvider = new Map<string, AIModelEntity[]>();
    for (const mDoc of mDocs) {
      const model = this.mapModel(mDoc);
      const list = modelsByProvider.get(mDoc.providerId) || [];
      list.push(model);
      modelsByProvider.set(mDoc.providerId, list);
    }

    return pDocs.map((p) => this.mapProvider(p, modelsByProvider.get(p.id) || []));
  }

  async findProviderById(id: string): Promise<AIProviderEntity | null> {
    const pColl = await this.getProvidersColl();
    const doc = await pColl.findOne({ id });
    if (!doc) return null;

    const models = await this.findModelsByProvider(id);
    return this.mapProvider(doc, models);
  }

  async findProviderByName(name: string): Promise<AIProviderEntity | null> {
    const pColl = await this.getProvidersColl();
    const doc = await pColl.findOne({ name });
    if (!doc) return null;

    const models = await this.findModelsByProvider(doc.id);
    return this.mapProvider(doc, models);
  }

  async findFirstEnabledWithDefaultModel(): Promise<{
    provider: AIProviderEntity;
    defaultModel: AIModelEntity | null;
  } | null> {
    const pColl = await this.getProvidersColl();
    const mColl = await this.getModelsColl();

    const pDoc = await pColl.findOne({ isEnabled: true });
    if (!pDoc) return null;

    const mDocs = await mColl
      .find({ providerId: pDoc.id, isEnabled: true })
      .sort({ isDefault: -1, createdAt: 1 })
      .toArray();

    const models = mDocs.map((m) => this.mapModel(m));
    const provider = this.mapProvider(pDoc, models);
    const defaultModel = models.length > 0 ? models[0] : null;

    return { provider, defaultModel };
  }

  async createProvider(input: CreateAIProviderInput): Promise<AIProviderEntity> {
    const pColl = await this.getProvidersColl();
    const now = new Date();
    const providerId = input.id || randomUUID();

    const pDoc: MongoAIProviderDoc = {
      id: providerId,
      name: input.name,
      providerType: input.providerType || "OLLAMA",
      baseUrl: input.baseUrl,
      encryptedApiKey: input.encryptedApiKey ?? null,
      isLocal: input.isLocal ?? true,
      isEnabled: input.isEnabled ?? true,
      status: input.status || "CONFIGURED",
      lastCheckedAt: null,
      totalRequests: 0,
      totalTokens: 0,
      config: input.config || {},
      createdAt: now,
      updatedAt: now
    };

    await pColl.insertOne(pDoc);

    const models: AIModelEntity[] = [];
    if (input.defaultModel) {
      const model = await this.addModel({
        providerId,
        id: input.defaultModel.id,
        name: input.defaultModel.name,
        modelId: input.defaultModel.modelId,
        contextWindow: input.defaultModel.contextWindow || 32768,
        capabilities: input.defaultModel.capabilities || ["text"],
        temperature: input.defaultModel.temperature ?? 0.7,
        isDefault: input.defaultModel.isDefault !== false,
        isEnabled: true
      });
      models.push(model);
    }

    return this.mapProvider(pDoc, models);
  }

  async updateProvider(
    id: string,
    updates: Partial<Omit<AIProviderEntity, "id" | "models" | "createdAt" | "updatedAt">> & {
      incrementRequests?: boolean;
      incrementTokens?: number;
    }
  ): Promise<AIProviderEntity | null> {
    const pColl = await this.getProvidersColl();
    const now = new Date();

    const setFields: Record<string, unknown> = { updatedAt: now };
    if (updates.name !== undefined) setFields.name = updates.name;
    if (updates.providerType !== undefined) setFields.providerType = updates.providerType;
    if (updates.baseUrl !== undefined) setFields.baseUrl = updates.baseUrl;
    if (updates.encryptedApiKey !== undefined) setFields.encryptedApiKey = updates.encryptedApiKey;
    if (updates.isLocal !== undefined) setFields.isLocal = updates.isLocal;
    if (updates.isEnabled !== undefined) setFields.isEnabled = updates.isEnabled;
    if (updates.status !== undefined) setFields.status = updates.status;
    if (updates.lastCheckedAt !== undefined) setFields.lastCheckedAt = updates.lastCheckedAt;
    if (updates.config !== undefined) setFields.config = updates.config;

    const updateDoc: Record<string, unknown> = { $set: setFields };

    const incFields: Record<string, number> = {};
    if (updates.incrementRequests) incFields.totalRequests = 1;
    if (updates.incrementTokens && updates.incrementTokens > 0) {
      incFields.totalTokens = updates.incrementTokens;
    }
    if (Object.keys(incFields).length > 0) {
      updateDoc.$inc = incFields;
    }

    const res = await pColl.findOneAndUpdate({ id }, updateDoc, { returnDocument: "after" });
    if (!res) return null;

    const models = await this.findModelsByProvider(id);
    return this.mapProvider(res, models);
  }

  async deleteProvider(id: string): Promise<boolean> {
    const pColl = await this.getProvidersColl();
    const mColl = await this.getModelsColl();

    const res = await pColl.deleteOne({ id });
    await mColl.deleteMany({ providerId: id });
    return (res.deletedCount ?? 0) > 0;
  }

  async countHealthyProviders(): Promise<number> {
    const pColl = await this.getProvidersColl();
    return pColl.countDocuments({ isEnabled: true });
  }

  async findModelsByProvider(providerId: string): Promise<AIModelEntity[]> {
    const mColl = await this.getModelsColl();
    const docs = await mColl
      .find({ providerId })
      .sort({ isDefault: -1, createdAt: 1 })
      .toArray();
    return docs.map((d) => this.mapModel(d));
  }

  async findModelById(id: string): Promise<AIModelEntity | null> {
    const mColl = await this.getModelsColl();
    const doc = await mColl.findOne({ id });
    return doc ? this.mapModel(doc) : null;
  }

  async addModel(input: CreateAIModelInput): Promise<AIModelEntity> {
    const mColl = await this.getModelsColl();
    const now = new Date();
    const modelId = input.id || randomUUID();

    if (input.isDefault) {
      await mColl.updateMany(
        { providerId: input.providerId },
        { $set: { isDefault: false, updatedAt: now } }
      );
    }

    const doc: MongoAIModelDoc = {
      id: modelId,
      providerId: input.providerId,
      name: input.name,
      modelId: input.modelId,
      capabilities: input.capabilities || ["text"],
      contextWindow: input.contextWindow ?? 8192,
      temperature: input.temperature ?? 0.7,
      isDefault: Boolean(input.isDefault),
      isEnabled: input.isEnabled !== false,
      totalRequests: 0,
      totalTokens: 0,
      createdAt: now,
      updatedAt: now
    };

    await mColl.insertOne(doc);
    return this.mapModel(doc);
  }

  async updateModel(
    id: string,
    updates: Partial<Omit<AIModelEntity, "id" | "providerId" | "createdAt" | "updatedAt">>
  ): Promise<AIModelEntity | null> {
    const mColl = await this.getModelsColl();
    const now = new Date();

    const existing = await mColl.findOne({ id });
    if (!existing) return null;

    if (updates.isDefault) {
      await mColl.updateMany(
        { providerId: existing.providerId, id: { $ne: id } },
        { $set: { isDefault: false, updatedAt: now } }
      );
    }

    const setFields: Record<string, unknown> = { updatedAt: now };
    if (updates.name !== undefined) setFields.name = updates.name;
    if (updates.modelId !== undefined) setFields.modelId = updates.modelId;
    if (updates.capabilities !== undefined) setFields.capabilities = updates.capabilities;
    if (updates.contextWindow !== undefined) setFields.contextWindow = updates.contextWindow;
    if (updates.temperature !== undefined) setFields.temperature = updates.temperature;
    if (updates.isDefault !== undefined) setFields.isDefault = updates.isDefault;
    if (updates.isEnabled !== undefined) setFields.isEnabled = updates.isEnabled;

    const res = await mColl.findOneAndUpdate(
      { id },
      { $set: setFields },
      { returnDocument: "after" }
    );
    return res ? this.mapModel(res) : null;
  }

  async deleteModel(id: string): Promise<boolean> {
    const mColl = await this.getModelsColl();
    const res = await mColl.deleteOne({ id });
    return (res.deletedCount ?? 0) > 0;
  }

  async upsertProvider(input: CreateAIProviderInput): Promise<AIProviderEntity> {
    const pColl = await this.getProvidersColl();

    const existing = await pColl.findOne({ name: input.name });
    if (existing) {
      const models = await this.findModelsByProvider(existing.id);
      return this.mapProvider(existing, models);
    }

    return this.createProvider(input);
  }

  async upsertModel(input: CreateAIModelInput): Promise<AIModelEntity> {
    const mColl = await this.getModelsColl();
    const existing = await mColl.findOne({
      providerId: input.providerId,
      modelId: input.modelId
    });

    if (existing) {
      return this.mapModel(existing);
    }

    return this.addModel(input);
  }
}
