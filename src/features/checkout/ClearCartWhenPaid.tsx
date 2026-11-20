"use client";
import { useEffect } from "react";
import { CART_STORAGE_KEY, useCart } from "@/features/cart/CartProvider";
import { PENDING_ORDER_KEY } from "./pending";

/**
 * On the order page: empties the cart once the order this browser sent to the payment page is confirmed paid.
 * Any other order page (an old order opened from an e-mail, for example) never touches the cart.
 */
export function ClearCartWhenPaid({ orderId, paid }: { orderId: string; paid: boolean }) {
  const { clear } = useCart();
  useEffect(() => {
    try {
      if (window.localStorage.getItem(PENDING_ORDER_KEY) !== orderId) return;
      if (!paid) return;
      window.localStorage.removeItem(PENDING_ORDER_KEY);
      // the saved cart is emptied too: this can run before the cart has loaded itself from the browser's storage
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ lines: [], coupon: null }));
      clear();
    } catch { /* storage may be blocked: the cart simply stays */ }
  }, [orderId, paid, clear]);
  return null;
}
