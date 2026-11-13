"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { CouponResult, LineInput, ValidatedLine } from "@/lib/commerce/types";

type Validated = { lines: ValidatedLine[]; subtotal: number; discount: number; currency: string };

type CartCtx = {
  lines: LineInput[];
  validated: Validated | null;
  loading: boolean;
  error: boolean;
  count: number;
  coupon: CouponResult | null;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  /** True when the drawer was opened because something was just added. */
  justAdded: boolean;
  add: (variantId: string, quantity: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  applyCoupon: (code: string) => Promise<boolean>;
  removeCoupon: () => void;
};

const Ctx = createContext<CartCtx | null>(null);
const STORAGE_KEY = "litore.cart.v1";

function load(): { lines: LineInput[]; coupon: string | null } {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.lines)) return { lines: parsed.lines, coupon: parsed.coupon ?? null };
    }
  } catch {
    /* storage unavailable — cart still works in memory */
  }
  return { lines: [], coupon: null };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<LineInput[]>([]);
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [validated, setValidated] = useState<Validated | null>(null);
  const [coupon, setCoupon] = useState<CouponResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [drawerOpen, setDrawerOpenState] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [ready, setReady] = useState(false);
  const seq = useRef(0);
  const setDrawerOpen = useCallback((open: boolean) => {
    setDrawerOpenState(open);
    if (!open) setJustAdded(false);
  }, []);

  // Restore the saved cart (survives refresh and language switches).
  useEffect(() => {
    // Hydrating from localStorage after mount (SSR can't read it).
    const saved = load();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLines(saved.lines);
    setCouponCode(saved.coupon);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ lines, coupon: couponCode }));
    } catch {
      /* ignore */
    }
  }, [lines, couponCode, ready]);

  // Server is the source of truth for price + stock.
  useEffect(() => {
    if (!ready) return;
    if (lines.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValidated(null);
      setCoupon(null);
      return;
    }
    const mine = ++seq.current;
    setLoading(true);
    fetch("/api/cart/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lines, coupon: couponCode ?? undefined }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad"))))
      .then((data) => {
        if (mine !== seq.current) return;
        setValidated({ lines: data.lines, subtotal: data.subtotal, discount: data.discount, currency: data.currency });
        setCoupon(data.coupon);
        setError(false);
      })
      .catch(() => mine === seq.current && setError(true))
      .finally(() => mine === seq.current && setLoading(false));
  }, [lines, couponCode, ready]);

  const add = useCallback((variantId: string, quantity: number) => {
    setLines((prev) => {
      const found = prev.find((l) => l.variantId === variantId);
      if (found) return prev.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(l.quantity + quantity, 99) } : l));
      return [...prev, { variantId, quantity }];
    });
    setJustAdded(true);
    setDrawerOpenState(true);
  }, []);

  const setQuantity = useCallback((variantId: string, quantity: number) => {
    setLines((prev) => prev.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.max(1, quantity) } : l)));
  }, []);

  const remove = useCallback((variantId: string) => setLines((prev) => prev.filter((l) => l.variantId !== variantId)), []);
  const clear = useCallback(() => {
    setLines([]);
    setCouponCode(null);
  }, []);

  const applyCoupon = useCallback(
    async (code: string) => {
      const res = await fetch("/api/cart/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lines, coupon: code }),
      }).then((r) => r.json());
      if (res.coupon?.valid) {
        setCouponCode(res.coupon.code);
        return true;
      }
      return false;
    },
    [lines],
  );

  const value = useMemo<CartCtx>(
    () => ({
      lines, validated, loading, error, coupon, drawerOpen, setDrawerOpen, justAdded,
      count: lines.reduce((s, l) => s + l.quantity, 0),
      add, setQuantity, remove, clear, applyCoupon,
      removeCoupon: () => setCouponCode(null),
    }),
    [lines, validated, loading, error, coupon, drawerOpen, setDrawerOpen, justAdded, add, setQuantity, remove, clear, applyCoupon],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
