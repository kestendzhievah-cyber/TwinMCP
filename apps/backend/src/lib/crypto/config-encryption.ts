import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

export type EncryptedPayload = {
  ciphertext: string;
  iv: string;
  tag: string;
};

// Memoized: decrypt runs on every MCP proxy request (box-token decrypt), so
// parse+validate the 32-byte key once instead of on every call.
let _key: Buffer | null = null;
function getKey(): Buffer {
  if (_key) return _key;
  const hex = process.env.CONFIG_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error("CONFIG_ENCRYPTION_KEY env var is required (32 bytes hex, 64 chars)");
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== KEY_LENGTH) {
    throw new Error(`CONFIG_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes, got ${key.length}`);
  }
  _key = key;
  return _key;
}

export function encryptConfig(plaintext: unknown): EncryptedPayload {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const json = JSON.stringify(plaintext);
  const encrypted = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptConfig<T = unknown>(payload: EncryptedPayload): T {
  const key = getKey();
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const ciphertext = Buffer.from(payload.ciphertext, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as T;
}

/**
 * Non-throwing readiness probe: true when CONFIG_ENCRYPTION_KEY is set AND
 * decodes to a valid 32-byte key. Lets /api/health report the crypto blocker
 * (a missing/malformed key makes every MCP config + box-token en/decrypt throw)
 * without itself throwing.
 */
export function isConfigEncryptionReady(): boolean {
  const hex = process.env.CONFIG_ENCRYPTION_KEY;
  if (!hex) return false;
  try {
    return Buffer.from(hex, "hex").length === KEY_LENGTH;
  } catch {
    return false;
  }
}
