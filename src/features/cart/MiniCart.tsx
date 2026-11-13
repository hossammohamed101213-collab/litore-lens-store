"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { CloseIcon } from "@/components/ui/Icons";
import { CartIcon3D } from "@/components/ui/CartIcon3D";
import { useCart } from "./CartProvider";
import { CartLines } from "./CartLines";
import { CartTotals } from "./CartTotals";

export function CartButton({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const { count, drawerOpen, setDrawerOpen, validated, justAdded } = useCart();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = () => setDrawerOpen(false);

  useEffect(() => {
    if (!drawerOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close();
      if (e.key !== "Tab" || !panelRef.current) return;
      // Keep keyboard focus inside the open cart.
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled])"));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen]);

  const blocked = validated?.lines.some((l) => l.status === "out_of_stock" || l.status === "not_found");

  return (
    <>
      <button
        type="button"
        aria-label={`${dict.actions.cart} (${count})`}
        onClick={() => setDrawerOpen(true)}
        className="relative inline-flex h-11 min-w-14 items-center justify-center rounded-full px-1 hover:bg-blush/40"
      >
        <CartIcon3D key={justAdded ? "bump" : "idle"} bump={justAdded} className="h-9 w-11" />
        {count > 0 && (
          <span className="absolute end-0.5 top-0.5 flex min-w-5 items-center justify-center rounded-full bg-mauve px-1 text-xs font-bold text-white">{count}</span>
        )}
      </button>

      {drawerOpen && createPortal(
        <div role="dialog" aria-modal="true" aria-label={dict.cart.mini} className="fixed inset-0 z-50 flex justify-end">
          <button type="button" aria-label={dict.nav.close} onClick={close} className="flex-1 bg-mauve/40" />
          <div ref={panelRef} className="glass-strong flex w-full max-w-md flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b border-gold/40 p-4">
              <h2 className="font-display text-2xl font-semibold">{dict.cart.mini}{count > 0 && <span className="ms-2 text-base font-normal opacity-70">({count})</span>}</h2>
              <button ref={closeRef} type="button" aria-label={dict.nav.close} onClick={close} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-blush/40"><CloseIcon /></button>
            </div>
            {justAdded && count > 0 && (
              <p role="status" className="bg-blush/50 px-4 py-2 text-sm font-medium">✓ {dict.cart.added}</p>
            )}
            <div className="flex-1 overflow-y-auto px-4">
              {count === 0 ? (
                <div className="py-14 text-center"><p className="font-bold">{dict.cart.empty}</p><p className="mt-1 text-sm">{dict.cart.emptyHint}</p></div>
              ) : (
                <CartLines locale={locale} dict={dict} onNavigate={close} />
              )}
            </div>
            {count > 0 && (
              <div className="space-y-3 border-t border-gold/40 p-4">
                <CartTotals locale={locale} dict={dict} />
                <Link href={`/${locale}/cart`} onClick={close} className="flex min-h-11 items-center justify-center rounded-full border border-mauve text-sm hover:bg-blush/40">{dict.cart.viewCart}</Link>
                {blocked ? (
                  <span className="flex min-h-12 items-center justify-center rounded-full bg-mauve/40 text-white">{dict.cart.checkout}</span>
                ) : (
                  <Link href={`/${locale}/checkout`} onClick={close} className="flex min-h-12 items-center justify-center rounded-full bg-mauve text-white hover:bg-[#6f4353]">{dict.cart.checkout}</Link>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
