"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** "Page not found" inside the store's own frame (header, footer, page language), in the visitor's language. */
export default function NotFound() {
  const ar = !(usePathname() ?? "").startsWith("/en");
  const loc = ar ? "ar" : "en";
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <p aria-hidden="true" className="text-5xl">🎀</p>
      <h1 className="mt-4 font-display text-3xl font-semibold">{ar ? "الصفحة غير موجودة" : "Page not found"}</h1>
      <p className="mt-3">{ar ? "ربما تغيّر الرابط أو حُذفت الصفحة." : "The link may have changed or the page was removed."}</p>
      <p className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href={`/${loc}`} className="inline-flex min-h-11 items-center rounded-full bg-mauve px-6 text-white hover:bg-[#6f4353]">{ar ? "الصفحة الرئيسية" : "Home"}</Link>
        <Link href={`/${loc}/shop`} className="inline-flex min-h-11 items-center rounded-full border border-mauve px-6 hover:bg-blush/40">{ar ? "تسوّقي المنتجات" : "Shop products"}</Link>
      </p>
    </div>
  );
}
