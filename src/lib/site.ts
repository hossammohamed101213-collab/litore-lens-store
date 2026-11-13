/** Public contact details shown across the store. Override with env vars if the number changes. */
export const WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP ?? "971527645570").replace(/\D/g, "");
export const WHATSAPP_DISPLAY = `+${WHATSAPP_NUMBER.slice(0, 3)} ${WHATSAPP_NUMBER.slice(3, 5)} ${WHATSAPP_NUMBER.slice(5, 8)} ${WHATSAPP_NUMBER.slice(8)}`;
export const waLink = (text: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
