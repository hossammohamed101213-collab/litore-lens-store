"use server";

import { redirect } from "next/navigation";
import { db, getSetting, setSetting } from "@/lib/db";
import { getAdmin } from "@/lib/auth/session";
import { audit } from "@/lib/db/notify";
import { setSecret } from "@/lib/secrets";
import { createTelrOrder, telrConfig } from "@/lib/payment/telr";
import { createAramexShipment } from "@/lib/shipping/aramex";
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

export async function saveManualCarrier(form: FormData) {
  await admin("تعديل ربط شركة شحن");
  const c = str(form, "carrier");
  if (!["quiqup", "emx"].includes(c)) redirect("/admin/integrations");
  setSetting(`car_${c}_track`, str(form, "track").slice(0, 200));
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
  let tracking = str(form, "tracking").slice(0, 80);
  let label: string | undefined;
  if (carrier === "aramex" && !tracking) {
    try {
      const r = await createAramexShipment({
        orderId: o.id, address: o.address as unknown as Address, email: o.email, phone: o.phone,
        cod: o.paymentStatus === "paid" ? 0 : o.total,
      });
      tracking = r.trackingNumber;
      label = r.labelUrl;
    } catch (e) {
      const m = String(e instanceof Error ? e.message : e);
      return back(m === "aramex_not_configured" ? "فعّل Aramex واحفظ بياناته من الإعدادات ← الربط ← Aramex" : m === "shipper_missing" ? "اكتب عنوان وتليفون المرسل من الإعدادات ← الربط ← بيانات المرسل" : `Aramex رفض الطلب: ${m}`);
    }
  }
  if (!tracking) return back("اكتب رقم التتبع");
  db().prepare("UPDATE orders SET status = 'shipped', tracking_number = ?, carrier = ?, label_url = ? WHERE id = ?").run(tracking, carrier, label ?? null, id);
  redirect(`/admin/orders/${id}?saved=1`);
}
