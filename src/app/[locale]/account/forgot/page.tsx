import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { emailEnabled } from "@/lib/email";
import { AuthForm } from "@/features/account/AccountViews";

export const dynamic = "force-dynamic";

export default async function ForgotPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return (
    <AuthForm locale={locale} dict={dict} mode="forgot" emailMode={emailEnabled()} />
  );
}
