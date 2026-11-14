import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getSecret } from "@/lib/secrets";
import { getSetting } from "@/lib/db";
import { shipper } from "./aramex";
import type { Address } from "./types";

/** Quiqup "last-mile" API. The merchant creates the API key himself in the Quiqup dashboard (it is the Bearer token). */
export function quiqupConfig() {
  if (getSetting("car_quiqup_enabled") !== "1") return null;
  const key = getSecret("car_quiqup_key");
  if (!key) return null;
  const live = getSetting("car_quiqup_mode", "test") === "live";
  const kind = getSetting("car_quiqup_kind", "partner_next_day");
  return { key, live, kind: kind === "partner_same_day" ? "partner_same_day" : "partner_next_day" };
}

const quiqupBase = (live: boolean) => process.env.QUIQUP_BASE ?? (live ? "https://api-ae.quiqup.com" : "https://api.staging.quiqup.com");

/** Quiqup wants E.164 with one "+": +971500000000. */
export function e164(raw: string): string {
  let d = raw.replace(/[^\d]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0") && d.length === 10) d = "971" + d.slice(1);
  else if (d.length === 9 && d.startsWith("5")) d = "971" + d; // 501234567 typed without the leading 0
  return `+${d}`;
}

type Result = { orderId: string; uuid: string; trackingUrl: string };

/** Creates a delivery order at Quiqup and releases it for collection. COD orders carry the amount to collect. */
export async function createQuiqupOrder(o: { orderId: string; address: Address; email: string; phone: string; cod?: number }): Promise<Result> {
  const c = quiqupConfig();
  if (!c) throw new Error("quiqup_not_configured");
  const s = shipper();
  if (!s.line1 || !s.phone) throw new Error("shipper_missing");
  if (o.address.country !== "AE") throw new Error("quiqup_uae_only");
  const phone = e164(o.phone || o.address.phone);
  if (!/^\+971\d{8,9}$/.test(phone)) throw new Error("bad_phone");
  const cod = o.cod && o.cod > 1 ? Math.round(o.cod * 100) / 100 : 0;
  // Same order => same uuid, so a retry (double click, timeout) can never create a second Quiqup order: Quiqup answers 200 with the original.
  const h = createHash("sha256").update(`litore-order:${o.orderId}`).digest("hex");
  const uuid = `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
  const body = {
    uuid,
    kind: c.kind,
    partner_order_id: o.orderId,
    ready_for_collection: true,
    payment_mode: cod ? "paid_on_delivery" : "pre_paid",
    ...(cod ? { payment_amount: cod } : {}),
    origin: {
      contact_name: s.name, contact_phone: e164(s.phone),
      address: { address1: s.line1, address2: "", town: s.city || "Dubai", country: "AE" },
    },
    destination: {
      contact_name: o.address.name.slice(0, 80), contact_phone: phone, contact_email: o.email || "",
      notes: "",
      address: { address1: o.address.line1.slice(0, 200), address2: [o.address.line2, o.address.region].filter(Boolean).join(", ").slice(0, 120), town: o.address.city.slice(0, 60) || "Dubai", country: "AE" },
    },
    items: [{ name: `Litore ${o.orderId}`.slice(0, 40), quantity: 1, parcel_barcode: "" }],
  };
  const r = await fetch(`${quiqupBase(c.live)}/orders`, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${c.key}` },
    body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
  });
  const j = (await r.json().catch(() => ({}))) as { order?: { id?: number | string; uuid?: string; tracking_url?: string }; api_error?: { human?: string; message?: string }; error?: string };
  if (r.status === 401) throw new Error("quiqup:المفتاح غير صحيح أو منتهي");
  if (!(r.status === 200 || r.status === 201) || !j.order?.id) {
    const m = j.api_error?.human || j.api_error?.message || j.error || `http_${r.status}`;
    throw new Error(`quiqup:${r.status === 422 && !j.api_error?.message ? "الخدمة (Same Day / Next Day) غير مفعّلة في حسابك أو بيانات ناقصة" : m}`.slice(0, 300));
  }
  const id = String(j.order.id);
  const ouuid = j.order.uuid || uuid;
  return { orderId: id, uuid: ouuid, trackingUrl: j.order.tracking_url || `https://track-parcel.quiqup.com/${ouuid}` };
}

/** Downloads the PDF label for an order (needs the Bearer key, so it is proxied through an admin-only route). */
export async function fetchQuiqupLabel(ref: string): Promise<Uint8Array | null> {
  const c = quiqupConfig();
  if (!c || !/^\d{1,12}$/.test(ref)) return null;
  const r = await fetch(`${quiqupBase(c.live)}/order_label/${ref}`, { headers: { Authorization: `Bearer ${c.key}` }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) return null;
  const buf = new Uint8Array(await r.arrayBuffer());
  return buf.length > 0 ? buf : null; // unknown id answers 200 with an empty body
}

/** Webhook check: HMAC-SHA256(secret, "{timestamp}.{rawBody}") in X-Quiqup-Signature, timestamp within 5 minutes. */
export function verifyQuiqupWebhook(raw: string, signature: string | null, timestamp: string | null, secret: string, now = Date.now()): boolean {
  if (!secret || !signature || !timestamp || !/^\d{9,13}$/.test(timestamp)) return false;
  const ts = timestamp.length > 11 ? Number(timestamp) : Number(timestamp) * 1000;
  if (Math.abs(now - ts) > 5 * 60_000) return false;
  const want = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  const a = Buffer.from(want), b = Buffer.from(signature.trim().toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}
