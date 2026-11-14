import { NextResponse } from "next/server";
import { reconcileOnlinePayment } from "@/lib/payment/reconcile";

export const dynamic = "force-dynamic";

/** The customer comes back from Telr here. We ignore what the URL claims and ask Telr's server for the real result. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const order = (url.searchParams.get("order") ?? "").slice(0, 40);
  const locale = url.searchParams.get("l") === "en" ? "en" : "ar";
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? url.origin).replace(/\/$/, "");
  if (!/^LT-[A-F0-9]{8}$/.test(order)) return NextResponse.redirect(`${base}/${locale}`, 303);
  const result = await reconcileOnlinePayment(order);
  const target = result === "failed" ? `${base}/${locale}/checkout/failed` : `${base}/${locale}/order/${order}`;
  return NextResponse.redirect(target, 303);
}
