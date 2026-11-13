"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string };

/** Desktop navigation with a clear "you are here" state. */
export function NavLinks({ items, label, className = "" }: { items: Item[]; label: string; className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className={className}>
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
