import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LEN = 12;   // 96-bit IV recommended for GCM

function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY env var is not set");
  const buf = Buffer.from(raw, "hex");
  if (buf.length !== 32)
    throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
  return buf;
}

/**
 * Encrypt plaintext → "iv:authTag:ciphertext" (all hex-encoded).
 * Returns the plaintext unchanged when ENCRYPTION_KEY is not configured,
 * so the app can still run in dev without encryption.
 */
export function encrypt(plaintext) {
  if (!process.env.ENCRYPTION_KEY) return plaintext;
  const key = getKey();
  const iv  = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt "iv:authTag:ciphertext" → plaintext.
 * Returns the input unchanged if it doesn't look like an encrypted payload
 * (backwards-compatible with existing plaintext rows).
 */
export function decrypt(value) {
  if (!process.env.ENCRYPTION_KEY) return value;
  if (!value || !value.includes(":")) return value; // plaintext row, pass through
  const parts = value.split(":");
  if (parts.length !== 3) return value;
  const [ivHex, tagHex, ctHex] = parts;
  try {
    const key = getKey();
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ctHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return "[decryption error]";
  }
}
