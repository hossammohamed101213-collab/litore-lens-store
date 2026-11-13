import type { Locale } from "./config";

export function formatPrice(amount: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-AE" : "en-AE", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: currency === "KWD" || currency === "BHD" || currency === "OMR" ? 3 : 2,
  }).format(amount);
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-AE" : "en-AE").format(value);
}
