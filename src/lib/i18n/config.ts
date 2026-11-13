export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ar";

export const isLocale = (value: string): value is Locale =>
  (locales as readonly string[]).includes(value);

export const dirOf = (locale: Locale): "rtl" | "ltr" =>
  locale === "ar" ? "rtl" : "ltr";

export const otherLocale = (locale: Locale): Locale =>
  locale === "ar" ? "en" : "ar";

/** Swap (or add) the locale segment of a pathname, keeping the rest of the page. */
export function switchLocalePath(pathname: string, target: Locale): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length && isLocale(parts[0])) parts[0] = target;
  else parts.unshift(target);
  return "/" + parts.join("/");
}
