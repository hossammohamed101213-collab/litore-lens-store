import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { preload } from "react-dom";
import { dirOf, isLocale, locales } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Header } from "@/components/layout/Header";
import { CookieBanner } from "@/components/layout/CookieBanner";
import { Beacon } from "@/components/layout/Beacon";
import { Vitals } from "@/components/layout/Vitals";
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
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    metadataBase: new URL(site),
    title: dict.meta.title,
    description: dict.meta.description,
    alternates: { canonical: `/${locale}`, languages: { ar: "/ar", en: "/en" } },
    openGraph: { type: "website", siteName: "Litore", title: dict.meta.title, description: dict.meta.description, locale: locale === "ar" ? "ar_AE" : "en_AE", images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "Litore" }] },
    twitter: { card: "summary", title: dict.meta.title, description: dict.meta.description, images: ["/icons/icon-512.png"] },
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
  // load the fonts before first paint so the header/menu never re-wraps (layout shift) when they arrive
  const fonts = ["tajawal-latin-400-normal", "tajawal-latin-500-normal", "tajawal-latin-700-normal", "cormorant-garamond-latin-600-normal", ...(locale === "ar" ? ["tajawal-arabic-400-normal", "tajawal-arabic-500-normal", "tajawal-arabic-700-normal"] : [])];
  preload("/brand/litore-logo-md.webp", { as: "image", fetchPriority: "high" }); // the welcome logo is the first big thing painted: fetch it before the fonts
  // still preloaded (so text never re-wraps), but behind the logo and the page itself on a slow phone connection
  for (const f of fonts) preload(`/fonts/${f}.woff2`, { as: "font", type: "font/woff2", crossOrigin: "anonymous", fetchPriority: "low" });

  return (
    <html lang={locale} dir={dirOf(locale)} suppressHydrationWarning>
      <body className="store-glass min-h-dvh flex flex-col">
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
          <Vitals />
          <WhatsAppFab label={dict.wa.label} message={dict.wa.msg} />
        </CartProvider>
        </AccountProvider>
      </body>
    </html>
  );
}
