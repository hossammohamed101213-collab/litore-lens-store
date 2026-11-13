import type { MetadataRoute } from "next";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/ar/cart", "/en/cart", "/ar/checkout", "/en/checkout", "/ar/account", "/en/account"] },
    sitemap: `${site}/sitemap.xml`,
  };
}
