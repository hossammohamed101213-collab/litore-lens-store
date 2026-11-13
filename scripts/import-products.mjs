// One-time import of the first 10 lens products (photos + specs). Prices and stock are left for the owner to set.
// Safe to run again: it runs only once per database (marker in settings) and never overwrites an existing slug.
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "seed-products");
const file = path.resolve(process.env.DATABASE_PATH ?? "./data/litore.db");
const uploads = path.resolve(process.env.UPLOAD_DIR ?? path.join(path.dirname(file), "uploads"));
if (!fs.existsSync(file)) { console.log("No database yet — start the app once, then run again."); process.exit(0); }
const db = new Database(file);
db.pragma("foreign_keys = ON");
const done = db.prepare("SELECT value FROM settings WHERE key = 'seed_products_v1'").get();
if (done && process.argv[2] !== "--force") { console.log("Products already imported — nothing to do."); process.exit(0); }
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
fs.mkdirSync(uploads, { recursive: true });
const cols = new Set(db.prepare("PRAGMA table_info(products)").all().map((c) => c.name));
let added = 0;
db.transaction(() => {
  for (const p of manifest) {
    if (db.prepare("SELECT 1 FROM products WHERE slug = ?").get(p.slug)) continue;
    const id = randomUUID();
    db.prepare(`INSERT INTO products (id,slug,name_ar,name_en,short_ar,short_en,desc_ar,desc_en,price_minor,currency,color_family,swatch,diameter,status,is_sample)
      VALUES (?,?,?,?,?,?,?,?,0,'AED',?,?,?,'active',0)`).run(id, p.slug, p.name_ar, p.name_en, p.short_ar, p.short_en, p.desc_ar, p.desc_en, p.family, p.swatch, p.diameter);
    if (cols.has("spin")) db.prepare("UPDATE products SET spin = 0 WHERE id = ?").run(id);
    db.prepare("INSERT INTO variants(id,product_id,sku,title_ar,title_en,option_value,stock) VALUES (?,?,?,?,?,?,0)").run(randomUUID(), id, p.sku, "قياسي", "Standard", "");
    let first = null;
    p.images.forEach((img, i) => {
      const name = `${randomUUID()}.webp`;
      fs.copyFileSync(path.join(root, p.slug, img), path.join(uploads, name));
      db.prepare("INSERT INTO product_images(id,product_id,file,sort) VALUES (?,?,?,?)").run(randomUUID(), id, name, i + 1);
      first ??= name;
    });
    db.prepare("UPDATE products SET image = ? WHERE id = ?").run(first, id);
    added++;
  }
  db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES ('seed_products_v1', ?)").run(new Date().toISOString());
})();
console.log(`Imported ${added} products.`);
