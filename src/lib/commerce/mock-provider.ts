import { mockProducts } from "./mock-data";
import type {
  CommerceProvider, CouponResult, LineInput, Order, Product, ProductQuery, ValidatedLine,
} from "./types";

/** In-memory store so orders survive between requests while the server runs. */
const g = globalThis as unknown as { __litoreOrders?: Map<string, Order>; __litoreKeys?: Map<string, string> };
const orders = (g.__litoreOrders ??= new Map());
const keys = (g.__litoreKeys ??= new Map());

/** MOCK coupon for testing only. Real coupons come from the commerce backend. */
const MOCK_COUPONS: Record<string, number> = { SAMPLE10: 0.1 };

export class MockCommerceProvider implements CommerceProvider {
  readonly name = "mock";

  async listProducts(query: ProductQuery = {}): Promise<Product[]> {
    let items = mockProducts.filter((p) => p.status === "active");
    if (query.colorFamily) items = items.filter((p) => p.colorFamily === query.colorFamily);
    if (query.search) {
      const q = query.search.toLowerCase();
      items = items.filter((p) => `${p.name.ar} ${p.name.en}`.toLowerCase().includes(q));
    }
    if (query.sort === "price-asc") items = [...items].sort((a, b) => a.price - b.price);
    if (query.sort === "price-desc") items = [...items].sort((a, b) => b.price - a.price);
    return query.limit ? items.slice(0, query.limit) : items;
  }

  async getProductBySlug(slug: string): Promise<Product | null> {
    return mockProducts.find((p) => p.slug === slug) ?? null;
  }

  async validateLines(lines: LineInput[]): Promise<ValidatedLine[]> {
    return lines.map((line) => {
      const product = mockProducts.find((p) => p.variants.some((v) => v.id === line.variantId));
      const variant = product?.variants.find((v) => v.id === line.variantId);
      if (!product || !variant || product.status !== "active") {
        return {
          variantId: line.variantId, productId: "", slug: "", name: { ar: "", en: "" }, sku: "",
          unitPrice: 0, currency: "AED", quantity: 0, maxQuantity: 0, status: "not_found" as const,
        };
      }
      const max = Math.max(0, Math.min(variant.inventoryQuantity, 10));
      const quantity = Math.min(Math.max(1, Math.floor(line.quantity)), Math.max(max, 1));
      const status = max === 0 ? "out_of_stock" : quantity < line.quantity ? "limited" : "ok";
      return {
        variantId: variant.id, productId: product.id, slug: product.slug, name: product.name,
        sku: variant.sku, swatch: product.swatch, isMock: product.isMock,
        unitPrice: variant.price ?? product.price, currency: product.currency,
        quantity: max === 0 ? 0 : quantity, maxQuantity: max, status,
      };
    });
  }

  async validateCoupon(code: string, subtotal: number): Promise<CouponResult> {
    const rate = MOCK_COUPONS[code.trim().toUpperCase()];
    if (!rate) return { valid: false, code, discount: 0 };
    return { valid: true, code: code.trim().toUpperCase(), discount: Math.round(subtotal * rate * 100) / 100 };
  }

  async saveOrder(order: Order, idempotencyKey: string, _meta?: unknown) {
    orders.set(order.id, order);
    keys.set(idempotencyKey, order.id);
    return order;
  }

  async getOrder(id: string) {
    return orders.get(id) ?? null;
  }

  async findOrderByKey(key: string) {
    const id = keys.get(key);
    return id ? (orders.get(id) ?? null) : null;
  }
}
