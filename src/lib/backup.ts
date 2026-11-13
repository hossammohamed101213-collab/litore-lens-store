import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import Database from "better-sqlite3";
import { db, uploadDir } from "@/lib/db";

// Minimal streaming ZIP writer (deflate), so no extra dependency is needed.
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b: Buffer) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

type Central = { name: Buffer; crc: number; csize: number; size: number; offset: number; dosTime: number; dosDate: number };

function dos(d: Date) {
  return { t: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), d: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() };
}

function entry(name: string, data: Buffer, offset: number, now: Date): { chunk: Buffer; c: Central } {
  const nameB = Buffer.from(name, "utf8"); const comp = zlib.deflateRawSync(data); const { t, d } = dos(now);
  const h = Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
  h.writeUInt16LE(t, 10); h.writeUInt16LE(d, 12); h.writeUInt32LE(crc32(data), 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22);
  h.writeUInt16LE(nameB.length, 26); h.writeUInt16LE(0, 28);
  return { chunk: Buffer.concat([h, nameB, comp]), c: { name: nameB, crc: crc32(data), csize: comp.length, size: data.length, offset, dosTime: t, dosDate: d } };
}

function central(list: Central[], start: number): Buffer {
  const parts: Buffer[] = []; let size = 0;
  for (const c of list) {
    const h = Buffer.alloc(46);
    h.writeUInt32LE(0x02014b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(20, 6); h.writeUInt16LE(0x0800, 8); h.writeUInt16LE(8, 10);
    h.writeUInt16LE(c.dosTime, 12); h.writeUInt16LE(c.dosDate, 14); h.writeUInt32LE(c.crc, 16); h.writeUInt32LE(c.csize, 20); h.writeUInt32LE(c.size, 24);
    h.writeUInt16LE(c.name.length, 28); h.writeUInt32LE(c.offset, 42);
    parts.push(h, c.name); size += 46 + c.name.length;
  }
  const e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(list.length, 8); e.writeUInt16LE(list.length, 10); e.writeUInt32LE(size, 12); e.writeUInt32LE(start, 16);
  return Buffer.concat([...parts, e]);
}

/** Consistent copy of the database with login sessions removed (so the file is safe to keep on a PC). */
function snapshotDb(): { file: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "litore-bk-"));
  const file = path.join(dir, "litore.db");
  return { file, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

export async function* backupZip(): AsyncGenerator<Buffer> {
  const now = new Date(); const list: Central[] = []; let offset = 0;
  const emit = (name: string, data: Buffer) => { const { chunk, c } = entry(name, data, offset, now); list.push(c); offset += chunk.length; return chunk; };
  const tmp = snapshotDb();
  try {
    await db().backup(tmp.file);
    const copy = new Database(tmp.file);
    try { copy.exec("DELETE FROM sessions; DELETE FROM password_resets; VACUUM;"); } catch { /* table may not exist */ }
    copy.close();
    yield emit("litore.db", fs.readFileSync(tmp.file));
  } finally { tmp.cleanup(); }
  const up = uploadDir();
  if (fs.existsSync(up)) for (const f of fs.readdirSync(up)) {
    const p = path.join(up, f);
    if (/^[\w.-]+$/.test(f) && fs.statSync(p).isFile()) yield emit(`uploads/${f}`, fs.readFileSync(p));
  }
  yield emit("README.txt", Buffer.from(`Litore backup — ${now.toISOString()}\n\nlitore.db  = كل الطلبات والعملاء والمنتجات والإعدادات\nuploads/   = صور المنتجات\n\nاحتفظي بهذا الملف في مكان خاص (فيه بيانات العملاء). لا ترسليه لأحد. للاسترجاع اطلبي المساعدة وأرسلي الملف.\n`, "utf8"));
  yield central(list, offset);
}

/** Whole days since an ISO date (null when never). */
export function daysSince(iso: string): number | null {
  return iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null;
}
