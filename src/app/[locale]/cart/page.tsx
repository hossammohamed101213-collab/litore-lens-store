import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { CartPageView } from "@/features/cart/CartPageView";

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return (
    <div>
      <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-10">
        <h1 className="mb-4 text-center font-display text-2xl sm:mb-8 sm:text-4xl font-semibold">{dict.cart.title}</h1>
        <CartPageView locale={locale} dict={dict} />
      </div>
    </div>
  );
}
