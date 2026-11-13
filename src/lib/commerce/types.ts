export type LocalizedText = { ar: string; en: string };

export type ProductImage = { id: string; alt: LocalizedText; src?: string };

export type ProductVariant = {
  id: string;
  sku: string;
  title: LocalizedText;
  options: Record<string, string>;
  price?: number;
  inventoryQuantity: number;
  imageId?: string;
};

export type Product = {
  id: string;
  slug: string;
  name: LocalizedText;
  shortDescription: LocalizedText;
  description: LocalizedText;
  price: number;
  compareAtPrice?: number;
  currency: string;
  images: ProductImage[];
  /** Photos are a turntable sequence: the product page auto-rotates through them. */
  spin?: boolean;
  variants: ProductVariant[];
  colorFamily?: string;
  /** Hex used only to draw the placeholder lens until real photos exist. */
  swatch?: string;
  look?: string;
  wearDuration?: string;
  diameter?: string;
  baseCurve?: string;
  waterContent?: string;
  lensCount?: number;
  status: "draft" | "active" | "archived";
  /** True for sample data. Must be false/absent for production products. */
  isMock?: boolean;
};

export type ProductQuery = {
  search?: string;
  colorFamily?: string;
  sort?: "recommended" | "newest" | "price-asc" | "price-desc";
  limit?: number;
};

export type CartLine = {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
};

export type Cart = {
  id: string;
  currency: string;
  lines: CartLine[];
};

/** Every commerce backend (Shopify, Woo, Medusa, ...) implements this. */
export interface CommerceProvider {
  readonly name: string;
  listProducts(query?: ProductQuery): Promise<Product[]>;
  getProductBySlug(slug: string): Promise<Product | null>;
  /** Server-side truth for price + stock. Never trust client values. */
  validateLines(lines: LineInput[]): Promise<ValidatedLine[]>;
  validateCoupon(code: string, subtotal: number): Promise<CouponResult>;
  saveOrder(order: Order, idempotencyKey: string, meta: OrderMeta): Promise<Order>;
  getOrder(id: string): Promise<Order | null>;
  findOrderByKey(idempotencyKey: string): Promise<Order | null>;
}

// ---------- Cart / order contracts ----------
export type LineInput = { variantId: string; quantity: number };

export type ValidatedLine = {
  variantId: string;
  productId: string;
  slug: string;
  name: LocalizedText;
  sku: string;
  swatch?: string;
  /** Uploaded photo URL when the product has one. */
  image?: string;
  isMock?: boolean;
  unitPrice: number;
  currency: string;
  quantity: number;
  maxQuantity: number;
  status: "ok" | "limited" | "out_of_stock" | "not_found";
};

export type CouponResult = { valid: boolean; code: string; discount: number };

export type ContactInput = { email: string; phone: string };

export type OrderInput = {
  lines: LineInput[];
  contact: ContactInput;
  address: import("@/lib/shipping/types").Address;
  shippingRateId: string;
  couponCode?: string;
  paymentMethod: string;
  idempotencyKey: string;
  locale: "ar" | "en";
};

export type OrderStatus = "new" | "processing" | "shipped" | "delivered" | "cancelled";
export type PaymentStatus = "paid" | "pending" | "failed" | "refunded";

/** Private order details kept server-side (never shown on the public order page). */
export type OrderMeta = {
  customerId?: string;
  email: string;
  phone: string;
  address: import("@/lib/shipping/types").Address;
  couponCode?: string;
};

export type Order = {
  id: string;
  createdAt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  lines: ValidatedLine[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
  shippingLabel: LocalizedText;
  trackingNumber?: string;
  isMock: boolean;
};
