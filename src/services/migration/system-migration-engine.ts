import { getDb } from "@/lib/db";
import { getSystemRepository } from "@/repositories/system-repository.factory";
import { CreateSearchPerformanceInput, UpsertSystemSettingInput, CreateAuditLogInput } from "@/repositories/system-repository.types";

export interface SystemMigrationSummary {
  dryRun: boolean;
  searchPerformance: {
    postgresCount: number;
    migrated: number;
    errors: number;
  };
  systemSettings: {
    postgresCount: number;
    migrated: number;
    errors: number;
  };
  auditLogs: {
    postgresCount: number;
    migrated: number;
    errors: number;
  };
}

export class SystemMigrationEngine {
  private repo = getSystemRepository();

  public async migrateAll(options: { dryRun?: boolean } = {}): Promise<SystemMigrationSummary> {
    const dryRun = Boolean(options.dryRun);
    const summary: SystemMigrationSummary = {
      dryRun,
      searchPerformance: { postgresCount: 0, migrated: 0, errors: 0 },
      systemSettings: { postgresCount: 0, migrated: 0, errors: 0 },
      auditLogs: { postgresCount: 0, migrated: 0, errors: 0 },
    };

    const db = await getDb();

    // 1. SearchPerformance
    try {
      const searchRecords = await db.searchPerformance.findMany();
      summary.searchPerformance.postgresCount = searchRecords.length;

      if (!dryRun && searchRecords.length > 0) {
        const batch: CreateSearchPerformanceInput[] = searchRecords.map((r: {
          websiteId: string;
          pageUrl: string;
          query: string;
          clicks: number;
          impressions: number;
          ctr: number;
          position: number;
          date: Date;
        }) => ({
          websiteId: r.websiteId,
          pageUrl: r.pageUrl,
          query: r.query,
          clicks: r.clicks,
          impressions: r.impressions,
          ctr: r.ctr,
          position: r.position,
          date: r.date,
        }));
        summary.searchPerformance.migrated = await this.repo.bulkUpsertSearchPerformance(batch);
      }
    } catch {
      summary.searchPerformance.errors++;
    }

    // 2. SystemSettings
    try {
      const settings = await db.systemSetting.findMany();
      summary.systemSettings.postgresCount = settings.length;

      if (!dryRun) {
        for (const s of settings) {
          try {
            const input: UpsertSystemSettingInput = {
              key: s.key,
              value: s.value,
              category: s.category,
              description: s.description,
              isSecret: s.isSecret,
            };
            await this.repo.upsertSetting(input);
            summary.systemSettings.migrated++;
          } catch {
            summary.systemSettings.errors++;
          }
        }
      }
    } catch {
      summary.systemSettings.errors++;
    }

    // 3. AuditLogs
    try {
      const auditRecords = await db.auditLog.findMany();
      summary.auditLogs.postgresCount = auditRecords.length;

      if (!dryRun) {
        for (const a of auditRecords) {
          try {
            const input: CreateAuditLogInput = {
              userId: a.userId,
              action: a.action,
              module: a.module,
              entityType: a.entityType,
              entityId: a.entityId,
              metadata: (a.metadata as Record<string, unknown>) ?? {},
              ipAddress: a.ipAddress,
              userAgent: a.userAgent,
              createdAt: a.createdAt,
            };
            await this.repo.createAuditLog(input);
            summary.auditLogs.migrated++;
          } catch {
            summary.auditLogs.errors++;
          }
        }
      }
    } catch {
      summary.auditLogs.errors++;
    }

    return summary;
  }
}
