import type Database from "better-sqlite3";
import { mockProducts } from "@/lib/commerce/mock-data";

/**
 * DEV/DEMO ONLY (SEED_SAMPLE=true). Inserts clearly-flagged sample products
 * and a sample shipping zone + coupon so the store can be previewed.
 * Never enable on the production database.
 */
export function seedSampleData(conn: Database.Database) {
  const has = conn.prepare("SELECT COUNT(*) c FROM products").get() as { c: number };
  if (has.c > 0) return;
  const insP = conn.prepare(`INSERT INTO products
    (id,slug,name_ar,name_en,short_ar,short_en,desc_ar,desc_en,price_minor,currency,color_family,swatch,status,is_sample)
    VALUES (@id,@slug,@name_ar,@name_en,@short_ar,@short_en,@desc_ar,@desc_en,@price_minor,@currency,@color_family,@swatch,'active',1)`);
  const insV = conn.prepare(`INSERT INTO variants (id,product_id,sku,title_ar,title_en,option_value,stock)
    VALUES (@id,@product_id,@sku,@title_ar,@title_en,@option_value,@stock)`);
  conn.transaction(() => {
    for (const p of mockProducts) {
      insP.run({
        id: p.id, slug: p.slug, name_ar: p.name.ar, name_en: p.name.en,
        short_ar: p.shortDescription.ar, short_en: p.shortDescription.en,
        desc_ar: p.description.ar, desc_en: p.description.en,
        price_minor: Math.round(p.price * 100), currency: p.currency,
        color_family: p.colorFamily ?? null, swatch: p.swatch ?? null,
      });
      for (const v of p.variants) {
        insV.run({ id: v.id, product_id: p.id, sku: v.sku, title_ar: v.title.ar, title_en: v.title.en, option_value: v.options.color ?? "", stock: v.inventoryQuantity });
      }
    }
    conn.prepare("INSERT OR IGNORE INTO coupons(code,kind,value) VALUES ('SAMPLE10','percent',10)").run();
    const zone = conn.prepare("INSERT OR IGNORE INTO shipping_zones(country,label_ar,label_en,price_minor) VALUES (?,?,?,0)");
    for (const c of ["AE", "SA", "KW", "QA", "BH", "OM"]) zone.run(c, "شحن تجريبي", "Sample shipping");
  })();
}
