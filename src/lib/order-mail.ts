import { db } from "@/lib/db";
import { emailEnabled, orderEmail, sendEmail, shippedEmail } from "@/lib/email";
import { trackingUrl } from "@/lib/shipping/tracking-url";

type Row = { id: string; email: string; locale: string | null; total_minor: number; currency: string; address_json: string };

/**
 * Sends the "order confirmed" e-mail once per paid order. The order is claimed in the database first, so two
 * callers (payment return + background watch) can never send it twice. If the e-mail service fails the claim
 * is released and the background watch tries again later. Never throws: an e-mail problem must not touch the order.
 */
export async function sendOrderConfirmation(orderId: string): Promise<"sent" | "skipped" | "failed"> {
  try {
    if (!emailEnabled()) return "skipped";
    const c = db();
    const claim = c.prepare("UPDATE orders SET confirm_mail_at = datetime('now') WHERE id = ? AND confirm_mail_at IS NULL AND payment_status = 'paid' AND status != 'cancelled'").run(orderId);
    if (claim.changes !== 1) return "skipped";
    const o = c.prepare("SELECT id, email, locale, total_minor, currency, address_json FROM orders WHERE id = ?").get(orderId) as Row;
    const lines = c.prepare("SELECT name_ar, name_en, quantity FROM order_lines WHERE order_id = ? ORDER BY id").all(orderId) as { name_ar: string; name_en: string; quantity: number }[];
    const locale = o.locale === "en" ? "en" : "ar";
    let name = "";
    try { name = String((JSON.parse(o.address_json) as { name?: string }).name ?? ""); } catch { /* keep empty */ }
    const mail = orderEmail(locale, {
      id: o.id, name: name.slice(0, 80), total: o.total_minor / 100, currency: o.currency,
      lines: lines.map((l) => ({ name: locale === "en" ? l.name_en || l.name_ar : l.name_ar || l.name_en, quantity: l.quantity })),
    });
    if (await sendEmail(o.email, mail.subject, mail.html, mail.text)) return "sent";
    c.prepare("UPDATE orders SET confirm_mail_at = NULL WHERE id = ?").run(orderId);
    return "failed";
  } catch (e) {
    console.log("[order-mail-error]", e instanceof Error ? e.message : String(e));
    return "failed";
  }
}

/** Paid orders of the last two days that still have no confirmation e-mail (service was down, or the owner marked them paid by hand). */
export async function sendPendingOrderConfirmations(limit = 10): Promise<number> {
  if (!emailEnabled()) return 0;
  const rows = db().prepare(`SELECT id FROM orders WHERE confirm_mail_at IS NULL AND payment_status = 'paid' AND status != 'cancelled'
    AND created_at >= datetime('now','-2 days') ORDER BY created_at ASC LIMIT ?`).all(Math.max(1, Math.min(25, limit))) as { id: string }[];
  let sent = 0;
  for (const r of rows) if ((await sendOrderConfirmation(r.id)) === "sent") sent++;
  return sent;
}

const CARRIER_NAME: Record<string, string> = { aramex: "Aramex", quiqup: "Quiqup", emx: "EMX" };

/**
 * Sends the "your order has shipped" e-mail once per order, claimed in the database first like the confirmation
 * e-mail. It waits until the order has a tracking number, so the number is always in the e-mail: an order marked
 * shipped without one gets its e-mail automatically as soon as the number is saved. Never throws and never changes the order itself.
 */
export async function sendShippedEmail(orderId: string): Promise<"sent" | "skipped" | "failed"> {
  try {
    if (!emailEnabled()) return "skipped";
    const c = db();
    const claim = c.prepare("UPDATE orders SET ship_mail_at = datetime('now') WHERE id = ? AND ship_mail_at IS NULL AND status = 'shipped' AND COALESCE(tracking_number,'') != ''").run(orderId);
    if (claim.changes !== 1) return "skipped";
    const o = c.prepare("SELECT id, email, locale, address_json, carrier, tracking_number FROM orders WHERE id = ?").get(orderId) as
      { id: string; email: string; locale: string | null; address_json: string; carrier: string | null; tracking_number: string | null };
    const locale = o.locale === "en" ? "en" : "ar";
    let name = "";
    try { name = String((JSON.parse(o.address_json) as { name?: string }).name ?? ""); } catch { /* keep empty */ }
    const tracking = (o.tracking_number ?? "").slice(0, 80);
    const mail = shippedEmail(locale, {
      id: o.id, name: name.slice(0, 80), carrier: o.carrier ? CARRIER_NAME[o.carrier] ?? o.carrier.slice(0, 40) : "",
      tracking, trackUrl: tracking ? trackingUrl(o.carrier, tracking) : "",
    });
    if (await sendEmail(o.email, mail.subject, mail.html, mail.text)) return "sent";
    c.prepare("UPDATE orders SET ship_mail_at = NULL WHERE id = ?").run(orderId);
    return "failed";
  } catch (e) {
    console.log("[ship-mail-error]", e instanceof Error ? e.message : String(e));
    return "failed";
  }
}

/** Shipped orders of the last 30 days that still have no "shipped" e-mail (service was down, or shipped from another screen). */
export async function sendPendingShippedEmails(limit = 10): Promise<number> {
  if (!emailEnabled()) return 0;
  const rows = db().prepare(`SELECT id FROM orders WHERE ship_mail_at IS NULL AND status = 'shipped' AND COALESCE(tracking_number,'') != ''
    AND created_at >= datetime('now','-30 days') ORDER BY created_at ASC LIMIT ?`).all(Math.max(1, Math.min(25, limit))) as { id: string }[];
  let sent = 0;
  for (const r of rows) if ((await sendShippedEmail(r.id)) === "sent") sent++;
  return sent;
}
