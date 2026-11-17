import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Order confirmation e-mail: isolated database, the e-mail service is a stub (nothing is sent).
process.env.DATABASE_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "lt-mail-")), "t.db");
process.env.RESEND_API_KEY = "unit-key";

type Db = ReturnType<typeof import("../src/lib/db").db>;
let conn: Db;
let mail: typeof import("../src/lib/order-mail");
let sent: { to: string[]; subject: string; html: string }[] = [];
let serviceUp = true;
let seq = 0;

function makeOrder(o: { ps?: string; status?: string; locale?: string | null; name?: string; mark?: string | null; age?: string } = {}) {
  const id = `LT-MAIL${String(++seq).padStart(6, "0")}`;
  conn.prepare(`INSERT INTO orders (id,email,phone,status,payment_status,subtotal_minor,total_minor,currency,shipping_label_ar,shipping_label_en,address_json,idempotency_key,locale,confirm_mail_at,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now', ?))`).run(id, `c${seq}@example.com`, "+971500000000", o.status ?? "new", o.ps ?? "paid", 10000, 12500, "AED", "x", "x",
    JSON.stringify({ name: o.name ?? "Sara" }), `mail-${seq}`, o.locale === undefined ? "ar" : o.locale, o.mark ?? null, o.age ?? "-0 minutes");
  conn.prepare("INSERT INTO order_lines (order_id,variant_id,product_id,slug,name_ar,name_en,sku,unit_minor,quantity) VALUES (?,?,?,?,?,?,?,?,?)").run(id, "v", "p", "s", "عدسات <b>وردي</b>", "Rose lenses", "SKU", 10000, 1);
  return id;
}
const mark = (id: string) => (conn.prepare("SELECT confirm_mail_at c FROM orders WHERE id = ?").get(id) as { c: string | null }).c;

beforeAll(async () => {
  conn = (await import("../src/lib/db")).db();
  mail = await import("../src/lib/order-mail");
  vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
    if (!serviceUp) return { ok: false, status: 500 };
    sent.push(JSON.parse(init.body));
    return { ok: true, status: 200 };
  });
});
beforeEach(() => { sent = []; serviceUp = true; process.env.RESEND_API_KEY = "unit-key"; });

describe("order confirmation e-mail", () => {
  it("is sent once for a paid order, in the customer's language, with the order number, total and link", async () => {
    const id = makeOrder();
    expect(await mail.sendOrderConfirmation(id)).toBe("sent");
    expect(await mail.sendOrderConfirmation(id)).toBe("skipped");
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toEqual([`c${seq}@example.com`]);
    expect(sent[0].subject).toContain(id);
    expect(sent[0].html).toContain('dir="rtl"');
    expect(sent[0].html).toContain("125.00 AED");
    expect(sent[0].html).toContain(`/ar/order/${id}`);
    expect(sent[0].html).toContain("&lt;b&gt;"); // product name is escaped
    expect(mark(id)).not.toBeNull();
  });

  it("two callers at the same moment still send one e-mail", async () => {
    const id = makeOrder({ locale: "en" });
    const r = await Promise.all([mail.sendOrderConfirmation(id), mail.sendOrderConfirmation(id), mail.sendOrderConfirmation(id)]);
    expect(r.filter((x) => x === "sent")).toHaveLength(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].html).toContain('dir="ltr"');
  });

  it("is never sent for unpaid, failed, refunded or cancelled orders", async () => {
    for (const o of [{ ps: "pending" }, { ps: "failed" }, { ps: "refunded" }, { ps: "paid", status: "cancelled" }]) {
      expect(await mail.sendOrderConfirmation(makeOrder(o))).toBe("skipped");
    }
    expect(sent).toHaveLength(0);
  });

  it("a failing e-mail service leaves the order untouched and the e-mail is retried later, once", async () => {
    serviceUp = false;
    const id = makeOrder();
    expect(await mail.sendOrderConfirmation(id)).toBe("failed");
    expect(mark(id)).toBeNull();
    expect((conn.prepare("SELECT payment_status p FROM orders WHERE id = ?").get(id) as { p: string }).p).toBe("paid");
    serviceUp = true;
    expect(await mail.sendPendingOrderConfirmations()).toBe(1);
    expect(await mail.sendPendingOrderConfirmations()).toBe(0);
    expect(sent).toHaveLength(1);
  });

  it("orders from before the feature, and orders older than two days, never get a late e-mail", async () => {
    makeOrder({ mark: "before-feature" });
    makeOrder({ age: "-3 days" });
    expect(await mail.sendPendingOrderConfirmations()).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("does nothing when no e-mail service key is configured", async () => {
    delete process.env.RESEND_API_KEY;
    const id = makeOrder();
    expect(await mail.sendOrderConfirmation(id)).toBe("skipped");
    expect(await mail.sendPendingOrderConfirmations()).toBe(0);
    expect(mark(id)).toBeNull();
    expect(sent).toHaveLength(0);
  });

  it("an existing database gets the new columns and its old orders are marked as already handled", async () => {
    const Database = (await import("better-sqlite3")).default;
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "lt-mig-")), "old.db");
    conn.exec(`VACUUM INTO '${file}'`); // a full copy (the live file alone would miss the WAL)
    const old = new Database(file);
    old.exec("ALTER TABLE orders DROP COLUMN confirm_mail_at; ALTER TABLE orders DROP COLUMN locale;");
    const n = (old.prepare("SELECT COUNT(*) n FROM orders").get() as { n: number }).n;
    old.close();
    const g = globalThis as unknown as { __litoreDb?: unknown };
    const keep = g.__litoreDb; const keepPath = process.env.DATABASE_PATH;
    g.__litoreDb = undefined; process.env.DATABASE_PATH = file;
    try {
      const migrated = (await import("../src/lib/db")).db();
      const r = migrated.prepare("SELECT COUNT(*) n, SUM(confirm_mail_at = 'before-feature') done FROM orders").get() as { n: number; done: number };
      expect(n).toBeGreaterThan(0);
      expect(r).toEqual({ n, done: n });
    } finally { g.__litoreDb = keep; process.env.DATABASE_PATH = keepPath; }
  });
});
