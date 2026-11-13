import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function PaymentFailedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const k = getDictionary(locale).checkout;
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="font-display text-3xl font-semibold">{k.failed}</h1>
      <p className="mt-3">{k.failedHint}</p>
      <div className="mt-8 flex flex-col items-center gap-3">
        <Link href={`/${locale}/checkout`} className="inline-flex min-h-12 items-center rounded-full bg-mauve px-8 text-white hover:bg-[#6f4353]">{k.retry}</Link>
        <Link href={`/${locale}/cart`} className="text-sm underline">{k.backToCart}</Link>
      </div>
    </div>
  );
}
