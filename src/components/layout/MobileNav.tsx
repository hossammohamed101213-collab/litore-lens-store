"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, MenuIcon } from "@/components/ui/Icons";
import { Eyes } from "@/components/ui/Eyes";
import { InstallApp } from "./InstallApp";

type Item = { href: string; label: string };
type Props = { items: Item[]; extra: Item[]; menuLabel: string; closeLabel: string; installLabel: string; iosHelp: string };

const FOCUSABLE = 'a[href],button:not([disabled])';

export function MobileNav({ items, extra, menuLabel, closeLabel, installLabel, iosHelp }: Props) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setOpen(false);
      if (e.key !== "Tab" || !panelRef.current) return;
      // Keep keyboard focus inside the open menu.
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="xl:hidden">
      <button
        type="button"
        aria-label={menuLabel}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen(true)}
        className="inline-flex size-11 items-center justify-center rounded-full hover:bg-blush/40"
      >
        <MenuIcon />
      </button>
      {open && createPortal(
        <div id="mobile-menu" role="dialog" aria-modal="true" aria-label={menuLabel} className="fixed inset-0 z-50 flex">
          <div ref={panelRef} className="flex w-[72%] max-w-[260px] flex-col overflow-y-auto bg-canvas p-4 shadow-xl">
            <button
              ref={closeRef}
              type="button"
              aria-label={closeLabel}
              onClick={() => setOpen(false)}
              className="mb-2 inline-flex size-10 items-center justify-center rounded-full hover:bg-blush/40"
            >
              <CloseIcon />
            </button>
            <nav aria-label={menuLabel} className="flex flex-col">
              {items.map((item, i) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={`glow-card tone-${i % 5} mb-1.5 rounded-xl border px-3 py-2 text-[15px] ${isActive(item.href) ? "font-bold" : ""}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <ul className="mt-3 grid grid-cols-2 gap-1.5">
              {extra.map((item, i) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`glow-card tone-${(i + 2) % 5} flex min-h-9 items-center justify-center rounded-full border px-2 text-center text-xs`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <InstallApp label={installLabel} iosHelp={iosHelp} className="mt-3 !min-h-9 !text-xs" />
            <div className="mt-auto flex justify-center pt-6" aria-hidden="true"><Eyes mode="loop" className="w-16 opacity-90" /></div>
          </div>
          <button type="button" aria-label={closeLabel} onClick={() => setOpen(false)} className="flex-1 bg-mauve/40" />
        </div>,
        document.body,
      )}
    </div>
  );
}
