import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { CheckoutForm } from "@/features/checkout/CheckoutForm";
import { paymentOptions } from "@/lib/payment/mode";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return (
    <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-10">
      <h1 className="mb-4 text-center font-display text-2xl sm:mb-8 sm:text-4xl font-semibold">{dict.checkout.title}</h1>
      <CheckoutForm locale={locale} dict={dict} options={paymentOptions()} />
    </div>
  );
}
