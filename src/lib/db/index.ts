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
  const admCols = new Set((conn.prepare("PRAGMA table_info(admins)").all() as { name: string }[]).map((x) => x.name));
  if (!admCols.has("totp_enabled")) {
    // two-step sign-in for the owner (off until she switches it on)
    conn.exec("ALTER TABLE admins ADD COLUMN totp_secret TEXT");
    conn.exec("ALTER TABLE admins ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0");
    conn.exec("ALTER TABLE admins ADD COLUMN totp_backup TEXT");
    conn.exec("ALTER TABLE admins ADD COLUMN totp_last INTEGER NOT NULL DEFAULT -1");
  }
  if (!ocols.has("delivered_at")) conn.exec("ALTER TABLE orders ADD COLUMN delivered_at TEXT"); // when it became "delivered" (start of the return window)
  if (!ocols.has("refund_minor")) {
    conn.exec("ALTER TABLE orders ADD COLUMN refund_minor INTEGER NOT NULL DEFAULT 0"); // money given back so far (recorded by the owner)
    conn.exec("ALTER TABLE orders ADD COLUMN refunded_at TEXT");
    conn.exec("UPDATE orders SET refund_minor = total_minor WHERE payment_status = 'refunded'");
  }
  if (!ocols.has("payment_gateway")) conn.exec("ALTER TABLE orders ADD COLUMN payment_gateway TEXT"); // which gateway took this order (empty = Telr, the first one)
  if (!ocols.has("carrier")) conn.exec("ALTER TABLE orders ADD COLUMN carrier TEXT");
  if (!ocols.has("label_url")) conn.exec("ALTER TABLE orders ADD COLUMN label_url TEXT");
  if (!ocols.has("carrier_ref")) conn.exec("ALTER TABLE orders ADD COLUMN carrier_ref TEXT");
  // store label: the secret part of the QR receipt link, when the label was printed, and when the order became paid
  if (!ocols.has("receipt_token")) conn.exec("ALTER TABLE orders ADD COLUMN receipt_token TEXT");
  if (!ocols.has("printed_at")) conn.exec("ALTER TABLE orders ADD COLUMN printed_at TEXT");
  if (!ocols.has("paid_at")) conn.exec("ALTER TABLE orders ADD COLUMN paid_at TEXT");
  conn.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_receipt_token ON orders(receipt_token) WHERE receipt_token IS NOT NULL");
  // the payment time is stamped by the database itself, whichever part of the store marks the order paid
  conn.exec(`CREATE TRIGGER IF NOT EXISTS orders_paid_at_u AFTER UPDATE OF payment_status ON orders WHEN NEW.payment_status = 'paid' AND OLD.payment_status != 'paid'
    BEGIN UPDATE orders SET paid_at = datetime('now') WHERE id = NEW.id; END`);
  conn.exec(`CREATE TRIGGER IF NOT EXISTS orders_paid_at_i AFTER INSERT ON orders WHEN NEW.payment_status = 'paid' AND NEW.paid_at IS NULL
    BEGIN UPDATE orders SET paid_at = datetime('now') WHERE id = NEW.id; END`);
  if (!ocols.has("locale")) conn.exec("ALTER TABLE orders ADD COLUMN locale TEXT");
  if (!ocols.has("confirm_mail_at")) {
    conn.exec("ALTER TABLE orders ADD COLUMN confirm_mail_at TEXT");
    // Orders that existed before this feature never get a late confirmation e-mail.
    conn.exec("UPDATE orders SET confirm_mail_at = 'before-feature'");
  }
  if (!ocols.has("ship_mail_at")) {
    conn.exec("ALTER TABLE orders ADD COLUMN ship_mail_at TEXT");
    // Orders shipped before this feature never get a late "shipped" e-mail.
    conn.exec("UPDATE orders SET ship_mail_at = 'before-feature' WHERE status IN ('shipped','delivered','cancelled')");
  }
  // operations: server error log and the daily orders/payments/refunds reconciliation (new tables only, nothing existing changes)
  conn.exec(`CREATE TABLE IF NOT EXISTS error_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL DEFAULT (datetime('now')), source TEXT NOT NULL, place TEXT NOT NULL DEFAULT '', message TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_error_log_at ON error_log(at);
    CREATE TABLE IF NOT EXISTS web_vitals (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL DEFAULT (datetime('now')), path TEXT NOT NULL, device TEXT NOT NULL, lcp_ms INTEGER NOT NULL, cls_x1000 INTEGER NOT NULL, inp_ms INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_web_vitals_at ON web_vitals(at);
    CREATE TABLE IF NOT EXISTS reconciliations (day TEXT PRIMARY KEY, ran_at TEXT NOT NULL DEFAULT (datetime('now')), orders INTEGER NOT NULL, paid INTEGER NOT NULL,
      paid_minor INTEGER NOT NULL, refunded_minor INTEGER NOT NULL, verified INTEGER NOT NULL, unverified INTEGER NOT NULL, issues_json TEXT NOT NULL DEFAULT '[]');`);
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
  // "who this colour suits" tip, written by the owner per product and shown on the product page
  for (const col of ["tip_ar", "tip_en"]) if (!pcols.has(col)) conn.exec(`ALTER TABLE products ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`);
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
