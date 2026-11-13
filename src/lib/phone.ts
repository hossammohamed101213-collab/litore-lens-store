/** Keeps digits only (UAE style): 0527645570 / +971 52 764 5570 / 00971527645570 all become 971527645570. */
export function normPhone(raw: string): string {
  let d = raw.replace(/[^\d]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0") && d.length === 10) d = "971" + d.slice(1);
  return d;
}
