import { PageTitle } from "../../CardGrid";

const PAGES: [string, string, string][] = [
  ["terms", "📜", "الشروط والأحكام"], ["privacy", "🔒", "سياسة الخصوصية"], ["returns", "↩️", "الاستبدال والإرجاع"], ["shipping", "🚚", "سياسة الشحن"], ["complaints", "💬", "الشكاوى والملاحظات"],
];

export default function LegalPages() {
  return (
    <>
      <PageTitle icon="📄" title="الصفحات القانونية" sub="هذه الصفحات ظاهرة للعميلات في أسفل الموقع. اضغطي لمعاينتها بالعربي أو الإنجليزي. راجعي نصوصها مع مستشارك القانوني قبل الإطلاق الرسمي." />
      <ul className="grid gap-3 sm:grid-cols-2">
        {PAGES.map(([slug, icon, title]) => (
          <li key={slug} className="flex items-center justify-between gap-3 rounded-2xl border border-gold/40 bg-surface p-4">
            <span className="font-bold"><span aria-hidden="true">{icon} </span>{title}</span>
            <span className="flex gap-2">
              <a href={`/ar/${slug}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-full border border-mauve px-4 text-sm font-bold hover:bg-blush/40">عربي</a>
              <a href={`/en/${slug}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-full border border-mauve px-4 text-sm font-bold hover:bg-blush/40">English</a>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
