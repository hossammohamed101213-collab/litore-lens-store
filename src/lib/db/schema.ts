/** SQLite schema. Money is stored in minor units (x100) to avoid float drift. */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL, name_en TEXT NOT NULL,
  short_ar TEXT NOT NULL DEFAULT '', short_en TEXT NOT NULL DEFAULT '',
  desc_ar TEXT NOT NULL DEFAULT '', desc_en TEXT NOT NULL DEFAULT '',
  price_minor INTEGER NOT NULL DEFAULT 0,
  compare_at_minor INTEGER,
  currency TEXT NOT NULL DEFAULT 'AED',
  color_family TEXT, swatch TEXT,
  look TEXT, wear_duration TEXT, diameter TEXT, base_curve TEXT, water_content TEXT,
  lens_count INTEGER,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  image TEXT,
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL UNIQUE,
  title_ar TEXT NOT NULL, title_en TEXT NOT NULL,
  option_value TEXT NOT NULL DEFAULT '',
  price_minor INTEGER,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON variants(product_id);
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS addresses (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL,
  line1 TEXT NOT NULL, city TEXT NOT NULL, country TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('customer','admin')),
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  email TEXT NOT NULL, phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','processing','shipped','delivered','cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('paid','pending','failed','refunded')),
  subtotal_minor INTEGER NOT NULL, discount_minor INTEGER NOT NULL DEFAULT 0,
  shipping_minor INTEGER NOT NULL DEFAULT 0, tax_minor INTEGER NOT NULL DEFAULT 0,
  total_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  shipping_label_ar TEXT NOT NULL, shipping_label_en TEXT NOT NULL,
  tracking_number TEXT,
  address_json TEXT NOT NULL,
  coupon_code TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  is_mock INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE TABLE IF NOT EXISTS order_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL, product_id TEXT NOT NULL, slug TEXT NOT NULL,
  name_ar TEXT NOT NULL, name_en TEXT NOT NULL, sku TEXT NOT NULL, swatch TEXT, image TEXT,
  unit_minor INTEGER NOT NULL, quantity INTEGER NOT NULL CHECK (quantity > 0)
);
CREATE INDEX IF NOT EXISTS idx_lines_order ON order_lines(order_id);
CREATE TABLE IF NOT EXISTS coupons (
  code TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('percent','fixed')),
  value REAL NOT NULL CHECK (value > 0),
  min_subtotal_minor INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS shipping_zones (
  country TEXT PRIMARY KEY,
  label_ar TEXT NOT NULL, label_en TEXT NOT NULL,
  price_minor INTEGER NOT NULL DEFAULT 0,
  free_over_minor INTEGER,
  min_days INTEGER, max_days INTEGER,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS promos (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL, name_en TEXT NOT NULL,
  discount_percent REAL NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 90),
  price_after_minor INTEGER NOT NULL CHECK (price_after_minor >= 0),
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('review','complaint','suggestion')),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  name TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','approved','hidden','done')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;
