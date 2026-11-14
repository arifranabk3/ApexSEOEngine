import { Collection, ObjectId } from "mongodb";
import { getMongoDb } from "@/lib/mongodb";
import {
  ISystemRepository,
  SearchPerformanceEntity,
  SearchPerformanceEntitySchema,
  CreateSearchPerformanceInput,
  SearchPerformanceFilter,
  SearchPerformanceMetrics,
  SystemSettingEntity,
  SystemSettingEntitySchema,
  UpsertSystemSettingInput,
  AuditLogEntity,
  AuditLogEntitySchema,
  CreateAuditLogInput,
  AuditLogFilter,
} from "./system-repository.types";

interface MongoSearchPerformanceDoc {
  _id: ObjectId;
  websiteId: string;
  pageUrl: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface MongoSystemSettingDoc {
  _id: ObjectId;
  key: string;
  value: unknown;
  type: "STRING" | "NUMBER" | "BOOLEAN" | "JSON";
  category: string;
  description?: string | null;
  isSecret?: boolean;
  isEncrypted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface MongoAuditLogDoc {
  _id: ObjectId;
  userId?: string | null;
  action: string;
  module: string;
  entityType?: string | null;
  entityId?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
}

export class MongoSystemRepository implements ISystemRepository {
  private indexesEnsured = false;

  private async getSearchCol(): Promise<Collection<MongoSearchPerformanceDoc>> {
    const db = await getMongoDb();
    return db.collection<MongoSearchPerformanceDoc>("search_performance");
  }

  private async getSettingsCol(): Promise<Collection<MongoSystemSettingDoc>> {
    const db = await getMongoDb();
    return db.collection<MongoSystemSettingDoc>("system_settings");
  }

  private async getAuditCol(): Promise<Collection<MongoAuditLogDoc>> {
    const db = await getMongoDb();
    return db.collection<MongoAuditLogDoc>("audit_logs");
  }

  public async ensureIndexes(): Promise<void> {
    if (this.indexesEnsured) return;
    try {
      const searchCol = await this.getSearchCol();
      await searchCol.createIndex(
        { websiteId: 1, pageUrl: 1, query: 1, date: 1 },
        { unique: true, name: "uniq_search_perf_dim" }
      );
      await searchCol.createIndex({ websiteId: 1, date: -1 }, { name: "idx_search_perf_site_date" });

      const settingsCol = await this.getSettingsCol();
      await settingsCol.createIndex({ key: 1 }, { unique: true, name: "uniq_system_settings_key" });
      await settingsCol.createIndex({ category: 1 }, { name: "idx_system_settings_cat" });

      const auditCol = await this.getAuditCol();
      await auditCol.createIndex({ createdAt: -1 }, { name: "idx_audit_logs_created" });
      await auditCol.createIndex({ userId: 1, createdAt: -1 }, { name: "idx_audit_logs_user" });
      await auditCol.createIndex({ module: 1, action: 1 }, { name: "idx_audit_logs_module_action" });
      await auditCol.createIndex({ ipAddress: 1, action: 1, createdAt: -1 }, { name: "idx_audit_logs_ip_rate" });

      this.indexesEnsured = true;
    } catch {
      // Allow operations if index creation hits permission edge-cases or already exists
      this.indexesEnsured = true;
    }
  }

  private mapSearchDoc(doc: MongoSearchPerformanceDoc): SearchPerformanceEntity {
    return SearchPerformanceEntitySchema.parse({
      id: doc._id.toHexString(),
      websiteId: doc.websiteId,
      pageUrl: doc.pageUrl,
      query: doc.query,
      clicks: doc.clicks ?? 0,
      impressions: doc.impressions ?? 0,
      ctr: doc.ctr ?? 0,
      position: doc.position ?? 0,
      date: doc.date instanceof Date ? doc.date : new Date(doc.date),
      createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt),
      updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt : new Date(doc.updatedAt),
    });
  }

  private mapSettingDoc(doc: MongoSystemSettingDoc): SystemSettingEntity {
    return SystemSettingEntitySchema.parse({
      id: doc._id.toHexString(),
      key: doc.key,
      value: doc.value,
      type: doc.type ?? "JSON",
      category: doc.category ?? "GENERAL",
      description: doc.description ?? null,
      isSecret: Boolean(doc.isSecret),
      isEncrypted: Boolean(doc.isEncrypted),
      createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt),
      updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt : new Date(doc.updatedAt),
    });
  }

  private mapAuditDoc(doc: MongoAuditLogDoc): AuditLogEntity {
    return AuditLogEntitySchema.parse({
      id: doc._id.toHexString(),
      userId: doc.userId ?? null,
      action: doc.action,
      module: doc.module,
      entityType: doc.entityType ?? null,
      entityId: doc.entityId ?? null,
      resourceId: doc.resourceId ?? null,
      metadata: doc.metadata ?? {},
      details: doc.details ?? null,
      ipAddress: doc.ipAddress ?? null,
      userAgent: doc.userAgent ?? null,
      createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt),
    });
  }

  // -------------------------------------------------------------------------
  // SearchPerformance Operations
  // -------------------------------------------------------------------------
  async recordSearchPerformance(input: CreateSearchPerformanceInput): Promise<SearchPerformanceEntity> {
    await this.ensureIndexes();
    const col = await this.getSearchCol();
    const now = new Date();
    const dateOnly = new Date(input.date);

    const updateDoc = {
      $set: {
        clicks: input.clicks,
        impressions: input.impressions,
        ctr: input.ctr,
        position: input.position,
        updatedAt: now,
      },
      $setOnInsert: {
        _id: new ObjectId(),
        websiteId: input.websiteId,
        pageUrl: input.pageUrl,
        query: input.query,
        date: dateOnly,
        createdAt: now,
      },
    };

    const res = await col.findOneAndUpdate(
      {
        websiteId: input.websiteId,
        pageUrl: input.pageUrl,
        query: input.query,
        date: dateOnly,
      },
      updateDoc,
      { upsert: true, returnDocument: "after" }
    );

    if (!res) {
      throw new Error("Failed to record search performance entry");
    }

    return this.mapSearchDoc(res);
  }

  async bulkUpsertSearchPerformance(records: CreateSearchPerformanceInput[]): Promise<number> {
    if (records.length === 0) return 0;
    await this.ensureIndexes();
    const col = await this.getSearchCol();
    const now = new Date();

    const ops = records.map((record) => {
      const dateOnly = new Date(record.date);
      return {
        updateOne: {
          filter: {
            websiteId: record.websiteId,
            pageUrl: record.pageUrl,
            query: record.query,
            date: dateOnly,
          },
          update: {
            $set: {
              clicks: record.clicks,
              impressions: record.impressions,
              ctr: record.ctr,
              position: record.position,
              updatedAt: now,
            },
            $setOnInsert: {
              _id: new ObjectId(),
              websiteId: record.websiteId,
              pageUrl: record.pageUrl,
              query: record.query,
              date: dateOnly,
              createdAt: now,
            },
          },
          upsert: true,
        },
      };
    });

    const res = await col.bulkWrite(ops, { ordered: false });
    return (res.upsertedCount || 0) + (res.modifiedCount || 0);
  }

  async findSearchPerformance(filter: SearchPerformanceFilter): Promise<SearchPerformanceEntity[]> {
    await this.ensureIndexes();
    const col = await this.getSearchCol();
    const q: Record<string, unknown> = {};

    if (filter.websiteId) q.websiteId = filter.websiteId;
    if (filter.pageUrl) q.pageUrl = filter.pageUrl;
    if (filter.query) q.query = filter.query;

    if (filter.startDate || filter.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (filter.startDate) dateFilter.$gte = filter.startDate;
      if (filter.endDate) dateFilter.$lte = filter.endDate;
      q.date = dateFilter;
    }

    let cursor = col.find(q).sort({ date: -1, createdAt: -1 });
    if (typeof filter.offset === "number" && filter.offset > 0) {
      cursor = cursor.skip(filter.offset);
    }
    if (typeof filter.limit === "number" && filter.limit > 0) {
      cursor = cursor.limit(filter.limit);
    }

    const docs = await cursor.toArray();
    return docs.map((d) => this.mapSearchDoc(d));
  }

  async countSearchPerformance(filter: SearchPerformanceFilter): Promise<number> {
    await this.ensureIndexes();
    const col = await this.getSearchCol();
    const q: Record<string, unknown> = {};

    if (filter.websiteId) q.websiteId = filter.websiteId;
    if (filter.pageUrl) q.pageUrl = filter.pageUrl;
    if (filter.query) q.query = filter.query;

    if (filter.startDate || filter.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (filter.startDate) dateFilter.$gte = filter.startDate;
      if (filter.endDate) dateFilter.$lte = filter.endDate;
      q.date = dateFilter;
    }

    return col.countDocuments(q);
  }

  async aggregateSearchMetrics(filter: SearchPerformanceFilter): Promise<SearchPerformanceMetrics> {
    await this.ensureIndexes();
    const col = await this.getSearchCol();
    const q: Record<string, unknown> = {};

    if (filter.websiteId) q.websiteId = filter.websiteId;
    if (filter.pageUrl) q.pageUrl = filter.pageUrl;
    if (filter.query) q.query = filter.query;

    if (filter.startDate || filter.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (filter.startDate) dateFilter.$gte = filter.startDate;
      if (filter.endDate) dateFilter.$lte = filter.endDate;
      q.date = dateFilter;
    }

    const pipeline = [
      { $match: q },
      {
        $group: {
          _id: null,
          totalClicks: { $sum: "$clicks" },
          totalImpressions: { $sum: "$impressions" },
          averageCtr: { $avg: "$ctr" },
          averagePosition: { $avg: "$position" },
          recordCount: { $sum: 1 },
        },
      },
    ];

    const result = await col.aggregate(pipeline).toArray();
    if (result.length === 0) {
      return {
        totalClicks: 0,
        totalImpressions: 0,
        averageCtr: 0,
        averagePosition: 0,
        recordCount: 0,
      };
    }

    const agg = result[0];
    return {
      totalClicks: Number(agg.totalClicks ?? 0),
      totalImpressions: Number(agg.totalImpressions ?? 0),
      averageCtr: Math.round(Number(agg.averageCtr ?? 0) * 10000) / 10000,
      averagePosition: Math.round(Number(agg.averagePosition ?? 0) * 100) / 100,
      recordCount: Number(agg.recordCount ?? 0),
    };
  }

  // -------------------------------------------------------------------------
  // SystemSetting Operations
  // -------------------------------------------------------------------------
  async findSettingByKey(key: string): Promise<SystemSettingEntity | null> {
    await this.ensureIndexes();
    const col = await this.getSettingsCol();
    const doc = await col.findOne({ key });
    if (!doc) return null;
    return this.mapSettingDoc(doc);
  }

  async findSettingsByCategory(category: string): Promise<SystemSettingEntity[]> {
    await this.ensureIndexes();
    const col = await this.getSettingsCol();
    const docs = await col.find({ category }).sort({ key: 1 }).toArray();
    return docs.map((d) => this.mapSettingDoc(d));
  }

  async findAllSettings(): Promise<SystemSettingEntity[]> {
    await this.ensureIndexes();
    const col = await this.getSettingsCol();
    const docs = await col.find({}).sort({ category: 1, key: 1 }).toArray();
    return docs.map((d) => this.mapSettingDoc(d));
  }

  async upsertSetting(input: UpsertSystemSettingInput): Promise<SystemSettingEntity> {
    await this.ensureIndexes();
    const col = await this.getSettingsCol();
    const now = new Date();

    const updateDoc = {
      $set: {
        value: input.value,
        type: input.type ?? "JSON",
        category: input.category ?? "GENERAL",
        description: input.description !== undefined ? input.description : null,
        isSecret: Boolean(input.isSecret),
        isEncrypted: Boolean(input.isEncrypted),
        updatedAt: now,
      },
      $setOnInsert: {
        _id: new ObjectId(),
        key: input.key,
        createdAt: now,
      },
    };

    const res = await col.findOneAndUpdate(
      { key: input.key },
      updateDoc,
      { upsert: true, returnDocument: "after" }
    );

    if (!res) {
      throw new Error(`Failed to upsert system setting with key "${input.key}"`);
    }

    return this.mapSettingDoc(res);
  }

  async deleteSettingsByCategory(category: string): Promise<number> {
    await this.ensureIndexes();
    const col = await this.getSettingsCol();
    const res = await col.deleteMany({ category });
    return res.deletedCount || 0;
  }

  async deleteSettingByKey(key: string): Promise<boolean> {
    await this.ensureIndexes();
    const col = await this.getSettingsCol();
    const res = await col.deleteOne({ key });
    return (res.deletedCount || 0) > 0;
  }

  // -------------------------------------------------------------------------
  // AuditLog Operations
  // -------------------------------------------------------------------------
  async createAuditLog(input: CreateAuditLogInput): Promise<AuditLogEntity> {
    await this.ensureIndexes();
    const col = await this.getAuditCol();
    const now = input.createdAt ?? new Date();

    const doc: MongoAuditLogDoc = {
      _id: new ObjectId(),
      userId: input.userId ?? null,
      action: input.action,
      module: input.module,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      resourceId: input.resourceId ?? null,
      metadata: input.metadata ?? {},
      details: input.details ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      createdAt: now,
    };

    await col.insertOne(doc);
    return this.mapAuditDoc(doc);
  }

  async findAuditLogs(filter: AuditLogFilter): Promise<AuditLogEntity[]> {
    await this.ensureIndexes();
    const col = await this.getAuditCol();
    const q: Record<string, unknown> = {};

    if (filter.userId !== undefined) q.userId = filter.userId;
    if (filter.module) q.module = filter.module;
    if (filter.action) q.action = filter.action;
    if (filter.entityType) q.entityType = filter.entityType;
    if (filter.entityId) q.entityId = filter.entityId;
    if (filter.resourceId) q.resourceId = filter.resourceId;
    if (filter.ipAddress) q.ipAddress = filter.ipAddress;

    if (filter.startDate || filter.endDate) {
      const createdFilter: Record<string, Date> = {};
      if (filter.startDate) createdFilter.$gte = filter.startDate;
      if (filter.endDate) createdFilter.$lte = filter.endDate;
      q.createdAt = createdFilter;
    }

    let cursor = col.find(q).sort({ createdAt: -1 });
    if (typeof filter.offset === "number" && filter.offset > 0) {
      cursor = cursor.skip(filter.offset);
    }
    if (typeof filter.limit === "number" && filter.limit > 0) {
      cursor = cursor.limit(filter.limit);
    }

    const docs = await cursor.toArray();
    return docs.map((d) => this.mapAuditDoc(d));
  }

  async countAuditLogs(filter: AuditLogFilter): Promise<number> {
    await this.ensureIndexes();
    const col = await this.getAuditCol();
    const q: Record<string, unknown> = {};

    if (filter.userId !== undefined) q.userId = filter.userId;
    if (filter.module) q.module = filter.module;
    if (filter.action) q.action = filter.action;
    if (filter.entityType) q.entityType = filter.entityType;
    if (filter.entityId) q.entityId = filter.entityId;
    if (filter.resourceId) q.resourceId = filter.resourceId;
    if (filter.ipAddress) q.ipAddress = filter.ipAddress;

    if (filter.startDate || filter.endDate) {
      const createdFilter: Record<string, Date> = {};
      if (filter.startDate) createdFilter.$gte = filter.startDate;
      if (filter.endDate) createdFilter.$lte = filter.endDate;
      q.createdAt = createdFilter;
    }

    return col.countDocuments(q);
  }
}
