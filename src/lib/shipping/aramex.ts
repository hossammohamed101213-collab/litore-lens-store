import { getSecret } from "@/lib/secrets";
import { getSetting } from "@/lib/db";
import type { Address } from "./types";

export function aramexConfig() {
  if (getSetting("car_aramex_enabled") !== "1") return null;
  const c = {
    user: getSetting("car_aramex_user"), pass: getSecret("car_aramex_pass"), account: getSetting("car_aramex_acct"),
    pin: getSecret("car_aramex_pin"), entity: getSetting("car_aramex_entity"), country: getSetting("car_aramex_country", "AE"),
    live: getSetting("car_aramex_mode", "test") === "live",
  };
  return c.user && c.pass && c.account && c.pin && c.entity ? c : null;
}

export function shipper() {
  return {
    name: getSetting("ship_name", "Litore"), phone: getSetting("ship_phone"), email: getSetting("ship_email"),
    line1: getSetting("ship_line1"), city: getSetting("ship_city", "Dubai"),
  };
}

/** Creates a shipment through Aramex's Shipping API and returns the tracking number + label link. */
export async function createAramexShipment(o: { orderId: string; address: Address; email: string; phone: string; cod?: number; weightKg?: number }) {
  const c = aramexConfig();
  if (!c) throw new Error("aramex_not_configured");
  const s = shipper();
  if (!s.line1 || !s.phone) throw new Error("shipper_missing");
  const domestic = o.address.country === "AE";
  const party = (name: string, phone: string, email: string, line1: string, city: string, country: string, line2 = "") => ({
    PartyAddress: { Line1: line1, Line2: line2, City: city, CountryCode: country },
    Contact: { PersonName: name, CompanyName: name, PhoneNumber1: phone, CellPhone: phone, EmailAddress: email || "no-reply@litore.store" },
  });
  const base = c.live ? "https://ws.aramex.net" : "https://ws.dev.aramex.net";
  const body = {
    ClientInfo: { UserName: c.user, Password: c.pass, Version: "v1.0", AccountNumber: c.account, AccountPin: c.pin, AccountEntity: c.entity, AccountCountryCode: c.country, Source: 24 },
    LabelInfo: { ReportID: 9201, ReportType: "URL" },
    Transaction: { Reference1: o.orderId },
    Shipments: [{
      Reference1: o.orderId,
      Shipper: { Reference1: o.orderId, AccountNumber: c.account, ...party(s.name, s.phone, s.email, s.line1, s.city, c.country) },
      Consignee: { Reference1: o.orderId, ...party(o.address.name, o.phone || o.address.phone, o.email, o.address.line1, o.address.city, o.address.country, o.address.line2 ?? "") },
      ShippingDateTime: `/Date(${Date.now() + 3600_000})/`,
      DueDate: `/Date(${Date.now() + 3 * 86400_000})/`,
      Details: {
        Dimensions: { Length: 15, Width: 10, Height: 5, Unit: "cm" },
        ActualWeight: { Unit: "KG", Value: o.weightKg ?? 0.3 },
        ProductGroup: domestic ? "DOM" : "EXP",
        ProductType: domestic ? "OND" : "PPX",
        PaymentType: "P",
        NumberOfPieces: 1,
        DescriptionOfGoods: "Cosmetic contact lenses",
        GoodsOriginCountry: c.country,
        ...(o.cod && o.cod > 0 ? { Services: "CODS", CashOnDeliveryAmount: { Value: o.cod, CurrencyCode: "AED" } } : {}),
      },
    }],
  };
  const r = await fetch(`${base}/ShippingAPI.V2/Shipping/Service_1_0.svc/json/CreateShipments`, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
  });
  const j = (await r.json().catch(() => ({}))) as { HasErrors?: boolean; Notifications?: { Message: string }[]; Shipments?: { ID?: string; HasErrors?: boolean; Notifications?: { Message: string }[]; ShipmentLabel?: { LabelURL?: string } }[] };
  const sh = j.Shipments?.[0];
  if (j.HasErrors || sh?.HasErrors || !sh?.ID) {
    const msg = [...(j.Notifications ?? []), ...(sh?.Notifications ?? [])].map((n) => n.Message).join(" | ") || `http_${r.status}`;
    throw new Error(`aramex:${msg}`.slice(0, 300));
  }
  return { trackingNumber: sh.ID, labelUrl: sh.ShipmentLabel?.LabelURL };
}
