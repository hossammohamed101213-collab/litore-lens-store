import { createHmac, timingSafeEqual } from "node:crypto";
import { getSecret, hasSecret } from "@/lib/secrets";
import { getSetting } from "@/lib/db";

/** ZIINA_ENDPOINT overrides the address (tests only). */
export const ziinaEndpoint = () => process.env.ZIINA_ENDPOINT ?? "https://api-v2.ziina.com/api";
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "https://litore.store").replace(/\/$/, "");

export type ZiinaConfig = { apiKey: string; test: boolean };

/** `evenIfOff` is for orders that were already sent to Ziina: they must still be checked after the owner switches it off. */
export function ziinaConfig(evenIfOff = false): ZiinaConfig | null {
  if (!evenIfOff && getSetting("pay_ziina_enabled") !== "1") return null;
  const apiKey = getSecret("pay_ziina_key");
  if (!apiKey) return null;
  return { apiKey, test: getSetting("pay_ziina_mode", "test") !== "live" };
}
export const ziinaReady = () => hasSecret("pay_ziina_key");

/** Creates a Ziina Payment Intent and returns the redirect URL. Amount is in MAJOR units (AED); Ziina expects MINOR (fils). */
export async function createZiinaPaymentIntent(
  cfg: ZiinaConfig,
  o: { orderId: string; amountMajor: number; currency: string; locale: string; message?: string },
): Promise<{ id: string; url: string }> {
  const base = siteUrl();
  const returnUrl = `${base}/api/payment/ziina/return?order=${encodeURIComponent(o.orderId)}&l=${o.locale}`;
  const body = {
    amount: Math.round(o.amountMajor * 100), // minor units (1000 = 10 AED)
    currency_code: o.currency,
    message: o.message ?? `Litore order ${o.orderId}`,
    success_url: returnUrl,
    cancel_url: returnUrl, // the return route asks Ziina what really happened, whatever the customer clicked
    failure_url: returnUrl,
    test: cfg.test,
  };
  const res = await fetch(`${ziinaEndpoint()}/payment_intent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ziina_create_failed:${res.status}:${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { id?: string; redirect_url?: string };
  if (!data.id || !data.redirect_url) throw new Error("ziina_create_failed:no_redirect");
  return { id: data.id, url: data.redirect_url };
}

/** Server-side check: GET /payment_intent/{id}. */
export async function checkZiinaPayment(
  cfg: ZiinaConfig,
  intentId: string,
): Promise<{ paid: boolean; failed: boolean; amount?: number; currency?: string; status?: string }> {
  const res = await fetch(`${ziinaEndpoint()}/payment_intent/${encodeURIComponent(intentId)}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`ziina_check_failed:${res.status}`);
  const data = (await res.json()) as { status?: string; amount?: number; currency_code?: string };
  return {
    paid: data.status === "completed",
    failed: data.status === "failed" || data.status === "canceled",
    amount: data.amount,
    currency: data.currency_code,
    status: data.status,
  };
}

/** Verify Ziina webhook signature: X-Hmac-Signature = hex SHA-256 HMAC(secret, body). Uses timingSafeEqual to prevent timing attacks. */
export function verifyZiinaWebhook(payload: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(signature, "utf8"));
}
