import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { AffiliateForm } from "@/features/account/AffiliateForm";
import { OrnamentalDivider } from "@/components/ui/Ornament";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const d = getDictionary(locale).affiliate;
  return { title: `${d.title} | Litore`, description: d.lead, alternates: { languages: { ar: "/ar/affiliate", en: "/en/affiliate" } } };
}

export default async function AffiliatePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale).affiliate;
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-center font-display text-4xl font-semibold">{t.title}</h1>
      <OrnamentalDivider className="my-4" />
      <p className="mb-6 text-center leading-8">{t.lead}</p>
      <AffiliateForm t={t} />
    </div>
  );
}
