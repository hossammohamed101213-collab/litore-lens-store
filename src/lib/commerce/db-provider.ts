import { notify } from "@/lib/db/notify";
import { db, fromMinor, toMinor } from "@/lib/db";
import { currentUserId } from "@/lib/auth/session";
import type {
  CommerceProvider, CouponResult, LineInput, Order, OrderMeta, Product, ProductQuery, ValidatedLine,
} from "./types";

export class OutOfStockError extends Error {
  constructor() {
    super("out_of_stock");
  }
}

type ProductRow = {
  id: string; slug: string; name_ar: string; name_en: string; short_ar: string; short_en: string;
  desc_ar: string; desc_en: string; price_minor: number; compare_at_minor: number | null; currency: string;
  color_family: string | null; swatch: string | null; look: string | null; wear_duration: string | null;
  diameter: string | null; base_curve: string | null; water_content: string | null; lens_count: number | null;
  status: "draft" | "active" | "archived"; image: string | null; is_sample: number; spin?: number;
};
type VariantRow = {
  id: string; product_id: string; sku: string; title_ar: string; title_en: string;
  option_value: string; price_minor: number | null; stock: number;
};

export const imageUrl = (file: string | null) => (file ? `/uploads/${file}` : undefined);

export function mapProduct(row: ProductRow, variants: VariantRow[], files: string[] = []): Product {
  const list = files.length ? files : row.image ? [row.image] : [];
  return {
    id: row.id,
    slug: row.slug,
    name: { ar: row.name_en || row.name_ar, en: row.name_en || row.name_ar },
    nameAlt: row.name_en && row.name_ar && row.name_ar !== row.name_en ? row.name_ar : undefined,
    shortDescription: { ar: row.short_ar, en: row.short_en },
    description: { ar: row.desc_ar, en: row.desc_en },
    price: fromMinor(row.price_minor),
    compareAtPrice: row.compare_at_minor ? fromMinor(row.compare_at_minor) : undefined,
    currency: row.currency,
    images: list.length ? list.map((f, i) => ({ id: `img-${row.id}-${i}`, alt: { ar: row.name_en || row.name_ar, en: row.name_en || row.name_ar }, src: imageUrl(f) })) : [{ id: `img-${row.id}`, alt: { ar: row.name_en || row.name_ar, en: row.name_en || row.name_ar }, src: undefined }],
    spin: row.spin === 1,
    variants: variants.map((v) => ({
      id: v.id, sku: v.sku, title: { ar: v.title_ar, en: v.title_en },
      options: { color: v.option_value }, price: v.price_minor == null ? undefined : fromMinor(v.price_minor),
      inventoryQuantity: v.stock,
    })),
    colorFamily: row.color_family ?? undefined,
    swatch: row.swatch ?? undefined,
    look: row.look ?? undefined,
    wearDuration: row.wear_duration ?? undefined,
    diameter: row.diameter ?? undefined,
    baseCurve: row.base_curve ?? undefined,
    waterContent: row.water_content ?? undefined,
    lensCount: row.lens_count ?? undefined,
    status: row.status,
    isMock: row.is_sample === 1,
  };
}

function loadProducts(rows: ProductRow[]): Product[] {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const vs = db()
    .prepare(`SELECT * FROM variants WHERE product_id IN (${ids.map(() => "?").join(",")}) ORDER BY rowid`)
    .all(...ids) as VariantRow[];
  const imgs = db()
    .prepare(`SELECT product_id, file FROM product_images WHERE product_id IN (${ids.map(() => "?").join(",")}) ORDER BY sort, rowid`)
    .all(...ids) as { product_id: string; file: string }[];
  return rows.map((r) => mapProduct(r, vs.filter((v) => v.product_id === r.id), imgs.filter((i) => i.product_id === r.id).map((i) => i.file)));
}

type OrderRow = {
  id: string; status: Order["status"]; payment_status: Order["paymentStatus"]; subtotal_minor: number;
  discount_minor: number; shipping_minor: number; tax_minor: number; total_minor: number; currency: string;
  shipping_label_ar: string; shipping_label_en: string; tracking_number: string | null; is_mock: number; created_at: string;
};
type LineRow = {
  variant_id: string; product_id: string; slug: string; name_ar: string; name_en: string; sku: string;
  swatch: string | null; image: string | null; unit_minor: number; quantity: number;
};

export function mapOrder(o: OrderRow): Order {
  const lines = db().prepare("SELECT * FROM order_lines WHERE order_id = ? ORDER BY id").all(o.id) as LineRow[];
  return {
    id: o.id,
    createdAt: o.created_at.replace(" ", "T") + "Z",
    status: o.status,
    paymentStatus: o.payment_status,
    lines: lines.map((l) => ({
      variantId: l.variant_id, productId: l.product_id, slug: l.slug, name: { ar: l.name_en || l.name_ar, en: l.name_en || l.name_ar },
      sku: l.sku, swatch: l.swatch ?? undefined, image: imageUrl(l.image), unitPrice: fromMinor(l.unit_minor),
      currency: o.currency, quantity: l.quantity, maxQuantity: l.quantity, status: "ok" as const,
    })),
    subtotal: fromMinor(o.subtotal_minor),
    discount: fromMinor(o.discount_minor),
    shipping: fromMinor(o.shipping_minor),
    tax: fromMinor(o.tax_minor),
    total: fromMinor(o.total_minor),
    currency: o.currency,
    shippingLabel: { ar: o.shipping_label_ar, en: o.shipping_label_en },
    trackingNumber: o.tracking_number ?? undefined,
    isMock: o.is_mock === 1,
  };
}

export class DbCommerceProvider implements CommerceProvider {
  readonly name = "db";

  async listProducts(query: ProductQuery = {}): Promise<Product[]> {
    const where = ["status = 'active'"];
    const args: (string | number)[] = [];
    if (query.colorFamily) { where.push("color_family = ?"); args.push(query.colorFamily); }
    if (query.search) {
      where.push("(name_ar LIKE ? OR name_en LIKE ?)");
      const q = `%${query.search.replace(/[%_]/g, "")}%`;
      args.push(q, q);
    }
    const order =
      query.sort === "price-asc" ? "price_minor ASC" :
      query.sort === "price-desc" ? "price_minor DESC" :
      query.sort === "newest" ? "created_at DESC, rowid DESC" : "rowid ASC";
    const limit = query.limit ? ` LIMIT ${Math.max(1, Math.floor(query.limit))}` : "";
    const rows = db().prepare(`SELECT * FROM products WHERE ${where.join(" AND ")} ORDER BY ${order}${limit}`).all(...args) as ProductRow[];
    return loadProducts(rows);
  }

  async getProductBySlug(slug: string): Promise<Product | null> {
    const row = db().prepare("SELECT * FROM products WHERE slug = ? AND status = 'active'").get(slug) as ProductRow | undefined;
    return row ? loadProducts([row])[0] : null;
  }

  async validateLines(lines: LineInput[]): Promise<ValidatedLine[]> {
    const conn = db();
    return lines.map((line) => {
      const v = conn.prepare("SELECT * FROM variants WHERE id = ?").get(line.variantId) as VariantRow | undefined;
      const p = v ? (conn.prepare("SELECT * FROM products WHERE id = ? AND status = 'active'").get(v.product_id) as ProductRow | undefined) : undefined;
      if (!v || !p) {
        return { variantId: line.variantId, productId: "", slug: "", name: { ar: "", en: "" }, sku: "", unitPrice: 0, currency: "AED", quantity: 0, maxQuantity: 0, status: "not_found" as const };
      }
      // A product whose price has not been set yet can never be bought.
      const priced = fromMinor(v.price_minor ?? p.price_minor) > 0;
      const max = priced ? Math.max(0, Math.min(v.stock, 10)) : 0;
      const wanted = Math.max(1, Math.floor(line.quantity));
      const quantity = max === 0 ? 0 : Math.min(wanted, max);
      return {
        variantId: v.id, productId: p.id, slug: p.slug, name: { ar: p.name_en || p.name_ar, en: p.name_en || p.name_ar }, sku: v.sku,
        swatch: p.swatch ?? undefined, image: imageUrl(p.image), isMock: p.is_sample === 1,
        unitPrice: fromMinor(v.price_minor ?? p.price_minor), currency: p.currency, quantity, maxQuantity: max,
        status: max === 0 ? ("out_of_stock" as const) : quantity < wanted ? ("limited" as const) : ("ok" as const),
      };
    });
  }

  async validateCoupon(code: string, subtotal: number): Promise<CouponResult> {
    const c = db().prepare("SELECT * FROM coupons WHERE code = ? AND active = 1").get(code.trim().toUpperCase()) as
      | { code: string; kind: "percent" | "fixed"; value: number; min_subtotal_minor: number; max_uses: number | null; used_count: number; customer_id: string | null } | undefined;
    if (!c || toMinor(subtotal) < c.min_subtotal_minor) return { valid: false, code, discount: 0 };
    if (c.max_uses != null && c.used_count >= c.max_uses) return { valid: false, code, discount: 0 };
    // Personal coupons (welcome / referral rewards) only work for the signed-in owner.
    if (c.customer_id && (await currentUserId("customer")) !== c.customer_id) return { valid: false, code, discount: 0 };
    const raw = c.kind === "percent" ? (subtotal * c.value) / 100 : c.value;
    return { valid: true, code: c.code, discount: Math.min(subtotal, Math.round(raw * 100) / 100) };
  }

  /** Creates the order and decrements stock atomically; throws OutOfStockError if stock ran out. */
  async saveOrder(order: Order, idempotencyKey: string, meta: OrderMeta): Promise<Order> {
    const conn = db();
    conn.transaction(() => {
      const dec = conn.prepare("UPDATE variants SET stock = stock - ? WHERE id = ? AND stock >= ?");
      for (const l of order.lines) if (dec.run(l.quantity, l.variantId, l.quantity).changes === 0) throw new OutOfStockError();
      conn.prepare(`INSERT INTO orders (id,customer_id,email,phone,status,payment_status,subtotal_minor,discount_minor,shipping_minor,tax_minor,total_minor,currency,shipping_label_ar,shipping_label_en,tracking_number,address_json,coupon_code,idempotency_key,is_mock)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        order.id, meta.customerId ?? null, meta.email, meta.phone, order.status, order.paymentStatus,
        toMinor(order.subtotal), toMinor(order.discount), toMinor(order.shipping), toMinor(order.tax), toMinor(order.total),
        order.currency, order.shippingLabel.ar, order.shippingLabel.en, order.trackingNumber ?? null,
        JSON.stringify(meta.address), meta.couponCode ?? null, idempotencyKey, order.isMock ? 1 : 0,
      );
      if (meta.couponCode) {
        const used = conn.prepare("UPDATE coupons SET used_count = used_count + 1 WHERE code = ? AND (max_uses IS NULL OR used_count < max_uses)").run(meta.couponCode.toUpperCase());
        if (used.changes === 0) throw new Error("coupon_exhausted");
      }
      const insL = conn.prepare(`INSERT INTO order_lines (order_id,variant_id,product_id,slug,name_ar,name_en,sku,swatch,image,unit_minor,quantity) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
      for (const l of order.lines) {
        insL.run(order.id, l.variantId, l.productId, l.slug, l.name.ar, l.name.en, l.sku, l.swatch ?? null, l.image?.replace("/uploads/", "") ?? null, toMinor(l.unitPrice), l.quantity);
      }
    })();
    notify("order", `طلب جديد ${order.id}`, `${meta.phone} — الإجمالي ${order.total} ${order.currency}`, `/admin/orders`);
    for (const l of order.lines) {
      const r = conn.prepare("SELECT stock FROM variants WHERE id = ?").get(l.variantId) as { stock: number } | undefined;
      if (r && r.stock <= 3) notify("stock", "مخزون منخفض", `${l.name.ar} — المتبقي ${r.stock}`, "/admin/products");
    }
    return order;
  }

  async getOrder(id: string): Promise<Order | null> {
    const row = db().prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow | undefined;
    return row ? mapOrder(row) : null;
  }

  async findOrderByKey(key: string): Promise<Order | null> {
    const row = db().prepare("SELECT * FROM orders WHERE idempotency_key = ?").get(key) as OrderRow | undefined;
    return row ? mapOrder(row) : null;
  }
}
