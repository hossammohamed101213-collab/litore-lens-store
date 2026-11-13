/** Tiny {placeholder} interpolation for dictionary strings. */
export const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ""));
