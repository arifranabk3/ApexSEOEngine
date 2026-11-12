import { describe, it, expect, beforeEach } from "vitest";
import {
  encryptSecret,
  decryptSecret,
  encryptJsonCredentials,
  decryptJsonCredentials,
  maskSecretValue,
  hasEncryptedCredentials
} from "@/lib/crypto";
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  hasPermission
} from "@/lib/auth";
import { checkRateLimit, resetRateLimiterForTesting } from "@/lib/rate-limit";
import { sanitizeAuditMetadata } from "@/lib/audit";
import { calculateRetryBackoffMs } from "@/services/automation/workflow-engine";

describe("Security, Encryption & RBAC Unit Suite", () => {
  beforeEach(() => {
    resetRateLimiterForTesting();
  });

  it("encrypts and decrypts secrets symmetrically using AES-256-GCM", () => {
    const raw = "wp_app_password_super_secret_987654";
    const encrypted = encryptSecret(raw);

    expect(encrypted).not.toContain(raw);
    expect(encrypted.startsWith("v1:")).toBe(true);
    expect(hasEncryptedCredentials(encrypted)).toBe(true);

    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(raw);
  });

  it("encrypts and decrypts structured JSON credentials without plaintext leakage", () => {
    const creds = {
      username: "seo_admin",
      appPassword: "xxxx-yyyy-zzzz-1111"
    };
    const cipher = encryptJsonCredentials(creds);
    expect(cipher).not.toContain("xxxx-yyyy-zzzz-1111");

    const restored = decryptJsonCredentials<typeof creds>(cipher);
    expect(restored).toEqual(creds);
  });

  it("masks secret values for frontend display", () => {
    expect(maskSecretValue("abcdefghijk12345")).toBe("abc••••••••345");
    expect(maskSecretValue("short")).toBe("••••••••");
    expect(maskSecretValue(null)).toBe("Not Configured");
  });

  it("hashes and verifies passwords with bcrypt", async () => {
    const hash = await hashPassword("MySecurePassword!2026");
    expect(hash).not.toBe("MySecurePassword!2026");
    expect(await verifyPassword("MySecurePassword!2026", hash)).toBe(true);
    expect(await verifyPassword("WrongPassword", hash)).toBe(false);
  });

  it("signs and verifies JWT session tokens and enforces RBAC permissions", async () => {
    const user = {
      id: "usr_123",
      email: "editor@apexseo.local",
      name: "SEO Editor",
      roleName: "EDITOR",
      permissions: ["content:read", "content:write"]
    };

    const token = await createSessionToken(user);
    const verified = await verifySessionToken(token);

    expect(verified).toEqual(user);
    expect(hasPermission(verified, "content:write")).toBe(true);
    expect(hasPermission(verified, "websites:delete")).toBe(false);
  });

  it("enforces token-bucket API rate limiting", () => {
    const key = "test-client-ip";
    const r1 = checkRateLimit(key, 2, 60_000);
    const r2 = checkRateLimit(key, 2, 60_000);
    const r3 = checkRateLimit(key, 2, 60_000);

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it("redacts sensitive fields in audit log metadata", () => {
    const dirty = {
      website: "example.com",
      apiKey: "sk-secret-value",
      nested: {
        password: "my-password",
        safeField: "ok"
      }
    };

    const sanitized = sanitizeAuditMetadata(dirty);
    expect(sanitized.apiKey).toBe("[REDACTED]");
    expect((sanitized.nested as Record<string, unknown>).password).toBe("[REDACTED]");
    expect((sanitized.nested as Record<string, unknown>).safeField).toBe("ok");
  });

  it("computes exponential backoff for automation retries", () => {
    expect(calculateRetryBackoffMs(1, 5000)).toBe(5000);
    expect(calculateRetryBackoffMs(2, 5000)).toBe(10000);
    expect(calculateRetryBackoffMs(3, 5000)).toBe(20000);
  });
});

