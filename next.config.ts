import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Browsers remember to use HTTPS only for a year; the CSP parts below can not break the page (they do not restrict scripts).
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
];

const nextConfig: NextConfig = {
  images: { formats: ["image/avif", "image/webp"] },
  poweredByHeader: false,
  serverExternalPackages: ["better-sqlite3"],
  // Admin product photos go through a Server Action (each photo max 5MB in code; browser shrinks them first).
  experimental: { serverActions: { bodySizeLimit: "40mb" } },
  async headers() {
    const cache = (value: string) => [{ key: "Cache-Control", value }];
    return [
      { source: "/:path*", headers: securityHeaders },
      // fixed site files: the browser keeps them, so returning customers do not download logo/fonts/icons again
      { source: "/fonts/:path*", headers: cache("public, max-age=31536000, immutable") },
      { source: "/brand/:path*", headers: cache("public, max-age=604800") },
      { source: "/icons/:path*", headers: cache("public, max-age=604800") },
      { source: "/payment/:path*", headers: cache("public, max-age=604800") },
    ];
  },
};

export default nextConfig;
