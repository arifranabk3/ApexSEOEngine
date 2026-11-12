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

