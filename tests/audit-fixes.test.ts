import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Regression tests for the pre-launch audit fixes. Isolated database in a temp folder; Telr is a stub (no network).
process.env.DATABASE_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "lt-audit-")), "t.db");
process.env.SEED_SAMPLE = "true";

type Db = ReturnType<typeof import("../src/lib/db").db>;
let conn: Db;
let commerce: import("../src/lib/commerce/db-provider").DbCommerceProvider;
let OutOfStockError: typeof import("../src/lib/commerce/db-provider").OutOfStockError;
let rec: typeof import("../src/lib/payment/reconcile");
let admin: typeof import("../src/lib/db/admin");

const meta = { email: "a@b.com", phone: "+971500000000", address: { name: "A", phone: "1", line1: "x", city: "y", country: "AE" } };
let seq = 0;
/** Telr's answer for the next "check" calls. */
let telr: { code: number; tx: string; amount?: string; currency?: string; cartid?: string } = { code: 1, tx: "" };
let telrCalls = 0;

async function makeOrder(opts: { variant?: string; qty?: number; total?: number; coupon?: string; ref?: string | null; key?: string } = {}) {
  const [line] = await commerce.validateLines([{ variantId: opts.variant ?? "audit-v-many", quantity: opts.qty ?? 1 }]);
  const id = `LT-AUD${String(++seq).padStart(9, "0")}`;
  const total = opts.total ?? 100;
  const order = {
    id, createdAt: new Date().toISOString(), status: "new" as const, paymentStatus: "pending" as const,
    lines: [line], subtotal: total, discount: 0, shipping: 0, tax: 0, total, currency: "AED", shippingLabel: { ar: "x", en: "x" }, isMock: true,
  };
  await commerce.saveOrder(order, opts.key ?? `audit-key-${seq}`, { ...meta, couponCode: opts.coupon });
  if (opts.ref !== null) conn.prepare("UPDATE orders SET payment_ref = ? WHERE id = ?").run(opts.ref ?? `REF-${id}`, id);
  return id;
}
const row = (id: string) => conn.prepare("SELECT status, payment_status ps FROM orders WHERE id = ?").get(id) as { status: string; ps: string };
const stock = (v: string) => (conn.prepare("SELECT stock FROM variants WHERE id = ?").get(v) as { stock: number }).stock;
const alerts = (like: string) => (conn.prepare("SELECT COUNT(*) n FROM notifications WHERE kind = 'payment' AND title LIKE ?").get(`%${like}%`) as { n: number }).n;

beforeAll(async () => {
  const dbm = await import("../src/lib/db");
  conn = dbm.db();
  const secrets = await import("../src/lib/secrets");
  dbm.setSetting("pay_telr_enabled", "1");
  dbm.setSetting("pay_telr_store", "12345");
  secrets.setSecret("pay_telr_key", "stub-key");
  conn.prepare("INSERT INTO products (id,slug,name_ar,name_en,price_minor,status,is_sample) VALUES ('audit-p','audit-p','اختبار','Audit',10000,'active',1)").run();
  conn.prepare("INSERT INTO variants (id,product_id,sku,title_ar,title_en,stock) VALUES ('audit-v-many','audit-p','AUD-1','x','x',1000)").run();
  conn.prepare("INSERT INTO variants (id,product_id,sku,title_ar,title_en,stock) VALUES ('audit-v-last','audit-p','AUD-2','x','x',1)").run();
  const mod = await import("../src/lib/commerce/db-provider");
  commerce = new mod.DbCommerceProvider();
  OutOfStockError = mod.OutOfStockError;
  rec = await import("../src/lib/payment/reconcile");
  admin = await import("../src/lib/db/admin");
  vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
    const j = JSON.parse(init.body) as { method: string; order: { ref: string } };
    telrCalls++;
    const id = j.order.ref.replace(/^REF-/, "");
    const o = conn.prepare("SELECT total_minor FROM orders WHERE id = ?").get(id) as { total_minor: number } | undefined;
    return new Response(JSON.stringify({ order: {
      cartid: telr.cartid ?? id, amount: telr.amount ?? ((o?.total_minor ?? 0) / 100).toFixed(2), currency: telr.currency ?? "AED",
      status: { code: telr.code }, transaction: { status: telr.tx },
    } }), { headers: { "content-type": "application/json" } });
  });
});
afterEach(() => { telr = { code: 1, tx: "" }; });

describe("online payment confirmation (server side)", () => {
  it("marks the order paid only when Telr confirms the same order, amount and currency", async () => {
    const id = await makeOrder();
    telr = { code: 1, tx: "" };
    expect(await rec.reconcileOnlinePayment(id)).toBe("pending");
    expect(row(id).ps).toBe("pending");
    telr = { code: 3, tx: "A" };
    expect(await rec.reconcileOnlinePayment(id)).toBe("paid");
    expect(row(id).ps).toBe("paid");
    const before = telrCalls;
    expect(await rec.reconcileOnlinePayment(id)).toBe("paid"); // already paid: no second call to the gateway
    expect(telrCalls).toBe(before);
  });

  it("never marks paid on an amount / currency / order mismatch, and alerts the owner once", async () => {
    const id = await makeOrder({ total: 250 });
    for (const bad of [{ amount: "1.00" }, { currency: "USD" }, { cartid: "LT-SOMEONEELSE" }]) {
      telr = { code: 3, tx: "A", ...bad };
      expect(await rec.reconcileOnlinePayment(id)).toBe("pending");
      expect(row(id).ps).toBe("pending");
    }
    expect(alerts(`لا تطابق الطلب ${id}`)).toBe(1); // three mismatching answers, one alert
  });

  it("a declined payment cancels the order, returns the stock and gives the one-time coupon back", async () => {
    conn.prepare("INSERT INTO coupons(code,kind,value,max_uses,used_count) VALUES ('AUDITONCE','percent',10,1,0)").run();
    const before = stock("audit-v-many");
    const id = await makeOrder({ qty: 3, coupon: "AUDITONCE" });
    expect(stock("audit-v-many")).toBe(before - 3);
    expect((await commerce.validateCoupon("AUDITONCE", 100)).valid).toBe(false); // used up while the order waits
    telr = { code: -3, tx: "D" };
    expect(await rec.reconcileOnlinePayment(id)).toBe("failed");
    expect(row(id)).toEqual({ status: "cancelled", ps: "failed" });
    expect(stock("audit-v-many")).toBe(before);
    expect((await commerce.validateCoupon("AUDITONCE", 100)).valid).toBe(true); // regression: the coupon used to be lost
    // a second "declined" answer must not return stock or the coupon twice
    expect(await rec.reconcileOnlinePayment(id)).toBe("failed");
    expect(stock("audit-v-many")).toBe(before);
    expect((conn.prepare("SELECT used_count u FROM coupons WHERE code='AUDITONCE'").get() as { u: number }).u).toBe(0);
  });

  it("cancelling a PAID order keeps the coupon use", async () => {
    conn.prepare("INSERT INTO coupons(code,kind,value,max_uses,used_count) VALUES ('AUDITPAID','percent',10,1,0)").run();
    const id = await makeOrder({ coupon: "AUDITPAID" });
    telr = { code: 3, tx: "A" };
    await rec.reconcileOnlinePayment(id);
    expect(admin.setOrderStatus(id, "cancelled", null, "refunded")).toBe("ok");
    expect((conn.prepare("SELECT used_count u FROM coupons WHERE code='AUDITPAID'").get() as { u: number }).u).toBe(1);
    expect(admin.setOrderStatus(id, "new", null)).toBe("locked"); // a cancelled order is never re-opened
  });

  it("alerts when a payment arrives for an order that was cancelled in the meantime", async () => {
    const id = await makeOrder();
    admin.setOrderStatus(id, "cancelled", null); // owner cancels while the customer is on the payment page
    telr = { code: 3, tx: "A" };
    expect(await rec.reconcileOnlinePayment(id)).toBe("paid");
    expect(row(id)).toEqual({ status: "cancelled", ps: "paid" });
    expect(alerts(`دفعة وصلت لطلب ملغي ${id}`)).toBe(1);
  });
});

describe("pending-payment sweep (customer never came back from the payment page)", () => {
  it("confirms paid orders, cancels declined ones, and is throttled", async () => {
    conn.prepare("UPDATE orders SET payment_status = 'failed' WHERE payment_status = 'pending'").run(); // clean slate
    conn.prepare("UPDATE orders SET created_at = datetime('now','-10 days') WHERE payment_status = 'failed'").run();
    const paid = await makeOrder();
    const before = stock("audit-v-many");
    telr = { code: 3, tx: "A" };
    const r1 = await rec.reconcilePendingPayments({ minIntervalMs: 0 });
    expect(r1.paid).toBe(1);
    expect(row(paid).ps).toBe("paid");

    const abandoned = await makeOrder({ qty: 2 });
    expect(stock("audit-v-many")).toBe(before - 2);
    telr = { code: -1, tx: "" }; // expired at the gateway
    const calls = telrCalls;
    expect((await rec.reconcilePendingPayments()).checked).toBe(0); // throttled: default is once a minute
    expect(telrCalls).toBe(calls);
    const r2 = await rec.reconcilePendingPayments({ minIntervalMs: 0 });
    expect(r2.failed).toBe(1);
    expect(row(abandoned)).toEqual({ status: "cancelled", ps: "failed" });
    expect(stock("audit-v-many")).toBe(before); // reserved stock is free again
  });

  it("alerts once when Telr shows a payment for an order we cancelled after a declined attempt", async () => {
    conn.prepare("UPDATE orders SET created_at = datetime('now','-10 days') WHERE payment_status = 'failed'").run(); // older failures are out of the 3-day window
    const id = await makeOrder();
    telr = { code: 1, tx: "D" }; // first card declined
    expect(await rec.reconcileOnlinePayment(id)).toBe("failed");
    telr = { code: 3, tx: "A" }; // ...then she paid with another card on the same payment page
    const r = await rec.reconcilePendingPayments({ minIntervalMs: 0 });
    expect(r.alerts).toBe(1);
    expect(alerts(`طلب فشل دفعه ${id}`)).toBe(1);
    expect((await rec.reconcilePendingPayments({ minIntervalMs: 0 })).alerts).toBe(0);
    expect(row(id).ps).toBe("failed"); // the order is not silently re-opened: the owner decides
  });

  it("ignores orders without an online payment reference", async () => {
    const id = await makeOrder({ ref: null });
    expect(await rec.reconcileOnlinePayment(id)).toBe("none");
    expect(row(id).ps).toBe("pending");
  });
});

describe("unpaid orders expire (60 minutes by default)", () => {
  const age = (id: string, minutes: number) => conn.prepare("UPDATE orders SET created_at = datetime('now', ?) WHERE id = ?").run(`-${minutes} minutes`, id);

  it("an order still unpaid after the limit is cancelled and its stock and coupon are freed", async () => {
    conn.prepare("INSERT INTO coupons(code,kind,value,max_uses,used_count) VALUES ('AUDITWAIT','percent',10,1,0)").run();
    const before = stock("audit-v-many");
    const young = await makeOrder({ qty: 2 });
    const old = await makeOrder({ qty: 3, coupon: "AUDITWAIT" });
    age(young, 59); age(old, 61);
    telr = { code: 1, tx: "" }; // Telr: still not paid
    expect(await rec.reconcileOnlinePayment(young)).toBe("pending");
    expect(row(young)).toEqual({ status: "new", ps: "pending" }); // inside the hour: untouched
    expect(await rec.reconcileOnlinePayment(old)).toBe("failed");
    expect(row(old)).toEqual({ status: "cancelled", ps: "failed" });
    expect(stock("audit-v-many")).toBe(before - 2); // only the young order still holds stock
    expect((await commerce.validateCoupon("AUDITWAIT", 100)).valid).toBe(true);
    admin.setOrderStatus(young, "cancelled", null);
  });

  it("a payment that arrives exactly at the limit still wins over the timeout", async () => {
    const id = await makeOrder();
    age(id, 600);
    telr = { code: 3, tx: "A" };
    expect(await rec.reconcileOnlinePayment(id)).toBe("paid");
    expect(row(id)).toEqual({ status: "new", ps: "paid" });
  });

  it("never cancels when Telr can not be reached, or when the bank holds the money", async () => {
    const id = await makeOrder();
    age(id, 600);
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async () => { throw new Error("network down"); });
    expect(await rec.reconcileOnlinePayment(id)).toBe("pending");
    expect(row(id)).toEqual({ status: "new", ps: "pending" });
    vi.stubGlobal("fetch", realFetch);
    telr = { code: 2, tx: "H" }; // authorised, not captured
    expect(await rec.reconcileOnlinePayment(id)).toBe("pending");
    expect(row(id)).toEqual({ status: "new", ps: "pending" });
    expect(alerts(`دفعة معلّقة عند البنك للطلب ${id}`)).toBe(1);
    admin.setOrderStatus(id, "cancelled", null);
  });

  it("an answer from Telr that is not the plain 'pending' one never expires an order", async () => {
    for (const odd of [{ code: 0, tx: "" }, { code: 7, tx: "" }, { code: Number.NaN, tx: "" }, { code: 1, tx: "", cartid: "LT-OTHER" }]) {
      const id = await makeOrder();
      age(id, 600);
      telr = odd;
      expect(await rec.reconcileOnlinePayment(id)).toBe("pending");
      expect(row(id)).toEqual({ status: "new", ps: "pending" });
      expect(alerts(`رد غير مفهوم من Telr للطلب ${id}`)).toBe(1);
      admin.setOrderStatus(id, "cancelled", null);
    }
  });

  it("the limit is an admin setting: 0 switches it off, bad values fall back to 60", async () => {
    const { setSetting } = await import("../src/lib/db");
    expect(rec.pendingTimeoutMinutes()).toBe(60);
    for (const [v, want] of [["0", 0], ["abc", 60], ["-5", 60], ["5", 15], ["120", 120]] as const) { setSetting("pay_pending_timeout_min", v); expect(rec.pendingTimeoutMinutes()).toBe(want); }
    setSetting("pay_pending_timeout_min", "0");
    const id = await makeOrder();
    age(id, 600);
    telr = { code: 1, tx: "" };
    expect(await rec.reconcileOnlinePayment(id)).toBe("pending");
    setSetting("pay_pending_timeout_min", "60");
    expect(await rec.reconcileOnlinePayment(id)).toBe("failed");
  });

  it("orders created by the owner without an online payment never expire", async () => {
    const id = await makeOrder({ ref: null });
    age(id, 6000);
    expect(await rec.reconcileOnlinePayment(id)).toBe("none");
    expect(row(id)).toEqual({ status: "new", ps: "pending" });
    admin.setOrderStatus(id, "cancelled", null);
  });
});

describe("financial records", () => {
  it("a paid or refunded real order can not be deleted; unpaid and sample orders can", () => {
    expect(admin.orderDeletable({ payment_status: "paid", is_mock: 0 })).toBe(false);
    expect(admin.orderDeletable({ payment_status: "refunded", is_mock: 0 })).toBe(false);
    expect(admin.orderDeletable({ payment_status: "pending", is_mock: 0 })).toBe(true);
    expect(admin.orderDeletable({ payment_status: "failed", is_mock: 0 })).toBe(true);
    expect(admin.orderDeletable({ payment_status: "paid", is_mock: 1 })).toBe(true);
  });

  it("the background payment watch starts once and can be switched off", async () => {
    const { startPaymentWatch } = await import("../src/lib/payment/watch");
    process.env.PAYMENT_WATCH_MS = "0";
    expect(startPaymentWatch()).toBe(false);
    process.env.PAYMENT_WATCH_MS = "3600000";
    expect(startPaymentWatch()).toBe(true);
    expect(startPaymentWatch()).toBe(false); // already running
  });
});

describe("stock, idempotency and coupons at the database layer", () => {
  it("the last piece can be sold once only", async () => {
    await makeOrder({ variant: "audit-v-last" });
    expect(stock("audit-v-last")).toBe(0);
    const [line] = await commerce.validateLines([{ variantId: "audit-v-last", quantity: 1 }]);
    expect(line.status).toBe("out_of_stock");
    const order = { id: "LT-AUDLAST00002", createdAt: "", status: "new" as const, paymentStatus: "pending" as const, lines: [{ ...line, quantity: 1 }], subtotal: 100, discount: 0, shipping: 0, tax: 0, total: 100, currency: "AED", shippingLabel: { ar: "x", en: "x" }, isMock: true };
    await expect(commerce.saveOrder(order, "audit-last-2", meta)).rejects.toBeInstanceOf(OutOfStockError);
    expect(stock("audit-v-last")).toBe(0); // never negative
  });

  it("a repeated idempotency key creates no second order and takes no stock", async () => {
    const before = stock("audit-v-many");
    const id = await makeOrder({ key: "audit-same-key" });
    expect(stock("audit-v-many")).toBe(before - 1);
    await expect(makeOrder({ key: "audit-same-key" })).rejects.toThrow(/UNIQUE/);
    expect(stock("audit-v-many")).toBe(before - 1); // the failed attempt rolled back completely
    expect((await commerce.findOrderByKey("audit-same-key"))?.id).toBe(id);
    expect((conn.prepare("SELECT COUNT(*) n FROM orders WHERE idempotency_key = 'audit-same-key'").get() as { n: number }).n).toBe(1);
  });

  it("an exhausted coupon stops the order and leaves stock untouched", async () => {
    conn.prepare("INSERT INTO coupons(code,kind,value,max_uses,used_count) VALUES ('AUDITFULL','fixed',5,1,1)").run();
    const before = stock("audit-v-many");
    await expect(makeOrder({ coupon: "AUDITFULL" })).rejects.toThrow("coupon_exhausted");
    expect(stock("audit-v-many")).toBe(before);
  });

  it("coupon discount can never exceed the subtotal, and minimum subtotal is enforced", async () => {
    conn.prepare("INSERT INTO coupons(code,kind,value,min_subtotal_minor) VALUES ('AUDITBIG','fixed',500,5000)").run();
    expect((await commerce.validateCoupon("AUDITBIG", 49.99)).valid).toBe(false);
    expect(await commerce.validateCoupon("auditbig", 80)).toEqual({ valid: true, code: "AUDITBIG", discount: 80 });
  });

  it("unpriced, inactive and unknown products can not be bought; quantity is clamped", async () => {
    conn.prepare("INSERT INTO products (id,slug,name_ar,name_en,price_minor,status) VALUES ('audit-free','audit-free','x','x',0,'active'),('audit-draft','audit-draft','x','x',9900,'draft')").run();
    conn.prepare("INSERT INTO variants (id,product_id,sku,title_ar,title_en,stock) VALUES ('audit-v-free','audit-free','AUD-3','x','x',5),('audit-v-draft','audit-draft','AUD-4','x','x',5)").run();
    const r = await commerce.validateLines([
      { variantId: "audit-v-free", quantity: 1 }, { variantId: "audit-v-draft", quantity: 1 }, { variantId: "nope", quantity: 1 },
      { variantId: "audit-v-many", quantity: 99 }, { variantId: "audit-v-many", quantity: -5 },
    ]);
    expect(r.map((l) => l.status)).toEqual(["out_of_stock", "not_found", "not_found", "limited", "ok"]);
    expect(r[3].quantity).toBe(10); // max 10 per line
    expect(r[4].quantity).toBe(1); // a negative quantity can never reduce the total
  });
});

describe("totals", () => {
  it("never go negative and stay exact to the fils", async () => {
    const { computeTotals, sumLines } = await import("../src/lib/commerce/totals");
    expect(computeTotals({ subtotal: 50, discount: 80, shipping: 10, taxRate: 0, taxInclusive: true }).total).toBe(10);
    expect(sumLines([{ unitPrice: 19.99, quantity: 3 }, { unitPrice: 0.01, quantity: 7 }])).toBe(60.04);
    const t = computeTotals({ subtotal: 199.99, discount: 20, shipping: 15, taxRate: 5, taxInclusive: false });
    expect(t.tax).toBe(9.75);
    expect(t.total).toBe(204.74);
    expect(Math.round(t.total * 100)).toBe(20474); // what is sent to the gateway equals what is stored
  });
});

describe("hardening", () => {
  it("the rate limiter forgets finished windows (no unbounded memory growth)", async () => {
    const { rateLimited, rateLimitKeys } = await import("../src/lib/auth/guards");
    for (let i = 0; i < 6000; i++) rateLimited(`audit-flood:${i}`, 5, 1);
    await new Promise((r) => setTimeout(r, 10));
    rateLimited("audit-flood:last", 5, 1);
    expect(rateLimitKeys()).toBeLessThan(5100);
    for (let i = 0; i < 5; i++) expect(rateLimited("audit-keep", 5, 60_000)).toBe(false);
    expect(rateLimited("audit-keep", 5, 60_000)).toBe(true); // limits still work
  });

  it("the password-reset e-mail escapes the customer's name", async () => {
    const { resetEmail } = await import("../src/lib/email");
    const m = resetEmail("en", `<img src=x onerror=alert(1)>"Sara"`, "https://litore.store/en/account/reset?token=abc");
    expect(m.html).not.toContain("<img");
    expect(m.html).toContain("&lt;img");
    expect(m.html).toContain("https://litore.store/en/account/reset?token=abc");
  });

  it("a courier shipment is created once per order", async () => {
    const { alreadyShippedWith } = await import("../src/lib/shipping/guard");
    expect(alreadyShippedWith({ carrier: null, tracking_number: null }, "aramex")).toBe(false);
    expect(alreadyShippedWith(undefined, "aramex")).toBe(false);
    expect(alreadyShippedWith({ carrier: "aramex", tracking_number: "4455667788" }, "aramex")).toBe(true); // second click is refused
    expect(alreadyShippedWith({ carrier: "emx", tracking_number: "QQ1" }, "aramex")).toBe(false); // switching courier is still allowed
    expect(alreadyShippedWith({ carrier: "quiqup", carrier_ref: "701", tracking_number: null }, "quiqup")).toBe(true);
  });

  it("the Quiqup webhook accepts only a fresh, correctly signed body", async () => {
    const { createHmac } = await import("node:crypto");
    const { verifyQuiqupWebhook } = await import("../src/lib/shipping/quiqup");
    const now = 1_800_000_000_000; const ts = String(Math.floor(now / 1000)); const raw = '{"payload":{"id":7,"state":"delivery_complete"}}';
    const sig = createHmac("sha256", "whsec").update(`${ts}.${raw}`).digest("hex");
    expect(verifyQuiqupWebhook(raw, sig, ts, "whsec", now)).toBe(true);
    expect(verifyQuiqupWebhook(raw + " ", sig, ts, "whsec", now)).toBe(false); // body changed
    expect(verifyQuiqupWebhook(raw, sig, ts, "other", now)).toBe(false); // wrong secret
    expect(verifyQuiqupWebhook(raw, sig, ts, "", now)).toBe(false); // no secret saved => everything refused
    expect(verifyQuiqupWebhook(raw, sig, ts, "whsec", now + 6 * 60_000)).toBe(false); // replay after 5 minutes
    expect(verifyQuiqupWebhook(raw, null, ts, "whsec", now)).toBe(false);
  });

  it("cancelling twice returns the stock once, and a cancelled order can not be re-opened", async () => {
    const before = stock("audit-v-many");
    const id = await makeOrder({ qty: 2, ref: null });
    expect(stock("audit-v-many")).toBe(before - 2);
    expect(admin.setOrderStatus(id, "cancelled", null)).toBe("ok");
    expect(admin.setOrderStatus(id, "cancelled", null)).toBe("ok");
    expect(stock("audit-v-many")).toBe(before);
    expect(admin.setOrderStatus(id, "shipped", null)).toBe("locked");
    expect(row(id).status).toBe("cancelled");
  });

  it("the sales figure counts paid, not-cancelled orders only", async () => {
    const sum = () => (conn.prepare("SELECT COALESCE(SUM(total_minor),0) n FROM orders WHERE payment_status = 'paid' AND status != 'cancelled'").get() as { n: number }).n / 100;
    const start = admin.dashboardStats().revenue;
    expect(start).toBe(sum());
    const paid = await makeOrder({ total: 150, ref: null });
    await makeOrder({ total: 70, ref: null }); // stays unpaid
    admin.setOrderStatus(paid, "new", null, "paid");
    expect(admin.dashboardStats().revenue).toBe(start + 150);
    admin.setOrderStatus(paid, "cancelled", null);
    expect(admin.dashboardStats().revenue).toBe(start);
  });

  it("an upload is accepted only when its bytes are a real image; the stored name is never the visitor's", async () => {
    process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "lt-up-"));
    const { saveImage } = await import("../src/lib/uploads");
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
    const good = await saveImage(new File([png], "../../evil.php", { type: "image/png" }));
    expect(good.ok).toBe(true);
    if (good.ok) { expect(good.name).toMatch(/^[a-f0-9-]{36}\.png$/); expect(fs.readdirSync(process.env.UPLOAD_DIR!)).toEqual([good.name]); }
    expect(await saveImage(new File(["<?php echo 1; ?>"], "photo.png", { type: "image/png" }))).toEqual({ ok: false, error: "bad_type" });
    expect(await saveImage(new File(["<svg onload=alert(1)>"], "x.svg", { type: "image/svg+xml" }))).toEqual({ ok: false, error: "bad_type" });
    expect(await saveImage(new File([], "empty.png"))).toEqual({ ok: false, error: "empty" });
    expect(await saveImage(new File([Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)])], "big.png"))).toEqual({ ok: false, error: "too_large" });
    expect(fs.readdirSync(process.env.UPLOAD_DIR!).length).toBe(1);
  });
});
