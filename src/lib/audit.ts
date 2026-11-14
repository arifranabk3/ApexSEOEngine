import { getSystemRepository } from "@/repositories/system-repository.factory";

export interface AuditEntryInput {
  userId?: string | null;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Redacts sensitive keys from audit log metadata so secrets are never written to logs.
 */
export function sanitizeAuditMetadata(
  metadata?: Record<string, unknown>
): Record<string, unknown> {
  if (!metadata) return {};
  const redacted: Record<string, unknown> = {};
  const secretKeyPattern = /(password|secret|token|apikey|api_key|credential|private_key)/i;

  for (const [k, v] of Object.entries(metadata)) {
    if (secretKeyPattern.test(k)) {
      redacted[k] = "[REDACTED]";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      redacted[k] = sanitizeAuditMetadata(v as Record<string, unknown>);
    } else {
      redacted[k] = v;
    }
  }
  return redacted;
}

export async function recordAuditLog(entry: AuditEntryInput): Promise<void> {
  try {
    const repo = getSystemRepository();
    const safeMetadata = sanitizeAuditMetadata(entry.metadata);
    await repo.createAuditLog({
      userId: entry.userId || null,
      action: entry.action,
      module: entry.module,
      entityType: entry.entityType || null,
      entityId: entry.entityId || null,
      ipAddress: entry.ipAddress || "127.0.0.1",
      userAgent: entry.userAgent || "system",
      metadata: safeMetadata,
    });
  } catch (err) {
    console.error("[AuditLog] Failed to record audit event:", err);
  }
}
