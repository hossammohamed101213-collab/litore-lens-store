import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSecret } from "@/lib/secrets";
import { verifyPaymenntWebhook } from "@/lib/payment/paymennt";
import { reconcileOnlinePayment } from "@/lib/payment/reconcile";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const raw = await request.text();
  const messageId = request.headers.get("message-id");
  const timestamp = request.headers.get("message-timestamp");
  const signature = request.headers.get("message-signature");
  const secret = getSecret("pay_paymennt_whsec");

  // Verify HMAC if a webhook secret is configured
  if (secret && !verifyPaymenntWebhook(raw, { messageId, timestamp, signature }, secret)) {
    console.log("[paymennt-webhook] invalid signature");
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let body: { type?: string; data?: { id?: string | number; status?: string; orderId?: string } };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Handle checkout.paid, checkout.failed, checkout.cancelled, checkout.expired
  const paidOrFailed = ["checkout.paid", "checkout.failed", "checkout.cancelled", "checkout.expired"];
  if (body.type && paidOrFailed.includes(body.type) && body.data?.id) {
    const checkoutId = String(body.data.id);
    // Find the order by payment_ref (the Paymennt checkout id)
    const row = db().prepare("SELECT id FROM orders WHERE payment_ref = ? AND payment_gateway = 'paymennt'").get(checkoutId) as { id: string } | undefined;
    if (row) {
      const result = await reconcileOnlinePayment(row.id);
      console.log("[paymennt-webhook]", JSON.stringify({ type: body.type, checkout: checkoutId, order: row.id, result }));
    } else {
      console.log("[paymennt-webhook] unknown checkout", checkoutId);
    }
  }

  return NextResponse.json({ ok: true });
}
