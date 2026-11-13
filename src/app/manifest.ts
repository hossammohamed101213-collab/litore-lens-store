import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Litore — عدسات لاصقة ملونة",
    short_name: "Litore",
    description: "Litore — cosmetic coloured contact lenses / عدسات لاصقة ملونة تجميلية",
    start_url: "/ar",
    scope: "/",
    display: "standalone",
    background_color: "#fff5f6",
    theme_color: "#865466",
    lang: "ar",
    dir: "rtl",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
