import { createHmac, timingSafeEqual } from "node:crypto";
import { getSecret, hasSecret } from "@/lib/secrets";
import { getSetting } from "@/lib/db";

const SANDBOX_URL = "https://api.test.paymennt.com/mer/v2.0";
const LIVE_URL = "https://api.paymennt.com/mer/v2.0";
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "https://litore.store").replace(/\/$/, "");

export type PaymenntConfig = { apiKey: string; apiSecret: string; test: boolean };

/** `evenIfOff` is for orders that were already sent to Paymennt: they must still be checked after the owner switches it off. */
export function paymenntConfig(evenIfOff = false): PaymenntConfig | null {
  if (!evenIfOff && getSetting("pay_paymennt_enabled") !== "1") return null;
  const apiKey = getSecret("pay_paymennt_key");
  const apiSecret = getSecret("pay_paymennt_secret");
  if (!apiKey || !apiSecret) return null;
  return { apiKey, apiSecret, test: getSetting("pay_paymennt_mode", "test") !== "live" };
}
export const paymenntReady = () => hasSecret("pay_paymennt_key") && hasSecret("pay_paymennt_secret");

/** PAYMENNT_BASE overrides the address (tests only). */
export function baseUrl(cfg: PaymenntConfig): string {
  return process.env.PAYMENNT_BASE ?? (cfg.test ? SANDBOX_URL : LIVE_URL);
}

/** Creates a Paymennt web checkout and returns the redirect URL. */
export async function createPaymenntCheckout(
  cfg: PaymenntConfig,
  o: { orderId: string; amountMajor: number; currency: string; locale: string; email?: string; name?: string; phone?: string },
): Promise<{ id: string; url: string }> {
  const base = siteUrl();
  const returnUrl = `${base}/api/payment/paymennt/return?order=${encodeURIComponent(o.orderId)}&l=${o.locale}`;
  const [first, ...rest] = (o.name ?? "Customer").split(" ");
  const body = {
    requestId: `${o.orderId}-${Date.now()}`,
    orderId: o.orderId,
    currency: o.currency,
    amount: Number(o.amountMajor.toFixed(2)),
    returnUrl,
    customer: {
      firstName: first || "Customer",
      lastName: rest.join(" ") || "-",
      email: o.email ?? "",
      phone: o.phone ?? "",
    },
    items: [{ name: `Litore order ${o.orderId}`, quantity: 1, unitprice: Number(o.amountMajor.toFixed(2)) }],
  };
  const res = await fetch(`${baseUrl(cfg)}/checkout/web`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-POINTCHECKOUT-KEY": cfg.apiKey,
      "X-POINTCHECKOUT-SECRET": cfg.apiSecret,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`paymennt_create_failed:${res.status}:${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { success?: boolean; result?: { id?: string; redirectUrl?: string } };
  if (!data.success || !data.result?.id || !data.result?.redirectUrl) throw new Error("paymennt_create_failed:no_redirect");
  return { id: String(data.result.id), url: data.result.redirectUrl };
}

/** Server-side check: GET /checkout/{checkoutId}. */
export async function checkPaymenntCheckout(
  cfg: PaymenntConfig,
  checkoutId: string,
): Promise<{ paid: boolean; failed: boolean; amount?: number; currency?: string; status?: string; orderId?: string }> {
  const res = await fetch(`${baseUrl(cfg)}/checkout/${encodeURIComponent(checkoutId)}`, {
    headers: {
      Accept: "application/json",
      "X-POINTCHECKOUT-KEY": cfg.apiKey,
      "X-POINTCHECKOUT-SECRET": cfg.apiSecret,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`paymennt_check_failed:${res.status}`);
  const data = (await res.json()) as { success?: boolean; result?: { status?: string; grandtotal?: number; currency?: string; orderId?: string } };
  const st = data.result?.status;
  return {
    paid: st === "PAID",
    failed: st === "FAILED" || st === "CANCELLED" || st === "EXPIRED",
    amount: data.result?.grandtotal,
    currency: data.result?.currency,
    status: st,
    orderId: data.result?.orderId,
  };
}

/**
 * Verify Paymennt webhook signature using timingSafeEqual.
 * Headers: message-id, message-timestamp, message-signature ("v1,<base64>" values).
 * Signed string: "{message-id}.{message-timestamp}.{raw-body}"
 * HMAC-SHA256 with Base64-decoded secret (strip optional "whsec_" prefix).
 */
export function verifyPaymenntWebhook(
  payload: string,
  headers: { messageId: string | null; timestamp: string | null; signature: string | null },
  secret: string,
): boolean {
  if (!headers.messageId || !headers.timestamp || !headers.signature || !secret) return false;

  // Reject timestamps outside 5 minutes
  const ts = Number(headers.timestamp);
  if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  // Decode the signing secret (strip "whsec_" prefix if present, then Base64)
  const rawSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const secretBuf = Buffer.from(rawSecret, "base64");

  const signedContent = `${headers.messageId}.${headers.timestamp}.${payload}`;
  const expected = createHmac("sha256", secretBuf).update(signedContent).digest("base64");

  // The header may have multiple "v1,<base64>" values separated by space
  const signatures = headers.signature.split(" ");
  for (const sig of signatures) {
    const parts = sig.split(",");
    if (parts[0] !== "v1" || !parts[1]) continue;
    const sigBuf = Buffer.from(parts[1], "utf8");
    const expBuf = Buffer.from(expected, "utf8");
    if (sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf)) return true;
  }
  return false;
}
