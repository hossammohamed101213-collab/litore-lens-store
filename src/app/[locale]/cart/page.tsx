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
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="mb-8 text-center font-display text-4xl font-semibold">{dict.cart.title}</h1>
        <CartPageView locale={locale} dict={dict} />
      </div>
    </div>
  );
}
