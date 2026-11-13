"use server";

import { createHash, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, setSetting, toMinor } from "@/lib/db";
import { getAdmin, createSession, destroySession } from "@/lib/auth/session";
import { DUMMY_HASH, verifyPassword } from "@/lib/auth/password";
import { rateLimited } from "@/lib/auth/guards";
import { setOrderStatus } from "@/lib/db/admin";
import { hashPassword } from "@/lib/auth/password";
import { headers, cookies } from "next/headers";
import { deleteImage, saveImage } from "@/lib/uploads";
import type { OrderStatus, PaymentStatus } from "@/lib/commerce/types";

async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
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
  redirect("/admin");
}

export async function adminLogout() {
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
  await requireAdmin();
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

  // image
  const file = form.get("image");
  let newImage: string | null | undefined; // undefined = unchanged
  if (file instanceof File && file.size > 0) {
    const r = await saveImage(file);
    if (!r.ok) back(here, r.error === "too_large" ? "الصورة أكبر من 5MB." : "الصورة يجب أن تكون JPG أو PNG أو WebP.");
    else newImage = r.name;
  } else if (form.get("remove_image") === "on") newImage = null;

  const old = id ? (c.prepare("SELECT image FROM products WHERE id = ?").get(id) as { image: string | null } | undefined) : undefined;
  c.transaction(() => {
    if (id) {
      c.prepare(`UPDATE products SET slug=@slug,name_ar=@name_ar,name_en=@name_en,short_ar=@short_ar,short_en=@short_en,desc_ar=@desc_ar,desc_en=@desc_en,
        price_minor=@price_minor,compare_at_minor=@compare_at_minor,color_family=@color_family,swatch=@swatch,look=@look,wear_duration=@wear_duration,
        diameter=@diameter,base_curve=@base_curve,water_content=@water_content,lens_count=@lens_count,status=@status WHERE id=@id`).run({ ...common, id });
    } else {
      c.prepare(`INSERT INTO products (id,slug,name_ar,name_en,short_ar,short_en,desc_ar,desc_en,price_minor,compare_at_minor,color_family,swatch,look,wear_duration,diameter,base_curve,water_content,lens_count,status)
        VALUES (@id,@slug,@name_ar,@name_en,@short_ar,@short_en,@desc_ar,@desc_en,@price_minor,@compare_at_minor,@color_family,@swatch,@look,@wear_duration,@diameter,@base_curve,@water_content,@lens_count,@status)`).run({ ...common, id: pid });
    }
    if (newImage !== undefined) c.prepare("UPDATE products SET image = ? WHERE id = ?").run(newImage, pid);

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
  if (newImage !== undefined && old?.image) deleteImage(old.image);
  redirect(`/admin/products/${pid}?saved=1`);
}

export async function archiveProduct(form: FormData) {
  await requireAdmin();
  db().prepare("UPDATE products SET status = 'archived' WHERE id = ?").run(str(form, "id"));
  redirect("/admin/products");
}

// ---------------- orders ----------------
const STATUSES: OrderStatus[] = ["new", "processing", "shipped", "delivered", "cancelled"];
export async function updateOrder(form: FormData) {
  await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
  db().prepare("UPDATE coupons SET active = 1 - active WHERE code = ?").run(str(form, "code"));
  redirect("/admin/coupons");
}
export async function deleteCoupon(form: FormData) {
  await requireAdmin();
  db().prepare("DELETE FROM coupons WHERE code = ?").run(str(form, "code"));
  redirect("/admin/coupons");
}

// ---------------- shipping zones ----------------
export async function saveShipping(form: FormData) {
  await requireAdmin();
  const c = db();
  c.transaction(() => {
    for (const country of ["AE", "SA", "KW", "QA", "BH", "OM"]) {
      const price = num(form, `price_${country}`);
      const free = num(form, `free_${country}`);
      const min = num(form, `min_${country}`);
      const max = num(form, `max_${country}`);
      c.prepare(`INSERT INTO shipping_zones(country,label_ar,label_en,price_minor,free_over_minor,min_days,max_days,active) VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT(country) DO UPDATE SET label_ar=excluded.label_ar,label_en=excluded.label_en,price_minor=excluded.price_minor,
        free_over_minor=excluded.free_over_minor,min_days=excluded.min_days,max_days=excluded.max_days,active=excluded.active`)
        .run(country, str(form, `label_ar_${country}`) || "شحن", str(form, `label_en_${country}`) || "Shipping",
          toMinor(Math.max(0, price ?? 0)), free && free > 0 ? toMinor(free) : null, min, max, form.get(`active_${country}`) === "on" ? 1 : 0);
    }
  })();
  redirect("/admin/shipping?saved=1");
}

// ---------------- settings ----------------
export async function saveSettings(form: FormData) {
  await requireAdmin();
  const rate = num(form, "tax_rate") ?? 0;
  if (rate < 0 || rate > 50) back("/admin/settings", "نسبة الضريبة يجب أن تكون بين 0 و 50.");
  setSetting("tax_rate", String(rate));
  setSetting("tax_inclusive", form.get("tax_inclusive") === "on" ? "true" : "false");
  redirect("/admin/settings?saved=1");
}

// ---------------- change password ----------------
export async function changeAdminPassword(form: FormData) {
  const admin = await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
  db().prepare("UPDATE promos SET active = 1 - active WHERE id = ?").run(str(form, "id"));
  redirect("/admin/ticker");
}
export async function deletePromo(form: FormData) {
  await requireAdmin();
  db().prepare("DELETE FROM promos WHERE id = ?").run(str(form, "id"));
  redirect("/admin/ticker");
}

// ---------------- feedback moderation ----------------
export async function setFeedbackStatus(form: FormData) {
  await requireAdmin();
  const status = str(form, "status");
  if (!["new", "approved", "hidden", "done"].includes(status)) back("/admin/feedback", "حالة غير صحيحة.");
  db().prepare("UPDATE feedback SET status = ? WHERE id = ?").run(status, str(form, "id"));
  redirect("/admin/feedback");
}
