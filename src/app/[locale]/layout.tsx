import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { dirOf, isLocale, locales } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Header } from "@/components/layout/Header";
import { CookieBanner } from "@/components/layout/CookieBanner";
import { Beacon } from "@/components/layout/Beacon";
import { Footer } from "@/components/layout/Footer";
import { PromoTicker } from "@/components/layout/PromoTicker";
import { Splash } from "@/components/layout/Splash";
import { ScrollRail } from "@/components/layout/ScrollRail";
import { WhatsAppFab } from "@/components/layout/WhatsAppFab";
import { AccountProvider } from "@/features/account/AccountProvider";
import { CartProvider } from "@/features/cart/CartProvider";
import "@/styles/globals.css";

export const dynamic = "force-dynamic";

export const viewport: Viewport = { themeColor: "#865466", width: "device-width", initialScale: 1 };

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    title: dict.meta.title,
    description: dict.meta.description,
    alternates: { languages: { ar: "/ar", en: "/en" } },
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: "Litore", statusBarStyle: "default" },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <html lang={locale} dir={dirOf(locale)} suppressHydrationWarning>
      <body className="min-h-dvh flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: "try{if(sessionStorage.getItem('litore_splash'))document.documentElement.setAttribute('data-splash-done','')}catch(e){}" }} />
        <noscript><style>{"#splash{display:none}"}</style></noscript>
        <Splash welcome={dict.splash.welcome} sub={dict.splash.sub} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-50 focus:rounded-full focus:bg-mauve focus:px-4 focus:py-2 focus:text-white"
        >
          {dict.nav.skip}
        </a>
        <AccountProvider>
        <CartProvider>
          <PromoTicker locale={locale} />
          <AnnouncementBar locale={locale} />
          <Header locale={locale} dict={dict} />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer locale={locale} dict={dict} />
          <ScrollRail backLabel={dict.nav.back} homeHref={`/${locale}`} />
          <CookieBanner labels={dict.cookies} privacyHref={`/${locale}/privacy`} />
          <Beacon />
          <WhatsAppFab label={dict.wa.label} message={dict.wa.msg} />
        </CartProvider>
        </AccountProvider>
      </body>
    </html>
  );
}
