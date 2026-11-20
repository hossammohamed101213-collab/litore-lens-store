import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";

/** Everything the printed store label shows, read from what was saved with the order. */
export type LabelOrder = {
  id: string; createdAt: string; paidAt: string | null; status: string; paymentStatus: "paid" | "pending" | "failed" | "refunded";
  name: string; phone: string; line1: string; line2: string; city: string; region: string; country: string;
  lines: { nameEn: string; nameAr: string; size: string; quantity: number; total: number }[];
  subtotal: number; discount: number; shipping: number; tax: number; total: number; refunded: number; currency: string;
  gateway: string; carrier: string; tracking: string; token: string; printedAt: string | null;
};
type Row = {
  id: string; created_at: string; paid_at: string | null; status: string; payment_status: LabelOrder["paymentStatus"]; phone: string; address_json: string;
  subtotal_minor: number; discount_minor: number; shipping_minor: number; tax_minor: number; total_minor: number; refund_minor: number | null; currency: string;
  payment_gateway: string | null; carrier: string | null; tracking_number: string | null; receipt_token: string | null; printed_at: string | null;
};
const iso = (s: string | null) => (s ? s.replace(" ", "T") + "Z" : null);

/** The secret part of the receipt link: 20 random URL-safe characters, made once per order and never guessable from the order number. */
export function receiptToken(orderId: string): string {
  const have = db().prepare("SELECT receipt_token t FROM orders WHERE id = ?").get(orderId) as { t: string | null } | undefined;
  if (!have) return "";
  if (have.t) return have.t;
  const t = randomBytes(15).toString("base64url");
  db().prepare("UPDATE orders SET receipt_token = ? WHERE id = ? AND receipt_token IS NULL").run(t, orderId);
  return (db().prepare("SELECT receipt_token t FROM orders WHERE id = ?").get(orderId) as { t: string }).t;
}

function build(r: Row): LabelOrder {
  let a: Record<string, string> = {};
  try { a = JSON.parse(r.address_json); } catch { /* keep empty */ }
  // order lines keep one name (the English one); the Arabic name and the size are read from the product itself
  const lines = db().prepare(`SELECT l.name_en, COALESCE(NULLIF(p.name_ar, ''), l.name_ar) AS name_ar, l.unit_minor, l.quantity, COALESCE(p.diameter, '') AS size
    FROM order_lines l LEFT JOIN products p ON p.id = l.product_id WHERE l.order_id = ? ORDER BY l.id`).all(r.id) as { name_en: string; name_ar: string; unit_minor: number; quantity: number; size: string }[];
  return {
    id: r.id, createdAt: iso(r.created_at)!, paidAt: iso(r.paid_at), status: r.status, paymentStatus: r.payment_status,
    name: a.name ?? "", phone: a.phone || r.phone, line1: a.line1 ?? "", line2: a.line2 ?? "", city: a.city ?? "", region: a.region ?? "", country: a.country ?? "",
    lines: lines.map((l) => ({ nameEn: l.name_en || l.name_ar, nameAr: l.name_ar && l.name_ar !== l.name_en ? l.name_ar : "", size: l.size, quantity: l.quantity, total: (l.unit_minor * l.quantity) / 100 })),
    subtotal: r.subtotal_minor / 100, discount: r.discount_minor / 100, shipping: r.shipping_minor / 100, tax: r.tax_minor / 100, total: r.total_minor / 100,
    refunded: (r.refund_minor ?? 0) / 100, currency: r.currency, gateway: r.payment_gateway ?? "", carrier: r.carrier ?? "", tracking: r.tracking_number ?? "",
    token: r.receipt_token ?? "", printedAt: iso(r.printed_at),
  };
}

export function labelOrder(id: string): LabelOrder | null {
  const r = db().prepare("SELECT * FROM orders WHERE id = ?").get(id) as Row | undefined;
  if (!r) return null;
  if (!r.receipt_token) r.receipt_token = receiptToken(id);
  return build(r);
}

/** Paid and not cancelled: the only orders that may be printed in a batch. */
export const printableInBatch = (o: { paymentStatus: string; status: string }) => o.paymentStatus === "paid" && o.status !== "cancelled";

/** Labels for the chosen orders, oldest first. One order alone prints whatever its state; a batch keeps only paid, not cancelled orders. */
export function labelsFor(ids: string[]): { labels: LabelOrder[]; skipped: string[] } {
  const clean = [...new Set(ids.filter((i) => /^[A-Za-z0-9-]{1,40}$/.test(i)))].slice(0, 100);
  const found = clean.map((i) => labelOrder(i)).filter((o): o is LabelOrder => !!o);
  const labels = (found.length > 1 ? found.filter(printableInBatch) : found).sort((x, y) => x.createdAt.localeCompare(y.createdAt) || x.id.localeCompare(y.id));
  return { labels, skipped: clean.filter((i) => !labels.some((l) => l.id === i)) };
}

/** Remembers that these labels went to the printer, so they leave the "ready to print" list. Printing again later is always possible. */
export function markPrinted(ids: string[]) {
  const st = db().prepare("UPDATE orders SET printed_at = datetime('now') WHERE id = ?");
  for (const id of ids.slice(0, 100)) if (/^[A-Za-z0-9-]{1,40}$/.test(id)) st.run(id);
}

/**
 * What a scan of the label's QR code shows. The paper is on the parcel and anyone can scan it, so the page confirms the
 * order and its payment but never repeats the full name, phone, e-mail or street address.
 */
export function receiptByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20}$/.test(token)) return null;
  const r = db().prepare("SELECT * FROM orders WHERE receipt_token = ?").get(token) as Row | undefined;
  if (!r) return null;
  const o = build(r);
  const digits = o.phone.replace(/\D/g, "");
  return {
    id: o.id, createdAt: o.createdAt, paidAt: o.paidAt, status: o.status, paymentStatus: o.paymentStatus,
    firstName: o.name.trim().split(/\s+/)[0] ?? "", phoneEnd: digits.slice(-3), city: o.city,
    lines: o.lines, subtotal: o.subtotal, discount: o.discount, shipping: o.shipping, tax: o.tax, total: o.total, refunded: o.refunded, currency: o.currency,
    carrier: o.carrier, tracking: o.tracking,
  };
}

/** Numbers on the filter cards above the orders list. */
export function orderCounts() {
  const n = (where: string) => (db().prepare(`SELECT COUNT(*) n FROM orders WHERE ${where}`).get() as { n: number }).n;
  return {
    toprint: n("payment_status = 'paid' AND status != 'cancelled' AND printed_at IS NULL"),
    unpaid: n("payment_status = 'pending' AND status != 'cancelled'"),
    toship: n("payment_status = 'paid' AND status IN ('new','processing')"),
    new: n("status = 'new'"), processing: n("status = 'processing'"), shipped: n("status = 'shipped'"), delivered: n("status = 'delivered'"), cancelled: n("status = 'cancelled'"),
    all: n("1 = 1"),
  };
}
