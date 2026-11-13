import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** scrypt with a random salt. Format: scrypt$<salt b64>$<hash b64> */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = scryptSync(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

// Pre-computed so "unknown email" costs the same time as "wrong password".
export const DUMMY_HASH = hashPassword("litore-dummy-password");
