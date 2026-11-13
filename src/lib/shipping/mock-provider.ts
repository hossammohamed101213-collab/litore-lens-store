import type { Address, ShippingProvider, ShippingRate } from "./types";

/** Mock only: no real carrier is assumed. Rates are placeholders. */
export class MockShippingProvider implements ShippingProvider {
  readonly name = "mock";

  async validateAddress(address: Address) {
    const errors: string[] = [];
    if (!address.line1) errors.push("line1");
    if (!address.city) errors.push("city");
    if (!address.phone) errors.push("phone");
    return { valid: errors.length === 0, errors };
  }

  async getRates(_address: Address, _subtotal: number): Promise<ShippingRate[]> {
    return [
      {
        id: "mock-standard",
        label: { ar: "شحن تجريبي", en: "Sample shipping" },
        amount: 0,
        currency: "AED",
      },
    ];
  }

  async createShipment(orderId: string) {
    return { trackingNumber: `MOCK-${orderId}` };
  }

  async getTracking() {
    return { status: "mock" };
  }
}
