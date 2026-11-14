import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getSetting, setSetting } from "@/lib/db";

/**
 * Keys typed in the admin panel (payment / courier) are stored encrypted (AES-256-GCM).
 * The encryption key is a random file next to the database (never in the code, never in Git).
 */
function keyFile(): string {
  const dbFile = process.env.DATABASE_PATH ?? "./data/litore.db";
  const dir = dbFile === ":memory:" ? "./data" : path.dirname(dbFile);
  return path.resolve(/*turbopackIgnore: true*/ dir, "secret.key");
}

function masterKey(): Buffer {
  const f = keyFile();
  try {
    return Buffer.from(fs.readFileSync(f, "utf8").trim(), "hex");
  } catch {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    const k = randomBytes(32);
    fs.writeFileSync(f, k.toString("hex"), { mode: 0o600 });
    return k;
  }
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", masterKey(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `enc:${Buffer.concat([iv, c.getAuthTag(), body]).toString("base64")}`;
}

export function decrypt(stored: string): string {
  if (!stored.startsWith("enc:")) return "";
  try {
    const raw = Buffer.from(stored.slice(4), "base64");
    const d = createDecipheriv("aes-256-gcm", masterKey(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return "";
  }
}

/** Saved secret setting; an empty form value keeps the old one. */
export function setSecret(key: string, value: string) {
  if (value.trim()) setSetting(key, encrypt(value.trim()));
}
export const getSecret = (key: string) => decrypt(getSetting(key));
export const hasSecret = (key: string) => getSetting(key).startsWith("enc:");
