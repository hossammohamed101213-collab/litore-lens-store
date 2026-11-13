import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { TrackForm } from "@/features/account/AccountViews";

export default async function TrackPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-center font-display text-4xl font-semibold">{dict.track.title}</h1>
      <TrackForm locale={locale} dict={dict} />
    </div>
  );
}
