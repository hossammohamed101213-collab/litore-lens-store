import Image from "next/image";
import { LensPlaceholder } from "./LensPlaceholder";

type Props = { src?: string; swatch?: string; label: string; sizes?: string; priority?: boolean };

/** Parent must be `relative` with a fixed aspect ratio (no layout shift). */
export function ProductImage({ src, swatch, label, sizes = "(min-width:1024px) 25vw, 50vw", priority }: Props) {
  if (src) {
    return <Image src={src} alt={label} fill unoptimized sizes={sizes} priority={priority} className="object-cover object-[50%_25%]" />;
  }
  return <LensPlaceholder color={swatch ?? "#D68FA5"} label={label} />;
}
