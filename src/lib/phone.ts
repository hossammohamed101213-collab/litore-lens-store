/** Keeps digits only (UAE style): 0569449531 / +971 56 944 9531 / 00971569449531 all become 971569449531. */
export function normPhone(raw: string): string {
  let d = raw.replace(/[^\d]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0") && d.length === 10) d = "971" + d.slice(1);
  return d;
}
