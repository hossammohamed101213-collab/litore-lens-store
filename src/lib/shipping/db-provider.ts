import { db, fromMinor, getSetting, toMinor } from "@/lib/db";
import { quoteAramexRate } from "./aramex";
import type { Address, ShippingProvider, ShippingRate } from "./types";

type Zone = {
  country: string; label_ar: string; label_en: string; price_minor: number;
  free_over_minor: number | null; min_days: number | null; max_days: number | null;
};

/** Price = live Aramex quote when "automatic shipping price" is on (with the zone price as a safe fallback), otherwise the zone price set in the admin panel. */
export class DbShippingProvider implements ShippingProvider {
  readonly name = "zones";

  async validateAddress(address: Address) {
    const errors: string[] = [];
    if (!address.line1) errors.push("line1");
    if (!address.city) errors.push("city");
    if (!address.phone) errors.push("phone");
    return { valid: errors.length === 0, errors };
  }

  async getRates(address: Address, subtotal: number): Promise<ShippingRate[]> {
    const z = db().prepare("SELECT * FROM shipping_zones WHERE country = ? AND active = 1").get(address.country) as Zone | undefined;
    if (!z) return [];
    const free = z.free_over_minor != null && toMinor(subtotal) >= z.free_over_minor;
    let amount = fromMinor(z.price_minor);
    if (!free) {
      const live = await quoteAramexRate(address);
      if (live != null) {
        const markup = Math.max(0, Number(getSetting("car_rate_markup", "0")) || 0);
        amount = Math.ceil(live * (1 + markup / 100));
      }
    }
    return [{
      id: `zone-${z.country}`,
      label: { ar: z.label_ar, en: z.label_en },
      amount: free ? 0 : amount,
      currency: "AED",
      estimatedDays: z.min_days != null && z.max_days != null ? { min: z.min_days, max: z.max_days } : undefined,
    }];
  }

  /** No carrier connected yet: the admin enters the tracking number by hand. */
  async createShipment() {
    return { trackingNumber: "" };
  }

  async getTracking() {
    return { status: "manual" };
  }
}
