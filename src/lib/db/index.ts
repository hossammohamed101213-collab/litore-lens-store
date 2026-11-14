import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA } from "./schema";
import { seedSampleData } from "./seed";

type DB = Database.Database;
const g = globalThis as unknown as { __litoreDb?: DB };

/** Where uploaded product images live (outside the build, so they persist). */
export const uploadDir = () => path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./data/uploads");

export function db(): DB {
  if (g.__litoreDb) return g.__litoreDb;
  const configured = process.env.DATABASE_PATH ?? "./data/litore.db";
  const file = configured === ":memory:" ? configured : path.resolve(/*turbopackIgnore: true*/ configured);
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const conn = new Database(file);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  conn.exec(SCHEMA);
  // Add columns that older databases don't have yet.
  const have = new Set((conn.prepare("PRAGMA table_info(customers)").all() as { name: string }[]).map((c) => c.name));
  if (!have.has("ref_balance")) conn.exec("ALTER TABLE customers ADD COLUMN ref_balance REAL NOT NULL DEFAULT 0");
  const ocols = new Set((conn.prepare("PRAGMA table_info(orders)").all() as { name: string }[]).map((c) => c.name));
  if (!ocols.has("payment_ref")) conn.exec("ALTER TABLE orders ADD COLUMN payment_ref TEXT");
  if (!ocols.has("carrier")) conn.exec("ALTER TABLE orders ADD COLUMN carrier TEXT");
  if (!ocols.has("label_url")) conn.exec("ALTER TABLE orders ADD COLUMN label_url TEXT");
  const fcols = new Set((conn.prepare("PRAGMA table_info(feedback)").all() as { name: string }[]).map((c) => c.name));
  if (!fcols.has("tags")) conn.exec("ALTER TABLE feedback ADD COLUMN tags TEXT NOT NULL DEFAULT ''");
  const ccols = new Set((conn.prepare("PRAGMA table_info(coupons)").all() as { name: string }[]).map((c) => c.name));
  if (!ccols.has("max_uses")) conn.exec("ALTER TABLE coupons ADD COLUMN max_uses INTEGER");
  if (!ccols.has("used_count")) conn.exec("ALTER TABLE coupons ADD COLUMN used_count INTEGER NOT NULL DEFAULT 0");
  if (!ccols.has("customer_id")) conn.exec("ALTER TABLE coupons ADD COLUMN customer_id TEXT");
  for (const col of ["phone", "avatar", "birthday", "city"]) {
    if (!have.has(col)) conn.exec(`ALTER TABLE customers ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`);
  }
  const pcols = new Set((conn.prepare("PRAGMA table_info(products)").all() as { name: string }[]).map((c) => c.name));
  if (!pcols.has("spin")) conn.exec("ALTER TABLE products ADD COLUMN spin INTEGER NOT NULL DEFAULT 0");
  // Products that only had the old single image get it as their first gallery picture.
  conn.exec(`INSERT INTO product_images(id,product_id,file,sort)
    SELECT lower(hex(randomblob(16))), id, image, 0 FROM products
    WHERE image IS NOT NULL AND image != '' AND NOT EXISTS (SELECT 1 FROM product_images pi WHERE pi.product_id = products.id)`);
  g.__litoreDb = conn;
  if (process.env.SEED_SAMPLE === "true") seedSampleData(conn);
  return conn;
}

export const toMinor = (n: number) => Math.round(n * 100);
export const fromMinor = (n: number) => n / 100;

export function getSetting(key: string, fallback = ""): string {
  const row = db().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? fallback;
}

export function setSetting(key: string, value: string) {
  db().prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, value);
}
