"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { db, getSetting, setSetting } from "@/lib/db";
import { getAdmin } from "@/lib/auth/session";
import { audit } from "@/lib/db/notify";
import { setSecret } from "@/lib/secrets";
import { createTelrOrder, telrConfig } from "@/lib/payment/telr";
import { createAramexShipment } from "@/lib/shipping/aramex";
import { createQuiqupOrder } from "@/lib/shipping/quiqup";
import type { Address } from "@/lib/shipping/types";
import { getOrderAdmin } from "@/lib/db/admin";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
async function admin(action: string) {
  const a = await getAdmin();
  if (!a) redirect("/admin/login");
  audit(a.email, action, "");
}

export async function savePayments(form: FormData) {
  await admin("تعديل إعدادات الدفع");
  setSetting("pay_telr_store", str(form, "store").slice(0, 40));
  setSecret("pay_telr_key", str(form, "key").slice(0, 120));
  setSetting("pay_telr_mode", str(form, "mode") === "live" ? "live" : "test");
  setSetting("pay_telr_enabled", form.get("enabled") === "on" ? "1" : "0");
  redirect("/admin/integrations/telr?saved=1");
}

/** Asks Telr to open a TEST payment page of AED 1. Nothing is charged. */
export async function testTelr() {
  await admin("اختبار ربط Telr");
  const cfg = telrConfig();
  if (!cfg) redirect("/admin/integrations/telr?msg=" + encodeURIComponent("فعّل الربط واحفظ المفاتيح أولًا ثم اضغط اختبار."));
  try {
    await createTelrOrder({ ...cfg, test: true }, { orderId: `LT-TEST${Date.now() % 10000}`, amountMajor: 1, currency: "AED", locale: "ar" });
  } catch (e) {
    redirect("/admin/integrations/telr?msg=" + encodeURIComponent("فشل الاتصال: " + String(e instanceof Error ? e.message : e).slice(0, 160)));
  }
  redirect("/admin/integrations/telr?msg=" + encodeURIComponent("✅ الاتصال سليم، Telr قبل المفاتيح."));
}

const setKeys = (form: FormData, keys: string[]) => { for (const k of keys) setSetting(k, str(form, k).slice(0, 200)); };

export async function saveSender(form: FormData) {
  await admin("تعديل بيانات المرسل");
  setKeys(form, ["ship_name", "ship_phone", "ship_email", "ship_line1", "ship_city"]);
  redirect("/admin/integrations/sender?saved=1");
}

export async function saveAramex(form: FormData) {
  await admin("تعديل ربط Aramex");
  setKeys(form, ["car_aramex_user", "car_aramex_acct", "car_aramex_entity", "car_aramex_country"]);
  setSetting("car_aramex_mode", str(form, "car_aramex_mode") === "live" ? "live" : "test");
  // a secret left empty keeps the saved one
  for (const k of ["car_aramex_pass", "car_aramex_pin"]) if (str(form, k)) setSecret(k, str(form, k));
  setSetting("car_aramex_enabled", form.get("car_aramex_enabled") === "on" ? "1" : "0");
  redirect("/admin/integrations/aramex?saved=1");
}

export async function saveQuiqup(form: FormData) {
  await admin("تعديل ربط Quiqup");
  setSetting("car_quiqup_mode", str(form, "mode") === "live" ? "live" : "test");
  setSetting("car_quiqup_kind", str(form, "kind") === "partner_same_day" ? "partner_same_day" : "partner_next_day");
  // a secret left empty keeps the saved one
  if (str(form, "key")) setSecret("car_quiqup_key", str(form, "key").slice(0, 400));
  if (str(form, "whsec")) setSecret("car_quiqup_whsec", str(form, "whsec").slice(0, 200));
  setSetting("car_quiqup_enabled", form.get("enabled") === "on" ? "1" : "0");
  redirect("/admin/integrations/quiqup?saved=1");
}

export async function saveManualCarrier(form: FormData) {
  await admin("تعديل ربط شركة شحن");
  const c = str(form, "carrier");
  if (!["quiqup", "emx"].includes(c)) redirect("/admin/integrations");
  const track = str(form, "track").slice(0, 200);
  if (track && !/^https:\/\/[^\s]+$/i.test(track)) redirect(`/admin/integrations/${c}?error=` + encodeURIComponent("رابط التتبع يجب أن يبدأ بـ https://"));
  setSetting(`car_${c}_track`, track);
  setSetting(`car_${c}_enabled`, form.get("enabled") === "on" ? "1" : "0");
  redirect(`/admin/integrations/${c}?saved=1`);
}

export async function saveAutoRates(form: FormData) {
  await admin("تعديل السعر التلقائي للشحن");
  const w = Number(str(form, "car_pack_weight")); const m = Number(str(form, "car_rate_markup"));
  if (!(w > 0 && w <= 30)) redirect("/admin/shipping/auto?error=" + encodeURIComponent("وزن الطرد يجب أن يكون بين 0.1 و30 كجم."));
  if (!(m >= 0 && m <= 100)) redirect("/admin/shipping/auto?error=" + encodeURIComponent("الإضافة على السعر يجب أن تكون بين 0 و100%."));
  setSetting("car_pack_weight", String(w)); setSetting("car_rate_markup", String(m));
  setSetting("car_auto_rates", form.get("car_auto_rates") === "on" ? "1" : "0");
  redirect("/admin/shipping/auto?saved=1");
}

/** "اشحن الآن": Aramex is created through its API; Quiqup / EMX take the tracking number typed by the owner. */
export async function shipOrder(form: FormData) {
  await admin("شحن طلب");
  const id = str(form, "id");
  const carrier = str(form, "carrier");
  const o = getOrderAdmin(id);
  const back = (m: string): never => redirect(`/admin/orders/${id}?error=${encodeURIComponent(m)}`);
  if (!o) return back("الطلب غير موجود");
  if (o.status === "cancelled") return back("الطلب ملغي");
  if (!["aramex", "quiqup", "emx"].includes(carrier)) return back("اختر شركة شحن");
  if (o.paymentStatus !== "paid" && carrier !== "emx" && !str(form, "tracking")) return back("الطلب غير مدفوع — لا يمكن شحنه تلقائيًا قبل تأكيد الدفع");
  let tracking = str(form, "tracking").slice(0, 80);
  let label: string | undefined;
  if (carrier === "aramex" && !tracking) {
    try {
      const r = await createAramexShipment({
        orderId: o.id, address: o.address as unknown as Address, email: o.email, phone: o.phone,
      });
      tracking = r.trackingNumber;
      label = r.labelUrl;
    } catch (e) {
      const m = String(e instanceof Error ? e.message : e);
      return back(m === "aramex_not_configured" ? "فعّل Aramex واحفظ بياناته من الإعدادات ← الربط ← Aramex" : m === "shipper_missing" ? "اكتب عنوان وتليفون المرسل من الإعدادات ← الربط ← بيانات المرسل" : `Aramex رفض الطلب: ${m}`);
    }
  }
  let ref: string | undefined;
  if (carrier === "quiqup" && !tracking) {
    const prev = db().prepare("SELECT carrier, carrier_ref FROM orders WHERE id = ?").get(id) as { carrier: string | null; carrier_ref: string | null } | undefined;
    if (prev?.carrier === "quiqup" && prev.carrier_ref) return back("هذا الطلب مشحون بالفعل مع Quiqup");
    try {
      const r = await createQuiqupOrder({
        orderId: o.id, address: o.address as unknown as Address, email: o.email, phone: o.phone,
      });
      tracking = r.uuid;
      ref = r.orderId;
      label = `/api/admin/orders/${encodeURIComponent(o.id)}/label`;
    } catch (e) {
      const m = String(e instanceof Error ? e.message : e);
      return back(
        m === "quiqup_not_configured" ? "فعّل Quiqup واحفظ المفتاح من الإعدادات ← الربط ← Quiqup"
        : m === "shipper_missing" ? "اكتب عنوان وتليفون المرسل من الإعدادات ← الربط ← بيانات المرسل"
        : m === "quiqup_uae_only" ? "Quiqup يوصّل داخل الإمارات فقط، استخدم شركة أخرى لهذا الطلب"
        : m === "bad_phone" ? "رقم تليفون العميلة غير صالح لـ Quiqup (لازم رقم إماراتي)"
        : m.startsWith("quiqup:") ? `Quiqup رفض الطلب: ${m.slice(7)}` : `Quiqup: ${m}`,
      );
    }
  }
  if (!tracking) return back("اكتب رقم التتبع");
  db().prepare("UPDATE orders SET status = 'shipped', tracking_number = ?, carrier = ?, label_url = ?, carrier_ref = ? WHERE id = ?").run(tracking, carrier, label ?? null, ref ?? null, id);
  redirect(`/admin/orders/${id}?saved=1`);
}

/** Permanently deletes an order (test or real). Stock is returned only while the goods are still with us (new / processing). */
export async function deleteOrder(form: FormData) {
  await admin("حذف طلب");
  const id = str(form, "id");
  const back = (m: string): never => redirect(`/admin/orders/${id}?error=${encodeURIComponent(m)}`);
  if (form.get("sure") !== "on") return back("علّم على «أؤكد حذف الطلب نهائيًا» أولًا");
  const c = db();
  const row = c.prepare("SELECT status FROM orders WHERE id = ?").get(id) as { status: string } | undefined;
  if (!row) redirect("/admin/orders");
  c.transaction(() => {
    if (row.status === "new" || row.status === "processing") {
      const lines = c.prepare("SELECT variant_id, quantity FROM order_lines WHERE order_id = ?").all(id) as { variant_id: string; quantity: number }[];
      const up = c.prepare("UPDATE variants SET stock = stock + ? WHERE id = ?");
      for (const l of lines) up.run(l.quantity, l.variant_id);
    }
    c.prepare("DELETE FROM orders WHERE id = ?").run(id);
  })();
  redirect("/admin/orders?deleted=1");
}

/** Copies an order (customer, address, products, prices) into a NEW order waiting for payment — for fixing a customer's mistake. */
export async function duplicateOrder(form: FormData) {
  await admin("نسخ طلب كطلب جديد");
  const id = str(form, "id");
  const back = (m: string): never => redirect(`/admin/orders/${id}?error=${encodeURIComponent(m)}`);
  const c = db();
  const o = c.prepare("SELECT * FROM orders WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!o) return back("الطلب غير موجود");
  const lines = c.prepare("SELECT * FROM order_lines WHERE order_id = ?").all(id) as Record<string, unknown>[];
  const newId = `LT-${randomBytes(6).toString("hex").toUpperCase()}`;
  try {
    c.transaction(() => {
    for (const l of lines) {
      const r = c.prepare("UPDATE variants SET stock = stock - ? WHERE id = ? AND stock >= ?").run(l.quantity, l.variant_id, l.quantity);
      if (r.changes !== 1) throw new Error(`stock:${String(l.name_ar)}`);
    }
    c.prepare(`INSERT INTO orders (id, customer_id, email, phone, status, payment_status, subtotal_minor, discount_minor, shipping_minor, tax_minor, total_minor, currency,
      shipping_label_ar, shipping_label_en, address_json, coupon_code, idempotency_key, is_mock)
      VALUES (?, ?, ?, ?, 'new', 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`)
      .run(newId, o.customer_id, o.email, o.phone, o.subtotal_minor, o.discount_minor, o.shipping_minor, o.tax_minor, o.total_minor, o.currency,
        o.shipping_label_ar, o.shipping_label_en, o.address_json, `admin-copy-${randomBytes(8).toString("hex")}`, o.is_mock);
    const ins = c.prepare(`INSERT INTO order_lines (order_id, variant_id, product_id, slug, name_ar, name_en, sku, swatch, image, unit_minor, quantity) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    for (const l of lines) ins.run(newId, l.variant_id, l.product_id, l.slug, l.name_ar, l.name_en, l.sku, l.swatch, l.image, l.unit_minor, l.quantity);
    })();
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    return back(m.startsWith("stock:") ? `المخزون غير كافٍ لـ ${m.slice(6)}. زوّد المخزون أولًا` : "تعذر إنشاء الطلب");
  }
  redirect(`/admin/orders/${newId}?saved=1`);
}
