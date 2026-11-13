import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { OrnamentalDivider } from "@/components/ui/Ornament";
import { ComplaintFlow } from "@/features/feedback/ComplaintFlow";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: `${getDictionary(locale).complaints.title} | Litore`, alternates: { languages: { ar: "/ar/complaints", en: "/en/complaints" } } };
}

export default async function ComplaintsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <h1 className="text-center font-display text-4xl font-semibold">{dict.complaints.title}</h1>
      <OrnamentalDivider className="my-4" />
      <ComplaintFlow dict={dict} locale={locale} />
    </div>
  );
}
