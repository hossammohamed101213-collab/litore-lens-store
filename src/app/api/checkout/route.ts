import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getCommerce } from "@/lib/commerce";
import { OutOfStockError } from "@/lib/commerce/db-provider";
import type { Order } from "@/lib/commerce/types";
import { buildQuote } from "@/lib/checkout/quote";
import { sameOrigin } from "@/lib/auth/guards";
import { getCustomer } from "@/lib/auth/session";
import { getPayment, getShipping } from "@/lib/providers";
import { checkoutSchema } from "@/lib/validation/schemas";
import { paymentMode } from "@/lib/payment/mode";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const input = parsed.data;
  // The payment method must match how this server takes payment (a customer can't pick "sample paid" on a live store).
  const allowed = paymentMode() === "cod" ? ["cod"] : ["mock-paid", "mock-fail"];
  if (!allowed.includes(input.paymentMethod)) return NextResponse.json({ error: "invalid_payment_method" }, { status: 400 });
  const commerce = getCommerce();

  // Idempotency: the same key never creates a second order.
  const existing = await commerce.findOrderByKey(input.idempotencyKey);
  if (existing) return NextResponse.json({ orderId: existing.id, duplicate: true });

  // Everything is recomputed on the server — client-side prices are never trusted.
  const quote = await buildQuote({
    lines: input.lines, country: input.address.country, couponCode: input.couponCode, shippingRateId: input.shippingRateId,
  });
  const changed = quote.lines.some((l, i) => l.status !== "ok" || l.quantity !== input.lines[i].quantity);
  if (changed) return NextResponse.json({ error: "stock_changed", lines: quote.lines }, { status: 409 });

  const shipping = getShipping();
  const addr = await shipping.validateAddress(input.address);
  if (!addr.valid) return NextResponse.json({ error: "invalid_address", fields: addr.errors }, { status: 422 });
  if (!quote.rate || quote.rate.id !== input.shippingRateId) return NextResponse.json({ error: "invalid_shipping" }, { status: 422 });

  const orderId = `LT-${randomBytes(4).toString("hex").toUpperCase()}`;
  const session = await getPayment().createSession({
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
    if (e instanceof OutOfStockError) return NextResponse.json({ error: "stock_changed" }, { status: 409 });
    const dup = await commerce.findOrderByKey(input.idempotencyKey); // race on the unique key
    if (dup) return NextResponse.json({ orderId: dup.id, duplicate: true });
    throw e;
  }
  return NextResponse.json({ orderId });
}
