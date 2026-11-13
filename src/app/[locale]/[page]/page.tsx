import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCommerce } from "@/lib/commerce";
import { OrnamentalDivider } from "@/components/ui/Ornament";
import { WHATSAPP_DISPLAY, waLink } from "@/lib/site";

const slugs = ["about", "contact", "faq", "shipping", "returns", "privacy", "terms", "care", "color-guide"] as const;
type Slug = (typeof slugs)[number];
const isSlug = (s: string): s is Slug => (slugs as readonly string[]).includes(s);

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; page: string }> }): Promise<Metadata> {
  const { locale, page } = await params;
  if (!isLocale(locale) || !isSlug(page)) return {};
  const content = getDictionary(locale).pages[page];
  return {
    title: `${content.title} | Litore`,
    description: content.intro,
    alternates: { languages: { ar: `/ar/${page}`, en: `/en/${page}` } },
    robots: { index: true, follow: true },
  };
}

export default async function ContentPage({ params }: { params: Promise<{ locale: string; page: string }> }) {
  const { locale, page } = await params;
  if (!isLocale(locale) || !isSlug(page)) notFound();
  const dict = getDictionary(locale);
  const content = dict.pages[page];
  const sections = content.sections as string[][];
  const families =
    page === "color-guide"
      ? [...new Set((await getCommerce().listProducts()).map((p) => p.colorFamily).filter(Boolean))] as string[]
      : [];
  const colors = dict.shop.colors as Record<string, string>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-center font-display text-4xl font-semibold">{content.title}</h1>
      <OrnamentalDivider className="my-4" />
      <p className="text-lg leading-8">{content.intro}</p>

      {sections.map(([h, body], i) => (
        <section key={h} className={`glow-card tone-${i % 5} mt-5 rounded-card border p-5`}>
          {page === "faq" ? (
            <details>
              <summary className="min-h-11 cursor-pointer py-2 font-bold">{h}</summary>
              <p className="mt-2 leading-7">{body}</p>
            </details>
          ) : (
            <>
              <h2 className="mb-2 text-xl font-bold">{h}</h2>
              {body.split("\n").map((line, j) => (
                <p key={j} className="leading-8">{line}</p>
              ))}
            </>
          )}
        </section>
      ))}

      {families.length > 0 && (
        <ul className="mt-8 flex flex-wrap gap-3">
          {families.map((f) => (
            <li key={f}>
              <Link href={`/${locale}/shop?color=${f}`} className="inline-flex min-h-11 items-center rounded-full border border-gold/50 bg-surface px-5 hover:bg-blush/40">
                {colors[f] ?? f}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {page === "contact" && (
        <p className="mt-8 text-center">
          <a href={waLink(locale === "ar" ? "مرحبًا Litore" : "Hello Litore")} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center rounded-full bg-[#1f9d55] px-8 font-bold text-white hover:bg-[#188046]" dir="ltr">
            WhatsApp {WHATSAPP_DISPLAY}
          </a>
        </p>
      )}
      {page === "faq" && (
        <p className="mt-8"><Link href={`/${locale}/track`} className="underline">{dict.track.title}</Link></p>
      )}
    </div>
  );
}
