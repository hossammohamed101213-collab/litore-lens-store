import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getCustomer } from "@/lib/auth/session";
import { Invoice, invoiceOrder } from "@/components/commerce/Invoice";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** A signed-in customer's invoice for one of her own orders. Anyone else gets "not found". */
export default async function CustomerInvoice({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const me = await getCustomer();
  if (!me) redirect(`/${locale}/account/login`);
  const data = /^LT-[A-F0-9]{8,16}$/.test(id) ? invoiceOrder(id, me.id) : null;
  if (!data) notFound();
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-3 py-6 sm:px-6">
      <p className="no-print"><Link href={`/${locale}/account/orders`} className="underline">{locale === "ar" ? "← طلباتي" : "← My orders"}</Link></p>
      <Invoice data={data} locale={locale} />
    </div>
  );
}
