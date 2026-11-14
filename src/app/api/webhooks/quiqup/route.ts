import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSecret } from "@/lib/secrets";
import { rateLimited, clientIp } from "@/lib/auth/guards";
import { verifyQuiqupWebhook } from "@/lib/shipping/quiqup";

export const dynamic = "force-dynamic";

/** Quiqup tells us when a parcel is delivered. Only a correctly signed request is accepted. */
export async function POST(request: Request) {
  if (rateLimited(`wh-quiqup:${clientIp(request)}`, 600)) return NextResponse.json({ error: "rate" }, { status: 429 });
  const raw = await request.text();
  if (raw.length > 200_000) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const secret = getSecret("car_quiqup_whsec");
  if (!verifyQuiqupWebhook(raw, request.headers.get("x-quiqup-signature"), request.headers.get("x-quiqup-timestamp"), secret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }
  let payload: { id?: number | string; client_order_id?: number | string; state?: string; partner_order_id?: string } | undefined;
  try { payload = (JSON.parse(raw) as { payload?: typeof payload }).payload; } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const ref = String(payload?.id ?? payload?.client_order_id ?? "");
  if (payload?.state === "delivery_complete" && /^\d{1,12}$/.test(ref)) {
    // only orders we shipped with Quiqup, and never re-open a cancelled one
    db().prepare("UPDATE orders SET status = 'delivered' WHERE carrier = 'quiqup' AND carrier_ref = ? AND status = 'shipped'").run(ref);
  }
  return NextResponse.json({ ok: true });
}
