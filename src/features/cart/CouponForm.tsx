"use client";

import { useState } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { useCart } from "./CartProvider";

export function CouponForm({ dict }: { dict: Dictionary }) {
  const { coupon, applyCoupon, removeCoupon } = useCart();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<"ok" | "bad" | null>(null);
  const c = dict.cart;

  if (coupon?.valid) {
    return (
      <p className="flex items-center justify-between text-sm" role="status">
        <span>{c.couponApplied} ({coupon.code})</span>
        <button type="button" onClick={() => { removeCoupon(); setMsg(null); }} className="min-h-11 underline">{c.couponRemove}</button>
      </p>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!code.trim()) return;
        setMsg((await applyCoupon(code.trim())) ? "ok" : "bad");
      }}
    >
      <label htmlFor="coupon" className="mb-1 block text-sm font-bold">{c.coupon}</label>
      <div className="flex gap-2">
        <input id="coupon" value={code} onChange={(e) => setCode(e.target.value)} aria-invalid={msg === "bad"} aria-describedby="coupon-msg" className="min-h-11 flex-1 rounded-full border border-gold/50 bg-surface px-4 text-sm" />
        <button className="min-h-11 rounded-full border border-mauve px-5 text-sm hover:bg-blush/40">{c.couponApply}</button>
      </div>
      <p id="coupon-msg" role="status" className="mt-1 min-h-5 text-sm">{msg === "bad" ? `⚠ ${c.couponInvalid}` : ""}</p>
    </form>
  );
}
