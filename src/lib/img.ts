/** Address of a photo resized by the server to `w` pixels wide (w must be one of the sizes Next.js serves: 384, 640, 828, 1200, 1920). */
export const sized = (src: string, w: 384 | 640 | 828 | 1200 | 1920) => `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=75`;
export const sizedSet = (src: string, widths: (384 | 640 | 828 | 1200 | 1920)[]) => widths.map((w) => `${sized(src, w)} ${w}w`).join(", ");
