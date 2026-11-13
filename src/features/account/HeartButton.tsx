"use client";

import { useAccount } from "./AccountProvider";

/** Small heart on a product card: saves it to the customer's favourites (and her account when signed in). */
export function HeartButton({ productId, addLabel, removeLabel, className = "" }: { productId: string; addLabel: string; removeLabel: string; className?: string }) {
  const { wishlist, toggleWishlist } = useAccount();
  const on = wishlist.includes(productId);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? removeLabel : addLabel}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(productId); }}
      className={`flex size-10 items-center justify-center rounded-full bg-white/90 shadow ring-1 ring-gold/40 transition active:scale-90 ${className}`}
    >
      <svg viewBox="0 0 24 24" className={`h-5 w-5 transition ${on ? "scale-110" : ""}`} fill={on ? "#c2506f" : "none"} stroke={on ? "#c2506f" : "#8a5568"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
      </svg>
    </button>
  );
}
