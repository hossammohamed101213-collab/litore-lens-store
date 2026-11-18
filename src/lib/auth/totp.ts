import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Two-step sign-in for the owner: standard time-based codes (RFC 6238, SHA-1, 6 digits, 30 seconds) that any authenticator app understands. */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const b of buf) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}
export function fromBase32(text: string): Buffer {
  let bits = 0, value = 0; const out: number[] = [];
  for (const ch of text.toUpperCase().replace(/[^A-Z2-7]/g, "")) {
    value = (value << 5) | ALPHABET.indexOf(ch); bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

export const newTotpSecret = () => base32(randomBytes(20));
export const totpCounter = (now = Date.now()) => Math.floor(now / 30_000);

export function totpCode(secret: string, counter: number): string {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", fromBase32(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

/**
 * Checks a 6-digit code, allowing the clock to be off by one step either way.
 * Returns the counter that matched (to refuse the same code a second time), or null.
 */
export function verifyTotp(secret: string, code: string, lastUsed = -1, now = Date.now()): number | null {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean) || !secret) return null;
  const c = totpCounter(now);
  for (const step of [c, c - 1, c + 1]) {
    if (step <= lastUsed) continue;
    const want = Buffer.from(totpCode(secret, step)); const got = Buffer.from(clean);
    if (want.length === got.length && timingSafeEqual(want, got)) return step;
  }
  return null;
}

export const otpauthUri = (secret: string, account: string) =>
  `otpauth://totp/${encodeURIComponent("Litore:" + account)}?secret=${secret}&issuer=Litore&algorithm=SHA1&digits=6&period=30`;

/**
 * Eight one-time backup codes that belong to a secret (derived from it, so the set-up page can show them again
 * until two-step is switched on). Only their hashes are stored beside the encrypted secret; a used one is removed.
 */
export const backupCodesFor = (secret: string, n = 8) =>
  Array.from({ length: n }, (_, i) => base32(createHmac("sha256", fromBase32(secret)).update(`litore-backup-${i}`).digest()).slice(0, 10));
export const hashBackup = (code: string) => createHash("sha256").update(code.toUpperCase().replace(/[^A-Z2-7]/g, "")).digest("hex");
