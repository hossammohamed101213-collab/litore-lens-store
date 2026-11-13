export type Address = {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  /** ISO 3166-1 alpha-2, e.g. AE, SA, KW, QA, BH, OM */
  country: string;
  postalCode?: string;
};

export type ShippingRate = {
  id: string;
  label: { ar: string; en: string };
  amount: number;
  currency: string;
  estimatedDays?: { min: number; max: number };
};

export interface ShippingProvider {
  readonly name: string;
  validateAddress(address: Address): Promise<{ valid: boolean; errors: string[] }>;
  getRates(address: Address, subtotal: number): Promise<ShippingRate[]>;
  createShipment(orderId: string, address: Address): Promise<{ trackingNumber: string; trackingUrl?: string }>;
  getTracking(trackingNumber: string): Promise<{ status: string }>;
}
