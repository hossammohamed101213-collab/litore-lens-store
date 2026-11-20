import Link from "next/link";
import { labelsFor } from "@/lib/orders/label";
import { LABEL_CSS, StoreLabel } from "@/components/commerce/StoreLabel";
import { PrintLabels } from "./PrintLabels";

export const dynamic = "force-dynamic";

/**
 * Store labels (invoice in waybill style, 100 × 150 mm) for one order or many: `?id=A&id=B`. Each label is its own page,
 * oldest order first. The print layout requires an admin session.
 */
export default async function PrintOrders({ searchParams }: { searchParams: Promise<{ id?: string | string[] }> }) {
  const { id } = await searchParams;
  const ids = (Array.isArray(id) ? id : id ? [id] : []).flatMap((v) => v.split(","));
  const { labels, skipped } = labelsFor(ids);
  const one = labels.length === 1;
  return (
    <div className="space-y-4" dir="rtl">
      <style>{LABEL_CSS}</style>
      <p className="no-print"><Link href={one ? `/admin/orders/${labels[0].id}` : "/admin/orders"} className="underline">← {one ? "الطلب" : "كل الطلبات"}</Link></p>
      <h1 className="no-print font-display text-3xl font-semibold">طباعة الملصقات</h1>
      {labels.length === 0 ? <p role="status" className="no-print">لم يتم اختيار طلبات صالحة للطباعة. الطباعة الجماعية للطلبات المدفوعة غير الملغاة فقط.</p> : (
        <>
          <div className="no-print flex flex-wrap items-center gap-3 rounded-card border border-gold/40 bg-surface p-4">
            <PrintLabels ids={labels.map((l) => l.id)} label={one ? "🖨 طباعة الملصق" : `🖨 طباعة ${labels.length} ملصق دفعة واحدة`} />
            <p className="text-sm">المقاس 10 × 15 سم لطابعة الملصقات الحرارية. في نافذة الطباعة اختاري طابعة الملصقات، والهوامش «بدون»، والمقياس 100%.</p>
          </div>
          {skipped.length > 0 && <p role="note" className="no-print rounded-xl bg-blush/50 p-3 text-sm font-medium">لم تُضف للطباعة الجماعية (غير مدفوعة أو ملغاة أو غير موجودة): <span dir="ltr">{skipped.join(" · ")}</span></p>}
          <div className="lt-sheet flex flex-wrap gap-4" data-count={labels.length}>
            {labels.map((o) => <div key={o.id} className="shadow-md" tabIndex={0} role="group" aria-label={`ملصق الطلب ${o.id}`}><StoreLabel o={o} /></div>)}
          </div>
        </>
      )}
    </div>
  );
}
