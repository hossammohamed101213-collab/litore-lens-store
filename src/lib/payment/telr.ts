import { getSecret, hasSecret } from "@/lib/secrets";
import { getSetting } from "@/lib/db";

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "https://litore.store").replace(/\/$/, "");
const ENDPOINT = process.env.TELR_ENDPOINT ?? "https://secure.telr.com/gateway/order.json";

export type TelrConfig = { storeId: string; authKey: string; test: boolean };

export function telrConfig(): TelrConfig | null {
  if (getSetting("pay_telr_enabled") !== "1") return null;
  const storeId = getSetting("pay_telr_store");
  const authKey = getSecret("pay_telr_key");
  if (!storeId || !authKey) return null;
  return { storeId, authKey, test: getSetting("pay_telr_mode", "test") !== "live" };
}
export const telrReady = () => getSetting("pay_telr_store") !== "" && hasSecret("pay_telr_key");

async function call(body: unknown): Promise<Record<string, any>> {
  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  return (await r.json().catch(() => ({}))) as Record<string, any>;
}

/** Creates a Telr hosted payment page. Visa/Mastercard/Apple Pay/Samsung Pay shown there depend on the methods enabled on the merchant's Telr account. */
export async function createTelrOrder(cfg: TelrConfig, o: { orderId: string; amountMajor: number; currency: string; locale: string; email?: string; name?: string; phone?: string; description?: string }) {
  const base = siteUrl();
  const ret = (r: string) => `${base}/api/payment/telr/return?order=${encodeURIComponent(o.orderId)}&r=${r}&l=${o.locale}`;
  const [first, ...rest] = (o.name ?? "Customer").split(" ");
  const res = await call({
    method: "create",
    store: cfg.storeId,
    authkey: cfg.authKey,
    framed: 0,
    order: { cartid: o.orderId, test: cfg.test ? "1" : "0", amount: o.amountMajor.toFixed(2), currency: o.currency, description: o.description ?? `Litore order ${o.orderId}` },
    customer: { email: o.email ?? "", phone: o.phone ?? "", name: { forenames: first || "Customer", surname: rest.join(" ") || "-" } },
    return: { authorised: ret("authorised"), declined: ret("declined"), cancelled: ret("cancelled") },
  });
  const ref = res.order?.ref as string | undefined;
  const url = res.order?.url as string | undefined;
  if (!ref || !url) throw new Error(`telr_create_failed:${res.error?.message ?? "no_response"}`);
  return { ref, url };
}

/** Server-side check of a payment (never trust the browser return alone). */
export async function checkTelrOrder(cfg: TelrConfig, ref: string): Promise<{ paid: boolean; declined: boolean; cartId?: string; amount?: number; currency?: string }> {
  const res = await call({ method: "check", store: cfg.storeId, authkey: cfg.authKey, order: { ref } });
  const code = Number(res.order?.status?.code);
  const txStatus = String(res.order?.transaction?.status ?? "");
  const paid = code === 3 && (txStatus === "A" || txStatus === "");
  return {
    paid,
    declined: code === -1 || code === -2 || code === -3 || txStatus === "D" || txStatus === "E",
    cartId: res.order?.cartid, amount: Number(res.order?.amount), currency: res.order?.currency,
  };
}

