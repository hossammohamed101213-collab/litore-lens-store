import { randomBytes } from "node:crypto";
import { sendOrderConfirmation } from "@/lib/order-mail";
import { NextResponse } from "next/server";
import { getCommerce } from "@/lib/commerce";
import { OutOfStockError } from "@/lib/commerce/db-provider";
import type { Order } from "@/lib/commerce/types";
import { buildQuote } from "@/lib/checkout/quote";
import { clientIp, rateLimited, sameOrigin } from "@/lib/auth/guards";
import { getCustomer } from "@/lib/auth/session";
import { getPayment, getShipping } from "@/lib/providers";
import { checkoutSchema } from "@/lib/validation/schemas";
import { paymentOptions } from "@/lib/payment/mode";
import { createTelrOrder, telrConfig } from "@/lib/payment/telr";
import { createPaymenntCheckout, paymenntConfig } from "@/lib/payment/paymennt";
import { createZiinaPaymentIntent, ziinaConfig } from "@/lib/payment/ziina";
import { createStripeCheckout, stripeConfig } from "@/lib/payment/stripe";
import { recordError } from "@/lib/ops/errors";
import { pendingTimeoutMinutes } from "@/lib/payment/reconcile";
import { db } from "@/lib/db";
import { isUaePhone } from "@/lib/phone";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (rateLimited(`checkout:${clientIp(request)}`, 600)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const input = parsed.data;
  // The payment method must match how this server takes payment (a customer can't pick "sample paid" on a live store).
  const opts = paymentOptions();
  const allowed = [...(opts.online ? ["online"] : []), ...(opts.mock ? ["mock-paid", "mock-fail"] : [])];
  if (!allowed.includes(input.paymentMethod)) return NextResponse.json({ error: "invalid_payment_method" }, { status: 400 });
  const commerce = getCommerce();

  // Idempotency: the same key never creates a second order.
  const existing = await commerce.findOrderByKey(input.idempotencyKey);
  if (existing) return NextResponse.json({ orderId: existing.id, duplicate: true });

  // Everything is recomputed on the server — client-side prices are never trusted.
  const quote = await buildQuote({
    lines: input.lines, country: input.address.country, city: input.address.city, couponCode: input.couponCode, shippingRateId: input.shippingRateId,
  });
  const changed = quote.lines.some((l, i) => l.status !== "ok" || l.quantity !== input.lines[i].quantity);
  if (changed) return NextResponse.json({ error: "stock_changed", lines: quote.lines }, { status: 409 });
  // The customer was shown a discounted total: if the coupon stopped being valid in the meantime, stop here
  // instead of silently charging the full price.
  if (input.couponCode && !quote.couponValid) return NextResponse.json({ error: "coupon_invalid" }, { status: 409 });

  // Delivery inside the UAE is by a local courier who phones the customer: a UAE address needs a UAE number, and it is
  // refused here, before any payment, rather than after the order is paid and can not be shipped.
  if (input.address.country === "AE" && !isUaePhone(input.contact.phone || input.address.phone)) return NextResponse.json({ error: "invalid_address", fields: ["phone"] }, { status: 422 });
  const shipping = getShipping();
  const addr = await shipping.validateAddress(input.address);
  if (!addr.valid) return NextResponse.json({ error: "invalid_address", fields: addr.errors }, { status: 422 });
  if (!quote.rate || quote.rate.id !== input.shippingRateId) return NextResponse.json({ error: "invalid_shipping" }, { status: 422 });

  const orderId = `LT-${randomBytes(6).toString("hex").toUpperCase()}`;
  let onlineSession: { ref: string; url: string } | null = null;
  let gateway: "paymennt" | "ziina" | "stripe" | "telr" | null = null;
  if (input.paymentMethod === "online") {
    // Priority: Paymennt → Ziina → Stripe → Telr (the admin panel keeps only one switched on at a time)
    const pmCfg = paymenntConfig();
    const znCfg = !pmCfg ? ziinaConfig() : null;
    const stCfg = !pmCfg && !znCfg ? stripeConfig() : null;
    const tlCfg = !pmCfg && !znCfg && !stCfg ? telrConfig() : null;
    if (!pmCfg && !znCfg && !stCfg && !tlCfg) return NextResponse.json({ error: "payment_failed" }, { status: 402 });
    try {
      if (pmCfg) {
        const pm = await createPaymenntCheckout(pmCfg, {
          orderId, amountMajor: quote.totals.total, currency: quote.lines[0].currency,
          locale: input.locale, email: input.contact.email, name: input.address.name, phone: input.contact.phone,
          address: input.address,
        });
        onlineSession = { ref: pm.id, url: pm.url }; gateway = "paymennt";
      } else if (znCfg) {
        const zn = await createZiinaPaymentIntent(znCfg, {
          orderId, amountMajor: quote.totals.total, currency: quote.lines[0].currency,
          locale: input.locale,
        });
        onlineSession = { ref: zn.id, url: zn.url }; gateway = "ziina";
      } else if (stCfg) {
        const st = await createStripeCheckout(stCfg, {
          orderId, amountMajor: quote.totals.total, currency: quote.lines[0].currency,
          locale: input.locale, email: input.contact.email, expiresInMinutes: pendingTimeoutMinutes() || 60,
        });
        onlineSession = { ref: st.id, url: st.url }; gateway = "stripe";
      } else if (tlCfg) {
        onlineSession = await createTelrOrder(tlCfg, {
          orderId, amountMajor: quote.totals.total, currency: quote.lines[0].currency,
          locale: input.locale, email: input.contact.email, name: input.address.name, phone: input.contact.phone,
        });
        gateway = "telr";
      }
    } catch (e) {
      // the gateway refused to open a payment page: keep the reason where the owner can see it (admin → errors)
      try { recordError("server", `payment page not opened: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300), "POST /api/checkout"); } catch { /* never make a failing request worse */ }
      return NextResponse.json({ error: "payment_failed" }, { status: 402 });
    }
  }
  const session = onlineSession
    ? { id: onlineSession.ref, status: "pending" as const }
    : await getPayment().createSession({
        orderId, amount: quote.totals.total, currency: quote.lines[0].currency,
        idempotencyKey: input.idempotencyKey, method: input.paymentMethod,
      });
  if (session.status === "failed") return NextResponse.json({ error: "payment_failed" }, { status: 402 });

  const customer = await getCustomer();
  const order: Order = {
    id: orderId,
    createdAt: new Date().toISOString(),
    status: "new",
    paymentStatus: session.status === "paid" ? "paid" : "pending",
    lines: quote.lines,
    ...quote.totals,
    currency: quote.lines[0].currency,
    shippingLabel: quote.rate.label,
    isMock: quote.lines.every((l) => l.isMock),
  };

  try {
    await commerce.saveOrder(order, input.idempotencyKey, {
      customerId: customer?.id, email: input.contact.email, phone: input.contact.phone,
      address: input.address, couponCode: quote.couponValid ? input.couponCode?.toUpperCase() : undefined,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "coupon_exhausted") return NextResponse.json({ error: "coupon_used" }, { status: 409 });
    if (e instanceof OutOfStockError) return NextResponse.json({ error: "stock_changed" }, { status: 409 });
    const dup = await commerce.findOrderByKey(input.idempotencyKey); // race on the unique key
    if (dup) return NextResponse.json({ orderId: dup.id, duplicate: true });
    throw e;
  }
  db().prepare("UPDATE orders SET locale = ? WHERE id = ?").run(input.locale, orderId);
  if (onlineSession) {
    db().prepare("UPDATE orders SET payment_ref = ?, payment_gateway = ? WHERE id = ?").run(onlineSession.ref, gateway, orderId);
    return NextResponse.json({ orderId, redirectUrl: onlineSession.url });
  }
  if (order.paymentStatus === "paid") void sendOrderConfirmation(orderId); // never blocks or fails the order
  return NextResponse.json({ orderId });
}
