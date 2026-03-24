import crypto from "crypto";
import { prisma } from "./prisma";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

// Cache the key in memory after first fetch
let cachedKey: Buffer | null = null;

async function getKey(): Promise<Buffer> {
  if (cachedKey) return cachedKey;

  // Try to load from database first
  const settings = await prisma.settings.findUnique({
    where: { id: "singleton" },
  });

  if (settings?.encryptionKey) {
    cachedKey = Buffer.from(settings.encryptionKey, "hex");
    return cachedKey;
  }

  // No key in DB — generate one and store it permanently
  const newKey = crypto.randomBytes(32);

  await prisma.settings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", encryptionKey: newKey.toString("hex") },
    update: { encryptionKey: newKey.toString("hex") },
  });

  cachedKey = newKey;
  return cachedKey;
}

// Synchronous version using cached key — throws if key not loaded yet
function getKeySync(): Buffer {
  if (cachedKey) return cachedKey;

  // Fallback to env var for backwards compatibility during startup
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    return crypto.scryptSync(envKey, "salt", 32);
  }

  throw new Error("Encryption key not loaded. Call ensureEncryptionKey() first.");
}

/**
 * Must be called once at app startup to load the encryption key from DB.
 * After this, encrypt/decrypt work synchronously.
 */
export async function ensureEncryptionKey(): Promise<void> {
  await getKey();
}

export function encrypt(text: string): string {
  const key = getKeySync();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag();

  return iv.toString("hex") + ":" + tag.toString("hex") + ":" + encrypted;
}

export function decrypt(encryptedText: string): string {
  const key = getKeySync();
  const parts = encryptedText.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const tag = Buffer.from(parts[1], "hex");
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
