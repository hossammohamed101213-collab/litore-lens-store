import Link from "next/link";

export function EmptyState({ title, hint, href, cta }: { title: string; hint: string; href: string; cta: string }) {
  return (
    <div className="rounded-card border border-gold/40 bg-surface px-6 py-14 text-center" role="status">
      <p className="text-xl font-bold">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm opacity-80">{hint}</p>
      <Link href={href} className="mt-6 inline-flex min-h-11 items-center rounded-full bg-mauve px-6 text-white hover:bg-[#6f4353]">
        {cta}
      </Link>
    </div>
  );
}
