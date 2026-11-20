"use client";
import { PrintButton } from "@/components/commerce/PrintButton";
import { markLabelsPrinted } from "../../../actions";

/** Sends every label on the page to the printer in one job and remembers that they were printed. */
export function PrintLabels({ ids, label }: { ids: string[]; label: string }) {
  return (
    <span data-print-labels>
      <PrintButton label={label} before={() => { void markLabelsPrinted(ids).catch(() => {}); }}
        className="min-h-11 rounded-full bg-mauve px-6 font-bold text-white hover:bg-[#6f4353]"
        hint="لو نافذة الطباعة لم تظهر: افتحي هذه الصفحة من متصفح Safari أو Chrome نفسه (وليس من أيقونة المتجر على الشاشة الرئيسية)، أو اضغطي زر المشاركة ثم «طباعة»." />
    </span>
  );
}
