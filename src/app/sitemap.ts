import type { MetadataRoute } from "next";
import { locales } from "@/lib/i18n/config";
import { getCommerce } from "@/lib/commerce";

export const dynamic = "force-dynamic";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Sample products are excluded; only real, active products are listed.
  const products = (await getCommerce().listProducts()).filter((p) => !p.isMock);
  const paths = ["", "/shop", "/prices", "/complaints", "/about", "/contact", "/faq", "/shipping", "/returns", "/privacy", "/terms", "/care", "/color-guide", ...products.map((p) => `/shop/${p.slug}`)];
  return paths.flatMap((path) =>
    locales.map((l) => ({
      url: `${site}/${l}${path}`,
      alternates: { languages: Object.fromEntries(locales.map((x) => [x, `${site}/${x}${path}`])) },
    })),
  );
}
