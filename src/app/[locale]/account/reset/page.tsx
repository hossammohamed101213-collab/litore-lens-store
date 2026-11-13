import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { ResetForm } from "@/features/account/AccountViews";

export const metadata = { robots: { index: false, follow: false } };

export default async function ResetPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string }> }) {
  const { locale } = await params;
  const { token } = await searchParams;
  if (!isLocale(locale)) notFound();
  return <ResetForm locale={locale} dict={getDictionary(locale)} token={token ?? ""} />;
}
