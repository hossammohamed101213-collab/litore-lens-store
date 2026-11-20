import { getSecret, hasSecret } from "@/lib/secrets";
import { getSetting } from "@/lib/db";

/** STRIPE_ENDPOINT overrides the address (tests only). */
export const stripeEndpoint = () => process.env.STRIPE_ENDPOINT ?? "https://api.stripe.com/v1";
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "https://litore.store").replace(/\/$/, "");

export type StripeConfig = { apiKey: string; test: boolean };

/** A Stripe key says by itself whether it is a test key (sk_test_… / rk_test_…) or a live one. */
export const stripeKeyIsTest = (key: string) => /^(sk|rk)_test_/.test(key);
export const stripeKeyLooksValid = (key: string) => /^(sk|rk)_(test|live)_[A-Za-z0-9]{10,}$/.test(key);

/**
 * `evenIfOff` is for orders that were already sent to Stripe: they must still be checked after the owner switches it off.
 * The key must match the chosen mode: a TEST key in "live" mode would let anyone "pay" with Stripe's test cards,
 * so that combination is treated as "not configured" and checkout stays closed.
 */
export function stripeConfig(evenIfOff = false): StripeConfig | null {
  if (!evenIfOff && getSetting("pay_stripe_enabled") !== "1") return null;
  const apiKey = getSecret("pay_stripe_key");
  if (!apiKey) return null;
  const test = getSetting("pay_stripe_mode", "test") !== "live";
  if (!evenIfOff && stripeKeyIsTest(apiKey) !== test) return null;
  return { apiKey, test };
}
export const stripeReady = () => hasSecret("pay_stripe_key");

const form = (o: Record<string, string | number>) => new URLSearchParams(Object.entries(o).map(([k, v]) => [k, String(v)])).toString();
const headers = (cfg: StripeConfig, extra: Record<string, string> = {}) => ({ Authorization: `Bearer ${cfg.apiKey}`, Accept: "application/json", ...extra });

/**
 * Opens a Stripe Checkout page (hosted by Stripe: the store never sees card details) and returns its address.
 * Amount is in MAJOR units (AED); Stripe expects MINOR (fils). The page closes by itself after `expiresInMinutes`
 * (Stripe allows 30 minutes to 24 hours), so an abandoned payment cannot be completed long after the order was cancelled.
 */
export async function createStripeCheckout(
  cfg: StripeConfig,
  o: { orderId: string; amountMajor: number; currency: string; locale: string; email?: string; expiresInMinutes?: number },
): Promise<{ id: string; url: string }> {
  const back = `${siteUrl()}/api/payment/stripe/return?order=${encodeURIComponent(o.orderId)}&l=${o.locale}`;
  const minutes = Math.max(30, Math.min(24 * 60, Math.round(o.expiresInMinutes ?? 60)));
  const body: Record<string, string | number> = {
    mode: "payment",
    "line_items[0][quantity]": 1,
    "line_items[0][price_data][currency]": o.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": Math.round(o.amountMajor * 100),
    "line_items[0][price_data][product_data][name]": `Litore order ${o.orderId}`,
    client_reference_id: o.orderId,
    "metadata[order_id]": o.orderId,
    "payment_intent_data[metadata][order_id]": o.orderId,
    success_url: back,
    // the return route asks Stripe what really happened, whatever the customer clicked; "left=1" only says she came
    // back through Stripe's own "back" link, so an unpaid page can be closed and the stock freed straight away
    cancel_url: `${back}&left=1`,
    expires_at: Math.floor(Date.now() / 1000) + minutes * 60,
    // Stripe Checkout has no Arabic page: "auto" follows the customer's browser language, English customers get English
    locale: o.locale === "en" ? "en" : "auto",
  };
  if (o.email) body.customer_email = o.email;
  const res = await fetch(`${stripeEndpoint()}/checkout/sessions`, {
    method: "POST",
    // the same order can never open two payments: Stripe returns the first answer again for the same key
    headers: headers(cfg, { "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": `litore-${o.orderId}` }),
    body: form(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`stripe_create_failed:${res.status}:${text.replace(/(sk|rk)_(test|live)_[A-Za-z0-9]+/g, "[key]").slice(0, 200)}`);
  }
  const data = (await res.json()) as { id?: string; url?: string; livemode?: boolean };
  if (!data.id || !data.url) throw new Error("stripe_create_failed:no_url");
  if (typeof data.livemode === "boolean" && data.livemode === cfg.test) throw new Error("stripe_create_failed:mode_mismatch");
  return { id: data.id, url: data.url };
}

/** Server-side check: GET /checkout/sessions/{id}. Amount comes back in MINOR units. */
export async function checkStripePayment(
  cfg: StripeConfig,
  sessionId: string,
): Promise<{ paid: boolean; failed: boolean; waiting: boolean; held: boolean; amount?: number; currency?: string; orderId?: string; status?: string }> {
  const res = await fetch(`${stripeEndpoint()}/checkout/sessions/${encodeURIComponent(sessionId)}`, { headers: headers(cfg), signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`stripe_check_failed:${res.status}`);
  const d = (await res.json()) as { status?: string; payment_status?: string; amount_total?: number; currency?: string; client_reference_id?: string };
  return {
    paid: d.status === "complete" && d.payment_status === "paid",
    failed: d.status === "expired",
    waiting: d.status === "open", // the customer has not paid (yet)
    held: d.status === "complete" && d.payment_status !== "paid", // a delayed payment method: money not confirmed
    amount: d.amount_total,
    currency: d.currency,
    orderId: d.client_reference_id ?? undefined,
    status: `${d.status ?? "?"}/${d.payment_status ?? "?"}`,
  };
}

/** Closes an unpaid Stripe page so it can no longer be paid. true = Stripe confirms it is closed. */
export async function expireStripeCheckout(cfg: StripeConfig, sessionId: string): Promise<boolean> {
  const res = await fetch(`${stripeEndpoint()}/checkout/sessions/${encodeURIComponent(sessionId)}/expire`, { method: "POST", headers: headers(cfg), signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return false;
  const d = (await res.json().catch(() => ({}))) as { status?: string };
  return d.status === "expired";
}

/** Cheap "is this key accepted?" call for the admin test button: reads the account balance, charges nothing. */
export async function pingStripe(cfg: StripeConfig): Promise<{ livemode: boolean }> {
  const res = await fetch(`${stripeEndpoint()}/balance`, { headers: headers(cfg), signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`stripe_ping_failed:${res.status}`);
  const d = (await res.json()) as { livemode?: boolean };
  return { livemode: d.livemode === true };
}
