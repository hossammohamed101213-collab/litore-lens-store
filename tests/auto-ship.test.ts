import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Automatic shipping: a paid order goes to Quiqup by itself. Isolated database; Paymennt and Quiqup are stubs.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lt-auto-"));
process.env.DATABASE_PATH = path.join(dir, "t.db");
process.env.SECRET_KEY_FILE = path.join(dir, "secret.key");

type Db = ReturnType<typeof import("../src/lib/db").db>;
let conn: Db;
let rec: typeof import("../src/lib/payment/reconcile");
let auto: typeof import("../src/lib/shipping/auto-ship");
let lib: typeof import("../src/lib/db");
let sec: typeof import("../src/lib/secrets");
let quiqupCalls: { partner_order_id: string; uuid: string }[] = [];
let quiqup: "ok" | "down" | "refuse" = "ok";
let paid: { status: string; amount: number; currency: string; orderId: string };
let seq = 0;

function makeOrder(o: { country?: string; status?: string; pay?: string } = {}) {
  const id = `LT-${String(++seq).padStart(12, "B")}`;
  conn.prepare(`INSERT INTO orders (id,email,phone,status,payment_status,subtotal_minor,total_minor,currency,shipping_label_ar,shipping_label_en,address_json,idempotency_key,payment_ref,payment_gateway,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now','-1 minutes'))`).run(id, `a${seq}@example.com`, "+971500000000", o.status ?? "new", o.pay ?? "pending", 10000, 12500, "AED", "x", "x",
    JSON.stringify({ name: "Sara Ali", phone: "+971500000000", line1: "Street 1", city: "Dubai", country: o.country ?? "AE" }), `auto-${seq}`, `REF-${seq}`, "paymennt");
  return id;
}
const row = (id: string) => conn.prepare("SELECT status, payment_status ps, carrier, carrier_ref ref, tracking_number t FROM orders WHERE id = ?").get(id) as { status: string; ps: string; carrier: string | null; ref: string | null; t: string | null };
const notes = (like: string) => (conn.prepare("SELECT COUNT(*) n FROM notifications WHERE kind = 'shipping' AND title LIKE ?").get(like) as { n: number }).n;
const settle = () => new Promise((r) => setTimeout(r, 30));

beforeAll(async () => {
  lib = await import("../src/lib/db");
  conn = lib.db();
  sec = await import("../src/lib/secrets");
  rec = await import("../src/lib/payment/reconcile");
  auto = await import("../src/lib/shipping/auto-ship");
  vi.stubGlobal("fetch", async (url: string, init?: { body?: string }) => {
    const u = String(url);
    if (u.includes("paymennt")) return { ok: true, status: 200, json: async () => ({ success: true, result: paid }) };
    if (u.includes("quiqup")) {
      if (quiqup === "down") throw new Error("network");
      if (quiqup === "refuse") return { ok: false, status: 422, json: async () => ({ api_error: { message: "bad address" } }) };
      const j = JSON.parse(init?.body ?? "{}");
      quiqupCalls.push(j);
      return { ok: true, status: 201, json: async () => ({ order: { id: 900 + quiqupCalls.length, uuid: j.uuid } }) };
    }
    return { ok: false, status: 500, json: async () => ({}), text: async () => "" };
  });
  sec.setSecret("pay_paymennt_key", "PM-KEY"); sec.setSecret("pay_paymennt_secret", "PM-SECRET"); lib.setSetting("pay_paymennt_enabled", "1");
  sec.setSecret("car_quiqup_key", "QQ-KEY"); lib.setSetting("car_quiqup_enabled", "1"); lib.setSetting("car_quiqup_mode", "test");
  lib.setSetting("ship_phone", "0527645570"); lib.setSetting("ship_line1", "Abu Dhabi, Office 1"); lib.setSetting("ship_city", "Abu Dhabi");
});
beforeEach(() => { quiqupCalls = []; quiqup = "ok"; lib.setSetting("car_quiqup_auto", "1"); });

describe("automatic shipping after payment", () => {
  it("is off unless the owner switches it on", async () => {
    lib.setSetting("car_quiqup_auto", "0");
    const id = makeOrder();
    paid = { status: "Paid", amount: 125, currency: "AED", orderId: id };
    expect(await rec.reconcileOnlinePayment(id)).toBe("paid");
    await settle();
    expect(quiqupCalls.length).toBe(0);
    expect(row(id).status).toBe("new");
  });

  it("sends a confirmed payment to Quiqup once and marks the order shipped", async () => {
    const id = makeOrder();
    paid = { status: "Paid", amount: 125, currency: "AED", orderId: id };
    expect(await rec.reconcileOnlinePayment(id)).toBe("paid");
    await settle();
    expect(quiqupCalls.map((c) => c.partner_order_id)).toEqual([id]);
    const r = row(id);
    expect(r.status).toBe("shipped");
    expect(r.carrier).toBe("quiqup");
    expect(r.ref).toBe("901");
    expect(r.t).toBe(quiqupCalls[0].uuid);
    // asking again never creates a second shipment
    expect(await auto.autoShipPaidOrder(id)).toBe("skipped");
    expect(quiqupCalls.length).toBe(1);
  });

  it("never ships an order that is not paid, is cancelled, or was already shipped by hand", async () => {
    const unpaid = makeOrder();
    expect(await auto.autoShipPaidOrder(unpaid)).toBe("skipped");
    const cancelled = makeOrder({ status: "cancelled", pay: "paid" });
    expect(await auto.autoShipPaidOrder(cancelled)).toBe("skipped");
    const manual = makeOrder({ pay: "paid" });
    conn.prepare("UPDATE orders SET tracking_number = 'TYPED-1' WHERE id = ?").run(manual);
    expect(await auto.autoShipPaidOrder(manual)).toBe("skipped");
    // a payment that does not match the order is not marked paid, so it is not shipped
    const wrong = makeOrder();
    paid = { status: "Paid", amount: 1, currency: "AED", orderId: wrong };
    expect(await rec.reconcileOnlinePayment(wrong)).toBe("pending");
    await settle();
    expect(quiqupCalls.length).toBe(0);
  });

  it("leaves the order for the owner and tells her once when Quiqup cannot take it", async () => {
    for (const mode of ["down", "refuse"] as const) {
      quiqup = mode;
      const id = makeOrder({ pay: "paid" });
      expect(await auto.autoShipPaidOrder(id)).toBe("failed");
      expect(await auto.autoShipPaidOrder(id)).toBe("failed");
      expect(row(id).status).toBe("new");
      expect(row(id).t).toBeNull();
      expect(notes(`%${id}%`)).toBe(1);
    }
    const abroad = makeOrder({ pay: "paid", country: "SA" });
    expect(await auto.autoShipPaidOrder(abroad)).toBe("skipped");
    expect(quiqupCalls.length).toBe(0);
    expect(notes(`%${abroad}%`)).toBe(1);
  });
});
