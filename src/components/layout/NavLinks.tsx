"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string };

/** Desktop navigation with a clear "you are here" state. */
export function NavLinks({ items, label }: { items: Item[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="hidden flex-1 justify-center gap-2 lg:flex">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative rounded-full px-4 py-2 text-base transition-colors hover:text-rose ${active ? "font-bold text-mauve" : ""}`}
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
