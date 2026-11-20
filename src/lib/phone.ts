/** Keeps digits only (UAE style): 0527645570 / +971 52 764 5570 / 00971527645570 all become 971527645570. */
export function normPhone(raw: string): string {
  let d = raw.replace(/[^\d]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0") && d.length === 10) d = "971" + d.slice(1);
  return d;
}

/** Phone number in international form: digits only, UAE local forms (05x…, 5x…) get the +971 prefix. */
export function e164(raw: string): string {
  let d = raw.replace(/[^\d]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0") && d.length === 10) d = "971" + d.slice(1);
  else if (d.length === 9 && d.startsWith("5")) d = "971" + d; // 501234567 typed without the leading 0
  return `+${d}`;
}

/** A UAE number the courier can call: +971 followed by 8 or 9 digits, however the customer typed it. */
export const isUaePhone = (raw: string) => /^\+971\d{8,9}$/.test(e164(raw));
