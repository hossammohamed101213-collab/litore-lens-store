"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string };

/** Desktop navigation with a clear "you are here" state. */
export function NavLinks({ items, label }: { items: Item[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="order-last -mx-4 flex w-[calc(100%+2rem)] justify-between gap-0 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:w-[calc(100%+3rem)] sm:justify-center sm:gap-1 sm:px-6 xl:order-none xl:m-0 xl:w-auto xl:flex-1 xl:justify-center xl:gap-2 xl:overflow-visible xl:p-0">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative shrink-0 whitespace-nowrap rounded-full px-2 py-2 text-[13px] sm:px-3 sm:text-sm xl:px-4 xl:text-base transition-colors hover:text-rose ${active ? "font-bold text-mauve" : ""}`}
          >
            {item.label}
            <span
              aria-hidden="true"
              className={`absolute inset-x-4 -bottom-0.5 h-0.5 rounded-full bg-gold transition-opacity ${active ? "opacity-100" : "opacity-0"}`}
            />
          </Link>
        );
      })}
    </nav>
  );
}
