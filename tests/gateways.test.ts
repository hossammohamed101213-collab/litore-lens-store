import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Paymennt + Ziina: isolated database, the gateways are stubs (nothing is charged).
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lt-gw-"));
process.env.DATABASE_PATH = path.join(dir, "t.db");
process.env.SECRET_KEY_FILE = path.join(dir, "secret.key");

type Db = ReturnType<typeof import("../src/lib/db").db>;
let conn: Db;
let rec: typeof import("../src/lib/payment/reconcile");
let lib: typeof import("../src/lib/db");
let sec: typeof import("../src/lib/secrets");
let calls: string[] = [];
let paymennt: { status?: string; grandtotal?: number; currency?: string; orderId?: string } | "down" = {};
let ziina: { status?: string; amount?: number; currency_code?: string } | "down" = {};
let seq = 0;

function makeOrder(o: { gateway?: string | null; total?: number; age?: string; status?: string } = {}) {
  const id = `LT-${String(++seq).padStart(12, "A")}`;
  conn.prepare(`INSERT INTO orders (id,email,phone,status,payment_status,subtotal_minor,total_minor,currency,shipping_label_ar,shipping_label_en,address_json,idempotency_key,payment_ref,payment_gateway,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now', ?))`).run(id, `g${seq}@example.com`, "+971500000000", o.status ?? "new", "pending", 10000, o.total ?? 12500, "AED", "x", "x",
    JSON.stringify({ name: "Sara" }), `gw-${seq}`, `REF-${seq}`, o.gateway === undefined ? "paymennt" : o.gateway, o.age ?? "-1 minutes");
  return id;
}
const row = (id: string) => conn.prepare("SELECT status, payment_status ps FROM orders WHERE id = ?").get(id) as { status: string; ps: string };
const alerts = (id: string) => (conn.prepare("SELECT COUNT(*) n FROM notifications WHERE kind = 'payment' AND title LIKE ?").get(`%${id}%`) as { n: number }).n;
const env = process.env as Record<string, string | undefined>;

beforeAll(async () => {
  lib = await import("../src/lib/db");
  conn = lib.db();
  sec = await import("../src/lib/secrets");
  rec = await import("../src/lib/payment/reconcile");
  vi.stubGlobal("fetch", async (url: string) => {
    calls.push(String(url));
    const u = String(url);
    if (u.includes("paymennt")) { if (paymennt === "down") throw new Error("network"); return { ok: true, status: 200, json: async () => ({ success: true, result: paymennt }) }; }
    if (u.includes("ziina")) { if (ziina === "down") throw new Error("network"); return { ok: true, status: 200, json: async () => ziina }; }
    return { ok: false, status: 500, json: async () => ({}), text: async () => "" };
  });
});
beforeEach(() => {
  calls = [];
  for (const k of ["pay_paymennt_enabled", "pay_ziina_enabled", "pay_telr_enabled"]) lib.setSetting(k, "0");
  sec.setSecret("pay_paymennt_key", "PM-KEY"); sec.setSecret("pay_paymennt_secret", "PM-SECRET"); sec.setSecret("pay_ziina_key", "ZN-KEY");
  lib.setSetting("pay_paymennt_enabled", "1");
});

describe("which payment methods the store offers", () => {
  it("a live server with no gateway never offers the free sample payment", async () => {
    const { paymentOptions } = await import("../src/lib/payment/mode");
    lib.setSetting("pay_paymennt_enabled", "0");
    const before = { mode: env.PAYMENT_MODE, node: env.NODE_ENV };
    try {
      delete env.PAYMENT_MODE;
      env.NODE_ENV = "production";
      expect(paymentOptions()).toEqual({ online: false, mock: false });
      lib.setSetting("pay_ziina_enabled", "1");
      expect(paymentOptions()).toEqual({ online: true, mock: false });
      lib.setSetting("pay_ziina_enabled", "0");
      env.NODE_ENV = "development";
      expect(paymentOptions()).toEqual({ online: false, mock: true });
    } finally { env.PAYMENT_MODE = before.mode; env.NODE_ENV = before.node; }
  });

  it("gateway keys are stored encrypted, and a switched-off gateway is not offered but can still check its old orders", async () => {
    const { paymenntConfig } = await import("../src/lib/payment/paymennt");
    const { ziinaConfig } = await import("../src/lib/payment/ziina");
    for (const k of ["pay_paymennt_key", "pay_paymennt_secret", "pay_ziina_key"]) {
      const v = lib.getSetting(k);
      expect(v.startsWith("enc:")).toBe(true);
      expect(v).not.toContain("KEY");
    }
    lib.setSetting("pay_paymennt_key", "plain-text-key"); // a key saved without encryption is never used
    expect(paymenntConfig()).toBeNull();
    sec.setSecret("pay_paymennt_key", "PM-KEY");
    expect(paymenntConfig()?.apiKey).toBe("PM-KEY");
    expect(ziinaConfig()).toBeNull();
    expect(ziinaConfig(true)?.apiKey).toBe("ZN-KEY");
  });
});

describe("Paymennt orders", () => {
  it("are marked paid only for the same order, amount and currency", async () => {
    const id = makeOrder();
    paymennt = { status: "PAID", grandtotal: 125, currency: "AED", orderId: id };
    expect(await rec.reconcileOnlinePayment(id)).toBe("paid");
    expect(row(id).ps).toBe("paid");
    for (const bad of [{ grandtotal: 1 }, { currency: "USD" }, { orderId: "LT-OTHER" }]) {
      const o = makeOrder();
      paymennt = { status: "PAID", grandtotal: 125, currency: "AED", orderId: o, ...bad };
      expect(await rec.reconcileOnlinePayment(o)).toBe("pending");
      expect(row(o).ps).toBe("pending");
      expect(alerts(o)).toBe(1);
      await rec.reconcileOnlinePayment(o);
      expect(alerts(o)).toBe(1); // the alert is not repeated
    }
  });

  it("failed / cancelled / expired at Paymennt cancels the order; a connection problem never does", async () => {
    for (const status of ["FAILED", "CANCELLED", "EXPIRED"]) {
      const id = makeOrder();
      paymennt = { status, orderId: id };
      expect(await rec.reconcileOnlinePayment(id)).toBe("failed");
      expect(row(id)).toEqual({ status: "cancelled", ps: "failed" });
    }
    const id = makeOrder({ age: "-3 hours" });
    paymennt = "down";
    expect(await rec.reconcileOnlinePayment(id)).toBe("pending");
    expect(row(id)).toEqual({ status: "new", ps: "pending" });
  });

  it("unpaid after the waiting time: cancelled only when Paymennt plainly says nothing was paid", async () => {
    const young = makeOrder({ age: "-10 minutes" });
    paymennt = { status: "PENDING", orderId: young };
    expect(await rec.reconcileOnlinePayment(young)).toBe("pending");
    const old = makeOrder({ age: "-61 minutes" });
    paymennt = { status: "PENDING", orderId: old };
    expect(await rec.reconcileOnlinePayment(old)).toBe("failed");
    expect(row(old).status).toBe("cancelled");
    for (const status of ["AUTHORIZED", "SOMETHING_NEW", undefined]) {
      const o = makeOrder({ age: "-61 minutes" });
      paymennt = { status, orderId: o };
      expect(await rec.reconcileOnlinePayment(o)).toBe("pending");
      expect(row(o)).toEqual({ status: "new", ps: "pending" });
      expect(alerts(o)).toBe(1);
    }
  });

  it("are still checked after the owner switches Paymennt off", async () => {
    const id = makeOrder();
    lib.setSetting("pay_paymennt_enabled", "0");
    paymennt = { status: "PAID", grandtotal: 125, currency: "AED", orderId: id };
    expect(await rec.reconcileOnlinePayment(id)).toBe("paid");
  });
});

describe("Ziina orders", () => {
  it("completed with the same amount (in fils) is paid; a different amount is not", async () => {
    const id = makeOrder({ gateway: "ziina" });
    ziina = { status: "completed", amount: 12500, currency_code: "AED" };
    expect(await rec.reconcileOnlinePayment(id)).toBe("paid");
    expect(calls.some((c) => c.includes("ziina")) && !calls.some((c) => c.includes("paymennt"))).toBe(true);
    const bad = makeOrder({ gateway: "ziina" });
    ziina = { status: "completed", amount: 125, currency_code: "AED" };
    expect(await rec.reconcileOnlinePayment(bad)).toBe("pending");
    expect(alerts(bad)).toBe(1);
  });

  it("failed or cancelled cancels the order; a payment still in progress is never cancelled automatically", async () => {
    for (const status of ["failed", "canceled"]) {
      const id = makeOrder({ gateway: "ziina" });
      ziina = { status };
      expect(await rec.reconcileOnlinePayment(id)).toBe("failed");
    }
    const idle = makeOrder({ gateway: "ziina", age: "-61 minutes" });
    ziina = { status: "requires_payment_instrument" };
    expect(await rec.reconcileOnlinePayment(idle)).toBe("failed");
    for (const status of ["pending", "requires_user_action"]) {
      const o = makeOrder({ gateway: "ziina", age: "-61 minutes" });
      ziina = { status };
      expect(await rec.reconcileOnlinePayment(o)).toBe("pending");
      expect(row(o).status).toBe("new");
      expect(alerts(o)).toBe(1);
    }
  });

  it("the customer is sent back through the store's own check, whatever she clicked", async () => {
    const { createZiinaPaymentIntent } = await import("../src/lib/payment/ziina");
    let sentBody = "";
    const prev = globalThis.fetch;
    vi.stubGlobal("fetch", async (_u: string, init: { body: string }) => { sentBody = init.body; return { ok: true, status: 200, json: async () => ({ id: "pi_1", redirect_url: "https://pay.example/1" }) }; });
    try {
      const r = await createZiinaPaymentIntent({ apiKey: "k", test: true }, { orderId: "LT-ABCDEF123456", amountMajor: 125.5, currency: "AED", locale: "en" });
      const b = JSON.parse(sentBody);
      expect(r).toEqual({ id: "pi_1", url: "https://pay.example/1" });
      expect(b.amount).toBe(12550);
      for (const k of ["success_url", "cancel_url", "failure_url"]) expect(b[k]).toContain("/api/payment/ziina/return?order=LT-ABCDEF123456&l=en");
    } finally { vi.stubGlobal("fetch", prev); }
  });
});

describe("mixing gateways", () => {
  it("an order is only ever checked with the gateway that took it", async () => {
    const telrOrder = makeOrder({ gateway: null });
    paymennt = { status: "PAID", grandtotal: 125, currency: "AED", orderId: telrOrder };
    expect(await rec.reconcileOnlinePayment(telrOrder)).toBe("pending"); // Telr is not configured here: left alone
    expect(calls.some((c) => c.includes("paymennt"))).toBe(false);
    expect(row(telrOrder).ps).toBe("pending");
  });

  it("the background check runs when Ziina is the only gateway", async () => {
    lib.setSetting("pay_paymennt_enabled", "0");
    conn.prepare("UPDATE orders SET payment_status = 'failed' WHERE payment_status = 'pending'").run();
    const id = makeOrder({ gateway: "ziina" });
    ziina = { status: "completed", amount: 12500, currency_code: "AED" };
    const out = await rec.reconcilePendingPayments({ minIntervalMs: 0 });
    expect(out.paid).toBe(1);
    expect(row(id).ps).toBe("paid");
  });
});

describe("Paymennt webhook signature", () => {
  it("accepts only a fresh, correctly signed message", async () => {
    const { verifyPaymenntWebhook } = await import("../src/lib/payment/paymennt");
    const secret = Buffer.from("webhook-secret").toString("base64");
    const body = JSON.stringify({ type: "checkout.paid" });
    const now = String(Math.floor(Date.now() / 1000));
    const sign = (ts: string, b = body) => "v1," + createHmac("sha256", Buffer.from(secret, "base64")).update(`msg_1.${ts}.${b}`).digest("base64");
    expect(verifyPaymenntWebhook(body, { messageId: "msg_1", timestamp: now, signature: sign(now) }, "whsec_" + secret)).toBe(true);
    expect(verifyPaymenntWebhook(body + " ", { messageId: "msg_1", timestamp: now, signature: sign(now) }, secret)).toBe(false);
    expect(verifyPaymenntWebhook(body, { messageId: "msg_1", timestamp: now, signature: "v1,AAAA" }, secret)).toBe(false);
    const old = String(Math.floor(Date.now() / 1000) - 3600);
    expect(verifyPaymenntWebhook(body, { messageId: "msg_1", timestamp: old, signature: sign(old) }, secret)).toBe(false);
    expect(verifyPaymenntWebhook(body, { messageId: null, timestamp: now, signature: sign(now) }, secret)).toBe(false);
    expect(verifyPaymenntWebhook(body, { messageId: "msg_1", timestamp: now, signature: sign(now) }, "")).toBe(false);
  });
});
