import { redirect } from "next/navigation";

/** Prices and offers are one section now: /prices forwards to /offers. */
export default async function PricesRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/offers`);
}
