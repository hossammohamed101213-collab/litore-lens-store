import Link from "next/link";
import { notFound } from "next/navigation";
import { Invoice, invoiceOrder } from "@/components/commerce/Invoice";

export const dynamic = "force-dynamic";

/** Printable invoice for the owner (the panel layout already requires an admin session). */
export default async function AdminInvoice({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ l?: string }> }) {
  const { id } = await params; const { l } = await searchParams;
  const data = invoiceOrder(id);
  if (!data) notFound();
  const locale = l === "en" ? "en" : "ar";
  return (
    <div className="space-y-4">
      <p className="no-print flex flex-wrap gap-4"><Link href={`/admin/orders/${id}`} className="underline">← الطلب</Link>
        <Link href={`/admin/orders/${id}/invoice?l=${locale === "ar" ? "en" : "ar"}`} className="underline">{locale === "ar" ? "English invoice" : "فاتورة بالعربية"}</Link></p>
      <Invoice data={data} locale={locale} />
    </div>
  );
}
