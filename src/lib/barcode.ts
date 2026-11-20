// Code 128 (set B) barcode, drawn as SVG. No library: the table is the standard one and tests/barcode.test.ts pins it.
const W = "212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112".split(" ");

/** Bar/space widths in modules (starts with a bar): start B, the text, checksum, stop. Printable ASCII only. */
export function code128(text: string): string {
  if (!/^[\x20-\x7e]{1,40}$/.test(text)) throw new Error("code128: printable ASCII only");
  const codes = [104, ...[...text].map((c) => c.charCodeAt(0) - 32)];
  codes.push(codes.reduce((s, c, i) => s + c * (i || 1), 0) % 103, 106);
  return codes.map((c) => W[c]).join("");
}

/** Crisp SVG: every bar is a whole number of modules, with the 10-module quiet zone scanners need on each side. */
export function code128Svg(text: string, height = 40): string {
  let x = 10; let rects = "";
  [...code128(text)].forEach((d, i) => { const n = Number(d); if (i % 2 === 0) rects += `<rect x="${x}" y="0" width="${n}" height="${height}"/>`; x += n; });
  const label = text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x + 10} ${height}" preserveAspectRatio="none" shape-rendering="crispEdges" role="img" aria-label="${label}"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}
