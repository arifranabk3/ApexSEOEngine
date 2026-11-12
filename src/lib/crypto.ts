import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getMasterKey(): Buffer {
  const rawSecret =
    process.env.ENCRYPTION_SECRET ||
    "8f4b2e9a1c7d3f6e5a0b4c8d2e6f1a3b9c5d7e0f2a4b6c8d1e3f5a7b9c0d2e4f";

  if (/^[0-9a-fA-F]{64}$/.test(rawSecret)) {
    return Buffer.from(rawSecret, "hex");
  }
  return crypto.createHash("sha256").update(rawSecret).digest();
}

/**
 * Encrypts plaintext credentials or JSON objects using AES-256-GCM.
 * Output format: `v1:<ivHex>:<authTagHex>:<cipherTextHex>`
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return "";
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `v1:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts an AES-256-GCM payload produced by `encryptSecret`.
 */
export function decryptSecret(payload: string | null | undefined): string {
  if (!payload) return "";
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Invalid encrypted credential payload format");
  }

  const [, ivHex, authTagHex, cipherTextHex] = parts;
  const key = getMasterKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encryptedText = Buffer.from(cipherTextHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Encrypts a structured object into an AES-256-GCM ciphertext string.
 */
export function encryptJsonCredentials(credentials: Record<string, unknown>): string {
  return encryptSecret(JSON.stringify(credentials));
}

/**
 * Decrypts a structured credential object on the server only.
 */
export function decryptJsonCredentials<T = Record<string, unknown>>(
  encryptedPayload: string | null | undefined
): T | null {
  if (!encryptedPayload) return null;
  const json = decryptSecret(encryptedPayload);
  return JSON.parse(json) as T;
}

/**
 * Masks any secret string so it can never leak in API responses or logs.
 */
export function maskSecretValue(secret: string | null | undefined): string {
  if (!secret) return "Not Configured";
  if (secret.length <= 8) return "••••••••";
  return `${secret.slice(0, 3)}••••••••${secret.slice(-3)}`;
}

/**
 * Indicates whether encrypted credentials are stored without exposing raw values.
 */
export function hasEncryptedCredentials(payload: string | null | undefined): boolean {
  return Boolean(payload && payload.startsWith("v1:"));
}

