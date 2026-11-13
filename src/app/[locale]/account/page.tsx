import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { AccountShell, ProfileView } from "@/features/account/AccountViews";

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return (
    <AccountShell locale={locale} dict={dict}>
      <ProfileView locale={locale} dict={dict} />
    </AccountShell>
  );
}
