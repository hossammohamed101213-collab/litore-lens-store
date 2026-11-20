import { NextResponse } from "next/server";
import { reconcileOnlinePayment, releaseAbandonedPayment } from "@/lib/payment/reconcile";

export const dynamic = "force-dynamic";

/** The customer comes back from Stripe here. We ignore what the URL claims and check Stripe's server for the real result. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const order = (url.searchParams.get("order") ?? "").slice(0, 40);
  const locale = url.searchParams.get("l") === "en" ? "en" : "ar";
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? url.origin).replace(/\/$/, "");
  if (!/^LT-[A-F0-9]{8,16}$/.test(order)) return NextResponse.redirect(`${base}/${locale}`, 303);
  // "left=1" = she used Stripe's "back" link. It is never trusted on its own: Stripe is asked what really happened.
  const result = url.searchParams.get("left") === "1" ? await releaseAbandonedPayment(order) : await reconcileOnlinePayment(order);
  const target = result === "failed" ? `${base}/${locale}/checkout/failed` : `${base}/${locale}/order/${order}`;
  return NextResponse.redirect(target, 303);
}
