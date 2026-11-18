/** The store runs on UAE time: every date shown to the owner or on an invoice uses it, whatever the server clock is. */
export const UAE_TZ = "Asia/Dubai";
const toDate = (v: string | number | Date) => (v instanceof Date ? v : typeof v === "number" ? new Date(v) : new Date(/[TZ]/.test(v) ? v : v.replace(" ", "T") + "Z"));
export const uaeDateTime = (v: string | number | Date, locale = "ar-AE") => toDate(v).toLocaleString(locale, { timeZone: UAE_TZ, dateStyle: "medium", timeStyle: "short" });
export const uaeDate = (v: string | number | Date, locale = "ar-AE") => toDate(v).toLocaleDateString(locale, { timeZone: UAE_TZ, dateStyle: "medium" });
