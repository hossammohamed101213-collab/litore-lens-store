"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, getSetting, setSetting, toMinor } from "@/lib/db";
import { getAdmin, createSession, destroySession } from "@/lib/auth/session";
import { DUMMY_HASH, verifyPassword } from "@/lib/auth/password";
import { codeTaken, issueCoupon, normalizeCode } from "@/lib/referrals";
import { audit } from "@/lib/db/notify";
import { rateLimited } from "@/lib/auth/guards";
import { setOrderStatus } from "@/lib/db/admin";
import { hashPassword } from "@/lib/auth/password";
import { headers, cookies } from "next/headers";
import { deleteImage, saveImage } from "@/lib/uploads";
import type { OrderStatus, PaymentStatus } from "@/lib/commerce/types";

const LABELS: Record<string, string> = {"saveProduct": "حفظ منتج", "archiveProduct": "أرشفة منتج", "updateOrder": "تحديث طلب", "saveCoupon": "حفظ كوبون", "toggleCoupon": "تفعيل/إيقاف كوبون", "deleteCoupon": "حذف كوبون", "saveShipping": "تعديل الشحن", "saveSettings": "تعديل الضريبة", "saveSocial": "تعديل روابط السوشيال", "updateReturn": "تحديث حالة مرتجع", "saveHeroBg": "تعديل خلفية الصفحة الرئيسية", "removeHeroBg": "حذف خلفية الصفحة الرئيسية", "changeAdminPassword": "تغيير كلمة سر الإدارة", "savePromo": "إضافة عرض بالشريط", "togglePromo": "تفعيل/إيقاف عرض بالشريط", "deletePromo": "حذف عرض بالشريط", "setFeedbackStatus": "تغيير حالة رأي/شكوى", "createResetLink": "إنشاء رابط استرجاع كلمة سر لعميلة", "cancelReset": "إلغاء طلب استرجاع كلمة سر", "createAdminCode": "إنشاء كود إحالة من الإدارة", "toggleRefCode": "تفعيل/إيقاف كود إحالة", "decideRedemption": "قرار على طلب استلام رصيد إحالات", "saveRefSettings": "تعديل نسب الإحالات", "saveAffiliate": "تحديث مسوّقة بالعمولة", "deleteAffiliate": "حذف مسوّقة بالعمولة"};

/** Checks the admin session and writes the action to the activity log (what + who + a hint of which record). */
async function requireAdmin(action = "", form?: FormData) {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  if (action) {
    const hint = form ? ["name_ar", "name_en", "code", "id", "status", "zone", "slug"].map((k) => String(form.get(k) ?? "")).filter(Boolean).join(" · ") : "";
    audit(admin.email, LABELS[action] ?? action, hint);
  }
  return admin;
}

const sha256 = (t: string) => createHash("sha256").update(t).digest("hex");
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => {
  const v = str(f, k);
  return v === "" ? null : Number(v);
};
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const back = (path: string, error: string): never => redirect(`${path}?error=${encodeURIComponent(error)}`);

// ---------------- auth ----------------
export async function adminLogin(form: FormData) {
  const email = str(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(`admin:${email}`, 6) || rateLimited(`admin-ip:${ip}`, 20)) back("/admin/login", "محاولات كثيرة، حاول لاحقًا.");
  const row = db().prepare("SELECT id,password_hash FROM admins WHERE email = ?").get(email) as { id: string; password_hash: string } | undefined;
  const ok = verifyPassword(password, row?.password_hash ?? DUMMY_HASH) && !!row;
  if (!ok || !row) back("/admin/login", "البريد أو كلمة المرور غير صحيحة.");
  await createSession("admin", row!.id);
  audit(email, "دخول إلى لوحة التحكم");
  redirect("/admin");
}

export async function adminLogout() {
  const who = await getAdmin();
  if (who) audit(who.email, "خروج من لوحة التحكم");
  await destroySession("admin");
  redirect("/admin/login");
}

// ---------------- products ----------------
const productSchema = z.object({
  name_ar: z.string().min(2).max(120),
  name_en: z.string().min(2).max(120),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(120),
  price: z.number().min(0).max(1_000_000),
  status: z.enum(["draft", "active", "archived"]),
});

export async function saveProduct(form: FormData) {
  await requireAdmin("saveProduct", form);
  const id = str(form, "id");
  const here = id ? `/admin/products/${id}` : "/admin/products/new";
  const nameEn = str(form, "name_en");
  const parsed = productSchema.safeParse({
    name_ar: str(form, "name_ar"), name_en: nameEn, slug: str(form, "slug") || slugify(nameEn),
    price: num(form, "price") ?? NaN, status: str(form, "status") || "draft",
  });
  if (!parsed.success) back(here, "تأكد من الاسم بالعربي والإنجليزي والسعر، والرابط بحروف إنجليزية صغيرة وأرقام وشرطات.");
  const d = parsed.data!;
  const c = db();
  const dup = c.prepare("SELECT id FROM products WHERE slug = ? AND id != ?").get(d.slug, id || "") as { id: string } | undefined;
  if (dup) back(here, "الرابط (slug) مستخدم لمنتج آخر.");

  const compare = num(form, "compare_at");
  const color = str(form, "color_family") || null;
  const swatch = /^#[0-9a-fA-F]{6}$/.test(str(form, "swatch")) ? str(form, "swatch") : null;
  const lens = num(form, "lens_count");
  const pid = id || randomUUID();
  const common = {
    slug: d.slug, name_ar: d.name_ar, name_en: d.name_en,
    short_ar: str(form, "short_ar"), short_en: str(form, "short_en"), desc_ar: str(form, "desc_ar"), desc_en: str(form, "desc_en"),
    price_minor: toMinor(d.price), compare_at_minor: compare && compare > d.price ? toMinor(compare) : null,
    color_family: color, swatch, look: str(form, "look") || null, wear_duration: str(form, "wear_duration") || null,
    diameter: str(form, "diameter") || null, base_curve: str(form, "base_curve") || null,
    water_content: str(form, "water_content") || null, lens_count: lens && lens > 0 ? Math.floor(lens) : null, status: d.status,
  };

  // photos: several can be added at once; existing ones can be re-ordered or removed
  const uploads: string[] = [];
  for (const f of form.getAll("images")) {
    if (!(f instanceof File) || f.size === 0) continue;
    const r = await saveImage(f);
    if (!r.ok) { uploads.forEach(deleteImage); back(here, r.error === "too_large" ? "إحدى الصور أكبر من 5MB." : "الصور يجب أن تكون JPG أو PNG أو WebP."); }
    else uploads.push(r.name);
  }
  const removedFiles: string[] = [];
  c.transaction(() => {
    if (id) {
      c.prepare(`UPDATE products SET slug=@slug,name_ar=@name_ar,name_en=@name_en,short_ar=@short_ar,short_en=@short_en,desc_ar=@desc_ar,desc_en=@desc_en,
        price_minor=@price_minor,compare_at_minor=@compare_at_minor,color_family=@color_family,swatch=@swatch,look=@look,wear_duration=@wear_duration,
        diameter=@diameter,base_curve=@base_curve,water_content=@water_content,lens_count=@lens_count,status=@status WHERE id=@id`).run({ ...common, id });
    } else {
      c.prepare(`INSERT INTO products (id,slug,name_ar,name_en,short_ar,short_en,desc_ar,desc_en,price_minor,compare_at_minor,color_family,swatch,look,wear_duration,diameter,base_curve,water_content,lens_count,status)
        VALUES (@id,@slug,@name_ar,@name_en,@short_ar,@short_en,@desc_ar,@desc_en,@price_minor,@compare_at_minor,@color_family,@swatch,@look,@wear_duration,@diameter,@base_curve,@water_content,@lens_count,@status)`).run({ ...common, id: pid });
    }
    c.prepare("UPDATE products SET spin = ? WHERE id = ?").run(form.get("spin") === "on" ? 1 : 0, pid);
    if (id) {
      const cur = c.prepare("SELECT id,file FROM product_images WHERE product_id = ?").all(pid) as { id: string; file: string }[];
      for (const im of cur) {
        if (form.get(`img_del_${im.id}`) === "on") { c.prepare("DELETE FROM product_images WHERE id = ?").run(im.id); removedFiles.push(im.file); }
        else { const o = num(form, `img_sort_${im.id}`); if (o != null) c.prepare("UPDATE product_images SET sort = ? WHERE id = ?").run(Math.floor(o), im.id); }
      }
    }
    const base = (c.prepare("SELECT COALESCE(MAX(sort),0) m FROM product_images WHERE product_id = ?").get(pid) as { m: number }).m;
    uploads.forEach((file, i) => c.prepare("INSERT INTO product_images(id,product_id,file,sort) VALUES (?,?,?,?)").run(randomUUID(), pid, file, base + i + 1));
    // keep the single "cover" column in step with the first photo (used by order history and cards)
    const first = c.prepare("SELECT file FROM product_images WHERE product_id = ? ORDER BY sort, rowid LIMIT 1").get(pid) as { file: string } | undefined;
    c.prepare("UPDATE products SET image = ? WHERE id = ?").run(first?.file ?? null, pid);

    // variants
    const count = Math.min(Number(str(form, "v_count")) || 0, 40);
    for (let i = 0; i < count; i++) {
      const vid = str(form, `v_id_${i}`);
      const sku = str(form, `v_sku_${i}`);
      if (vid && form.get(`v_delete_${i}`) === "on") { c.prepare("DELETE FROM variants WHERE id = ? AND product_id = ?").run(vid, pid); continue; }
      if (!sku) continue;
      const row = {
        sku, title_ar: str(form, `v_title_ar_${i}`) || d.name_ar, title_en: str(form, `v_title_en_${i}`) || d.name_en,
        stock: Math.max(0, Math.floor(num(form, `v_stock_${i}`) ?? 0)),
        price_minor: num(form, `v_price_${i}`) == null ? null : toMinor(num(form, `v_price_${i}`)!),
      };
      if (vid) c.prepare("UPDATE variants SET sku=@sku,title_ar=@title_ar,title_en=@title_en,stock=@stock,price_minor=@price_minor WHERE id=@id AND product_id=@pid").run({ ...row, id: vid, pid });
      else c.prepare("INSERT INTO variants(id,product_id,sku,title_ar,title_en,stock,price_minor) VALUES (@id,@pid,@sku,@title_ar,@title_en,@stock,@price_minor)").run({ ...row, id: randomUUID(), pid });
    }
  })();
  removedFiles.forEach(deleteImage);
  redirect(`/admin/products/${pid}?saved=1`);
}

export async function archiveProduct(form: FormData) {
  await requireAdmin("archiveProduct", form);
  db().prepare("UPDATE products SET status = 'archived' WHERE id = ?").run(str(form, "id"));
  redirect("/admin/products");
}

// ---------------- orders ----------------
const STATUSES: OrderStatus[] = ["new", "processing", "shipped", "delivered", "cancelled"];
export async function updateOrder(form: FormData) {
  await requireAdmin("updateOrder", form);
  const id = str(form, "id");
  const status = str(form, "status") as OrderStatus;
  if (!STATUSES.includes(status)) back(`/admin/orders/${id}`, "حالة غير صحيحة.");
  const payment = str(form, "payment") as PaymentStatus;
  if (!["paid", "pending", "failed", "refunded"].includes(payment)) back(`/admin/orders/${id}`, "حالة دفع غير صحيحة.");
  const r = setOrderStatus(id, status, str(form, "tracking").slice(0, 80) || null, payment);
  if (r === "locked") back(`/admin/orders/${id}`, "لا يمكن إعادة فتح طلب ملغي.");
  redirect(`/admin/orders/${id}?saved=1`);
}

// ---------------- coupons ----------------
export async function saveCoupon(form: FormData) {
  await requireAdmin("saveCoupon", form);
  const code = str(form, "code").toUpperCase();
  const kind = str(form, "kind");
  const value = num(form, "value");
  if (!/^[A-Z0-9_-]{3,30}$/.test(code) || !["percent", "fixed"].includes(kind) || !value || value <= 0 || (kind === "percent" && value > 100)) {
    back("/admin/coupons", "تأكد من الكود (3-30 حرف/رقم) ونوع الخصم وقيمته.");
  }
  db().prepare(`INSERT INTO coupons(code,kind,value,min_subtotal_minor,active) VALUES (?,?,?,?,1)
    ON CONFLICT(code) DO UPDATE SET kind=excluded.kind,value=excluded.value,min_subtotal_minor=excluded.min_subtotal_minor,active=1`)
    .run(code, kind, value, toMinor(num(form, "min") ?? 0));
  redirect("/admin/coupons?saved=1");
}
export async function toggleCoupon(form: FormData) {
  await requireAdmin("toggleCoupon", form);
  db().prepare("UPDATE coupons SET active = 1 - active WHERE code = ?").run(str(form, "code"));
  redirect("/admin/coupons");
}
export async function deleteCoupon(form: FormData) {
  await requireAdmin("deleteCoupon", form);
  db().prepare("DELETE FROM coupons WHERE code = ?").run(str(form, "code"));
  redirect("/admin/coupons");
}

// ---------------- shipping zones ----------------
export async function saveShipping(form: FormData) {
  await requireAdmin("saveShipping", form);
  const country = str(form, "country");
  if (!["AE", "SA", "KW", "QA", "BH", "OM"].includes(country)) redirect("/admin/shipping");
  const here = `/admin/shipping/${country}`;
  const price = num(form, "price"); const free = num(form, "free"); const min = num(form, "min"); const max = num(form, "max");
  if ((price != null && (price < 0 || price > 10000)) || (min != null && min < 0) || (max != null && max < 0)) back(here, "تأكد من الأرقام (لا تكتب قيمة سالبة).");
  if (min != null && max != null && max < min) back(here, "أقصى مدة يجب أن تكون أكبر من أو تساوي أقل مدة.");
  db().prepare(`INSERT INTO shipping_zones(country,label_ar,label_en,price_minor,free_over_minor,min_days,max_days,active) VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(country) DO UPDATE SET label_ar=excluded.label_ar,label_en=excluded.label_en,price_minor=excluded.price_minor,
    free_over_minor=excluded.free_over_minor,min_days=excluded.min_days,max_days=excluded.max_days,active=excluded.active`)
    .run(country, str(form, "label_ar").slice(0, 60) || "شحن", str(form, "label_en").slice(0, 60) || "Shipping",
      toMinor(Math.max(0, price ?? 0)), free && free > 0 ? toMinor(free) : null, min, max, form.get("active") === "on" ? 1 : 0);
  redirect(`${here}?saved=1`);
}

// ---------------- settings ----------------
export async function saveSettings(form: FormData) {
  await requireAdmin("saveSettings", form);
  const rate = num(form, "tax_rate") ?? 0;
  if (rate < 0 || rate > 50) back("/admin/tax/rate", "نسبة الضريبة يجب أن تكون بين 0 و 50.");
  setSetting("tax_rate", String(rate));
  setSetting("tax_inclusive", form.get("tax_inclusive") === "on" ? "true" : "false");
  redirect("/admin/tax/rate?saved=1");
}

// ---------------- change password ----------------
export async function changeAdminPassword(form: FormData) {
  const admin = await requireAdmin("changeAdminPassword", form);
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const here = "/admin/account";
  if (rateLimited(`admin-pw:${admin.id}`, 5)) back(here, "محاولات كثيرة، حاول لاحقًا.");
  const row = db().prepare("SELECT password_hash FROM admins WHERE id = ?").get(admin.id) as { password_hash: string } | undefined;
  if (!row || !verifyPassword(current, row.password_hash)) back(here, "كلمة المرور الحالية غير صحيحة.");
  if (next.length < 10) back(here, "كلمة المرور الجديدة يجب أن تكون 10 أحرف على الأقل.");
  if (next.length > 128) back(here, "كلمة المرور طويلة جدًا.");
  if (next !== confirm) back(here, "تأكيد كلمة المرور غير مطابق.");
  if (next === current) back(here, "اختر كلمة مرور مختلفة عن الحالية.");
  const c = db();
  const token = (await cookies()).get("litore_admin")?.value;
  c.transaction(() => {
    c.prepare("UPDATE admins SET password_hash = ? WHERE id = ?").run(hashPassword(next), admin.id);
    // Sign out every other device; keep this one.
    c.prepare("DELETE FROM sessions WHERE kind = 'admin' AND user_id = ? AND token_hash != ?").run(admin.id, token ? sha256(token) : "");
  })();
  redirect(`${here}?saved=1`);
}

// ---------------- ticker promos ----------------
export async function savePromo(form: FormData) {
  await requireAdmin("savePromo", form);
  const nameAr = str(form, "name_ar"); const nameEn = str(form, "name_en");
  const percent = num(form, "percent"); const after = num(form, "price_after");
  if (!nameAr || !nameEn || !percent || percent <= 0 || percent > 90 || after == null || after < 0) {
    back("/admin/ticker", "اكتب اسم العدسة بالعربي والإنجليزي، خصم بين 1 و90، وسعر بعد الخصم.");
  }
  db().prepare("INSERT INTO promos(id,name_ar,name_en,discount_percent,price_after_minor,active,sort) VALUES (?,?,?,?,?,1,(SELECT COALESCE(MAX(sort),0)+1 FROM promos))")
    .run(randomUUID(), nameAr.slice(0, 80), nameEn.slice(0, 80), percent, toMinor(after as number));
  redirect("/admin/ticker?saved=1");
}
export async function togglePromo(form: FormData) {
  await requireAdmin("togglePromo", form);
  db().prepare("UPDATE promos SET active = 1 - active WHERE id = ?").run(str(form, "id"));
  redirect("/admin/ticker");
}
export async function deletePromo(form: FormData) {
  await requireAdmin("deletePromo", form);
  db().prepare("DELETE FROM promos WHERE id = ?").run(str(form, "id"));
  redirect("/admin/ticker");
}

// ---------------- feedback moderation ----------------
export async function setFeedbackStatus(form: FormData) {
  await requireAdmin("setFeedbackStatus", form);
  const status = str(form, "status");
  if (!["new", "approved", "hidden", "done"].includes(status)) back("/admin/feedback", "حالة غير صحيحة.");
  db().prepare("UPDATE feedback SET status = ? WHERE id = ?").run(status, str(form, "id"));
  redirect("/admin/feedback");
}

// ---------------- notifications ----------------
export async function markNotifications(form: FormData) {
  await requireAdmin();
  const id = str(form, "id");
  if (id) db().prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(id);
  else db().prepare("UPDATE notifications SET is_read = 1").run();
  revalidatePath("/admin", "layout"); // refresh the unread badge in the menu
  redirect("/admin/notifications");
}

// ---------------- password-reset requests (sent to the customer on WhatsApp) ----------------
export async function createResetLink(form: FormData) {
  await requireAdmin("createResetLink", form);
  const id = str(form, "id");
  const token = randomBytes(32).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  db().prepare("UPDATE password_resets SET token_hash=?, expires_at=?, status='sent' WHERE id=? AND status IN ('pending','sent')").run(sha256(token), exp, id);
  // The raw link is shown once, in the redirect, and never stored.
  redirect(`/admin/resets?token=${token}&id=${encodeURIComponent(id)}`);
}
export async function cancelReset(form: FormData) {
  await requireAdmin("cancelReset", form);
  db().prepare("UPDATE password_resets SET status='cancelled', token_hash=NULL WHERE id=?").run(str(form, "id"));
  redirect("/admin/resets");
}

// ---------------- referrals ----------------
export async function createAdminCode(form: FormData) {
  await requireAdmin("createAdminCode", form);
  const code = normalizeCode(str(form, "code"));
  if (!code) back("/admin/referrals", "الكود 3 إلى 24 حرفًا أو رقمًا (يمكن _ و -).");
  if (codeTaken(code!)) back("/admin/referrals", "هذا الكود مستخدم.");
  db().prepare("INSERT INTO referral_codes(code,owner_id,note) VALUES (?,NULL,?)").run(code, str(form, "note").slice(0, 120));
  redirect("/admin/referrals?saved=1");
}
export async function toggleRefCode(form: FormData) {
  await requireAdmin("toggleRefCode", form);
  db().prepare("UPDATE referral_codes SET active = 1 - active WHERE code = ?").run(str(form, "code"));
  redirect("/admin/referrals");
}
export async function saveRefSettings(form: FormData) {
  await requireAdmin("saveRefSettings");
  const a = num(form, "referee"); const b = num(form, "owner");
  if (a == null || b == null || a < 0 || a > 100 || b < 0 || b > 100) back("/admin/referrals", "النسب بين 0 و100.");
  setSetting("ref_referee_pct", String(a)); setSetting("ref_owner_pct", String(b));
  redirect("/admin/referrals?saved=1");
}
export async function decideRedemption(form: FormData) {
  await requireAdmin("decideRedemption", form);
  const id = str(form, "id"); const approve = str(form, "decision") === "approve";
  const c = db();
  const r = c.prepare("SELECT * FROM redemptions WHERE id = ? AND status = 'pending'").get(id) as { id: string; customer_id: string; percent: number } | undefined;
  if (!r) redirect("/admin/referrals");
  const row = r!;
  c.transaction(() => {
    if (approve) {
      const pct = Math.min(100, Math.max(1, num(form, "percent") ?? row.percent));
      const code = issueCoupon(row.customer_id, pct, "REF");
      c.prepare("UPDATE redemptions SET status='approved', coupon_code=?, percent=? WHERE id=?").run(code, pct, id);
      if (pct < row.percent) c.prepare("UPDATE customers SET ref_balance = MIN(100, ref_balance + ?) WHERE id = ?").run(row.percent - pct, row.customer_id);
    } else {
      c.prepare("UPDATE redemptions SET status='rejected' WHERE id=?").run(id);
      c.prepare("UPDATE customers SET ref_balance = MIN(100, ref_balance + ?) WHERE id = ?").run(row.percent, row.customer_id);
    }
  })();
  redirect("/admin/referrals?saved=1");
}

// ---------------- commission marketers ----------------
export async function saveAffiliate(form: FormData) {
  await requireAdmin("saveAffiliate", form);
  const status = str(form, "status");
  if (!["pending", "approved", "rejected"].includes(status)) back("/admin/affiliates", "حالة غير صحيحة.");
  const pct = Math.min(100, Math.max(0, num(form, "commission") ?? 0));
  const code = str(form, "code") ? normalizeCode(str(form, "code")) : null;
  if (str(form, "code") && !code) back("/admin/affiliates", "كود المسوّقة غير صالح.");
  db().prepare("UPDATE affiliates SET status=?, commission_pct=?, code=?, notes=? WHERE id=?").run(status, pct, code, str(form, "notes").slice(0, 300), str(form, "id"));
  redirect("/admin/affiliates?saved=1");
}
export async function deleteAffiliate(form: FormData) {
  await requireAdmin("deleteAffiliate", form);
  db().prepare("DELETE FROM affiliates WHERE id = ?").run(str(form, "id"));
  redirect("/admin/affiliates");
}

export async function saveSocial(form: FormData) {
  await requireAdmin("saveSocial", form);
  const k = str(form, "k");
  if (!["whatsapp", "tiktok", "instagram"].includes(k)) redirect("/admin/social");
  const v = str(form, "url");
  if (v && !/^(https?:\/\/)[^\s.]+\.[^\s]+$/i.test(v) && !/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(v)) back(`/admin/social/${k}`, "الرابط غير صحيح. الصقي الرابط كاملًا من الحساب.");
  setSetting("social_" + k, v.slice(0, 300));
  revalidatePath("/", "layout");
  revalidatePath("/[locale]", "layout");
  redirect(`/admin/social/${k}?saved=1`);
}

export async function updateReturn(form: FormData) {
  await requireAdmin("updateReturn", form);
  const id = str(form, "id"); const status = str(form, "status");
  if (!["requested", "approved", "rejected", "received", "refunded"].includes(status)) back("/admin/returns", "حالة غير صحيحة.");
  const c = db();
  c.prepare("UPDATE returns SET status = ?, admin_note = ?, updated_at = datetime('now') WHERE id = ?").run(status, str(form, "note").slice(0, 400), id);
  if (status === "refunded") c.prepare("UPDATE orders SET payment_status = 'refunded' WHERE id = (SELECT order_id FROM returns WHERE id = ?)").run(id);
  redirect("/admin/returns?saved=1");
}

export async function saveHeroBg(form: FormData) {
  await requireAdmin("saveHeroBg", form);
  const f = form.get("photo");
  if (f instanceof File && f.size > 0) {
    const r = await saveImage(f);
    if (!r.ok) back("/admin/background", r.error === "too_large" ? "الصورة أكبر من 5MB." : "الصورة يجب أن تكون JPG أو PNG أو WebP.");
    else { const old = getSetting("hero_bg", ""); if (old) deleteImage(old); setSetting("hero_bg", r.name); }
  }
  const op = num(form, "opacity"); const pos = num(form, "pos"); const side = str(form, "side");
  if (op != null) setSetting("hero_bg_opacity", String(Math.min(90, Math.max(10, Math.round(op)))));
  if (pos != null) setSetting("hero_bg_pos", String(Math.min(100, Math.max(0, Math.round(pos)))));
  if (["center", "start", "end"].includes(side)) setSetting("hero_bg_side", side);
  revalidatePath("/[locale]", "layout");
  redirect("/admin/background?saved=1");
}
export async function removeHeroBg(form: FormData) {
  await requireAdmin("removeHeroBg", form);
  const old = getSetting("hero_bg", ""); if (old) deleteImage(old);
  setSetting("hero_bg", "");
  revalidatePath("/[locale]", "layout");
  redirect("/admin/background?saved=1");
}
