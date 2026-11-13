/** Pluggable analytics: register a sink (GA4, Meta, ...) once consent is given. */
export type AnalyticsEvent =
  | "view_item_list" | "select_item" | "view_item" | "search" | "add_to_wishlist" | "add_to_cart"
  | "view_cart" | "begin_checkout" | "add_shipping_info" | "add_payment_info" | "purchase";

type Sink = (event: AnalyticsEvent, params: Record<string, unknown>) => void;
const sinks = new Set<Sink>();

export const registerAnalytics = (sink: Sink) => {
  sinks.add(sink);
  return () => sinks.delete(sink);
};

/** Never pass personal data (email, phone, address) in params. */
export function track(event: AnalyticsEvent, params: Record<string, unknown> = {}) {
  sinks.forEach((s) => s(event, params));
}
