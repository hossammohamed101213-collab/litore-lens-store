import type { Product } from "./types";

/**
 * SAMPLE DATA ONLY. Names, prices and specs are placeholders so the design can
 * be previewed. Replace with real Litore products before launch (see
 * DECISIONS_REQUIRED.md). No real commercial data is implied.
 */
const sample = [
  { slug: "sample-rose-quartz", ar: "وردي كوارتز", en: "Rose Quartz", swatch: "#D68FA5", family: "pink" },
  { slug: "sample-honey-gold", ar: "عسلي ذهبي", en: "Honey Gold", swatch: "#C7A16A", family: "honey" },
  { slug: "sample-soft-mauve", ar: "موف ناعم", en: "Soft Mauve", swatch: "#865466", family: "mauve" },
  { slug: "sample-blush-gray", ar: "رمادي بلاش", en: "Blush Gray", swatch: "#A8A1A6", family: "gray" },
  { slug: "sample-pearl-hazel", ar: "بندقي لؤلؤي", en: "Pearl Hazel", swatch: "#9A7B4F", family: "hazel" },
  { slug: "sample-ivory-green", ar: "أخضر عاجي", en: "Ivory Green", swatch: "#8FA58A", family: "green" },
  { slug: "sample-dusty-blue", ar: "أزرق هادئ", en: "Dusty Blue", swatch: "#8FA3BD", family: "blue" },
  { slug: "sample-champagne", ar: "شامبانيا", en: "Champagne", swatch: "#D9C3A0", family: "honey" },
];

/** Sample prices (AED) so cart/checkout math can be tested. NOT real prices. */
const SAMPLE_PRICES = [100, 100, 110, 110, 120, 120, 130, 130];

export const mockProducts: Product[] = sample.map((s, i) => ({
  id: `mock-${i + 1}`,
  slug: s.slug,
  name: { ar: s.ar, en: s.en },
  shortDescription: {
    ar: "وصف تجريبي — يُستبدل بالوصف المعتمد.",
    en: "Sample description — replaced with approved copy.",
  },
  description: {
    ar: "نص تجريبي لعرض التصميم فقط.",
    en: "Placeholder text to preview the design only.",
  },
  price: SAMPLE_PRICES[i],
  currency: "AED",
  images: [{ id: `mock-img-${i + 1}`, alt: { ar: s.ar, en: s.en } }],
  variants: [
    {
      id: `mock-${i + 1}-v1`,
      sku: `SAMPLE-${i + 1}`,
      title: { ar: s.ar, en: s.en },
      options: { color: s.family },
      inventoryQuantity: 10,
    },
  ],
  colorFamily: s.family,
  swatch: s.swatch,
  status: "active" as const,
  isMock: true,
}));
