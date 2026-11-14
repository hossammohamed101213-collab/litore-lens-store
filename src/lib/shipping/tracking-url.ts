import { getSetting } from "@/lib/db";

const TRACK_DEFAULT: Record<string, string> = { aramex: "https://www.aramex.com/track/results?ShipmentNumber={n}" };
export const trackingUrl = (carrier: string | null, n: string) => {
  const t = (carrier && (getSetting(`car_${carrier}_track`) || TRACK_DEFAULT[carrier])) || "";
  return t ? t.replace("{n}", encodeURIComponent(n)) : "";
};

