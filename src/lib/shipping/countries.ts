/** Gulf markets selected for launch. Standard ISO country/currency codes. */
export const gulfMarkets = [
  { code: "AE", currency: "AED" },
  { code: "SA", currency: "SAR" },
  { code: "KW", currency: "KWD" },
  { code: "QA", currency: "QAR" },
  { code: "BH", currency: "BHD" },
  { code: "OM", currency: "OMR" },
] as const;

export type MarketCode = (typeof gulfMarkets)[number]["code"];
