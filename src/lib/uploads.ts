import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { uploadDir } from "@/lib/db";

const MAX_BYTES = 5 * 1024 * 1024;

/** Detect the real image type from the file bytes (never trust the filename or browser type). */
function sniff(buf: Buffer): "jpg" | "png" | "webp" | null {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "webp";
  return null;
}

export const MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function saveImage(file: File): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  if (file.size === 0) return { ok: false, error: "empty" };
  if (file.size > MAX_BYTES) return { ok: false, error: "too_large" };
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniff(buf);
  if (!ext) return { ok: false, error: "bad_type" };
  fs.mkdirSync(uploadDir(), { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(uploadDir(), name), buf);
  return { ok: true, name };
}

export function deleteImage(name: string | null) {
  if (!name || !/^[a-f0-9-]+\.(jpg|png|webp)$/.test(name)) return;
  fs.rmSync(path.join(uploadDir(), name), { force: true });
}
