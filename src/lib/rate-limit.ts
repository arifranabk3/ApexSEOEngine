interface BucketEntry {
  tokens: number;
  lastRefillMs: number;
}

const rateBuckets = new Map<string, BucketEntry>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAfterMs: number;
}

export function checkRateLimit(
  identifier: string,
  maxRequests = 120,
  windowMs = 60_000
): RateLimitResult {
  const now = Date.now();
  const existing = rateBuckets.get(identifier);

  if (!existing || now - existing.lastRefillMs >= windowMs) {
    rateBuckets.set(identifier, {
      tokens: maxRequests - 1,
      lastRefillMs: now
    });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAfterMs: windowMs
    };
  }

  if (existing.tokens <= 0) {
    return {
      allowed: false,
      remaining: 0,
      resetAfterMs: Math.max(0, windowMs - (now - existing.lastRefillMs))
    };
  }

  existing.tokens -= 1;
  return {
    allowed: true,
    remaining: existing.tokens,
    resetAfterMs: Math.max(0, windowMs - (now - existing.lastRefillMs))
  };
}

export function resetRateLimiterForTesting(): void {
  rateBuckets.clear();
}

/**
 * Distributed rate limiter fallback for serverless execution.
 * Queries PostgreSQL AuditLog for cross-instance failed attempts when dealing with auth endpoints.
 */
export async function checkRateLimitDistributed(
  identifier: string,
  maxRequests = 15,
  windowMs = 60_000
): Promise<RateLimitResult> {
  const local = checkRateLimit(identifier, maxRequests, windowMs);
  if (!local.allowed) {
    return local;
  }

  if (identifier.startsWith("login:")) {
    try {
      const { getDb } = await import("./db");
      const db = await getDb();
      const ip = identifier.replace(/^login:/, "");
      const windowStart = new Date(Date.now() - windowMs);

      const failedCount = await db.auditLog.count({
        where: {
          action: "AUTH_LOGIN_FAILED",
          ipAddress: ip,
          createdAt: { gte: windowStart }
        }
      });

      if (failedCount >= maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetAfterMs: windowMs
        };
      }
    } catch {
      // In-memory fallback if database is offline
    }
  }

  return local;
}

