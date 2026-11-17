/** Sends transactional e-mail through Resend's HTTPS API. Without RESEND_API_KEY it is simply "off" and callers fall back.
 * RESEND_ENDPOINT overrides the address (tests only). */
import { WHATSAPP_DISPLAY, WHATSAPP_NUMBER } from "@/lib/site";

export const emailEnabled = () => !!process.env.RESEND_API_KEY;

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "https://litore.store").replace(/\/$/, "");

export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch(process.env.RESEND_ENDPOINT ?? "https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "Litore <no-reply@litore.store>", to: [to], subject, html, text }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);

export function resetEmail(locale: "ar" | "en", rawName: string, link: string) {
  const name = esc(rawName); // the name is typed by the customer: never let it inject HTML into the e-mail
  const ar = locale === "ar";
  const subject = ar ? "تعيين كلمة سر جديدة لحسابك في Litore" : "Set a new password for your Litore account";
  const body = ar
    ? `مرحبًا ${name} 🌸<br>اضغطي على الزر لتعيين كلمة سر جديدة. الرابط صالح لمدة ساعة ويعمل مرة واحدة.<br>إن لم تطلبي ذلك فتجاهلي هذه الرسالة وحسابك آمن.`
    : `Hello ${name} 🌸<br>Tap the button to set a new password. The link works once and expires in one hour.<br>If you didn't ask for this, ignore this email — your account is safe.`;
  const html = `<div dir="${ar ? "rtl" : "ltr"}" style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;background:#fff5f7;border-radius:16px;color:#4a2a36"><h2 style="margin:0 0 12px">Litore</h2><p style="line-height:1.8">${body}</p><p style="text-align:center;margin:24px 0"><a href="${link}" style="background:#8a5568;color:#fff;padding:14px 28px;border-radius:999px;text-decoration:none">${ar ? "تعيين كلمة سر جديدة" : "Set new password"}</a></p><p style="font-size:12px;color:#8a6a75;word-break:break-all">${link}</p></div>`;
  return { subject, html, text: `${body.replace(/<br>/g, "\n")}\n${link}` };
}

/** Signature shown under every order e-mail: logo, store link, WhatsApp. */
function signature(ar: boolean) {
  const site = siteUrl();
  const host = site.replace(/^https?:\/\//, "");
  const wa = `https://wa.me/${WHATSAPP_NUMBER}`;
  const html = `<table role="presentation" dir="${ar ? "rtl" : "ltr"}" style="margin-top:20px;padding-top:14px;border-top:1px solid #e8cfd6;width:100%"><tr><td style="width:84px;vertical-align:middle"><img src="${site}/brand/litore-logo-email.png" width="72" alt="Litore" style="display:block;border:0"></td><td style="vertical-align:middle;font-size:13px;line-height:1.7;color:#4a2a36"><b>Litore</b><br><a href="${site}" style="color:#8a5568">${host}</a><br>${ar ? "واتساب" : "WhatsApp"}: <a href="${wa}" style="color:#8a5568"><span dir="ltr">${WHATSAPP_DISPLAY}</span></a></td></tr></table>`;
  const text = `\n--\nLitore\n${site}\n${ar ? "واتساب" : "WhatsApp"}: ${WHATSAPP_DISPLAY} (${wa})`;
  return { html, text };
}
const shell = (ar: boolean, inner: string) =>
  `<div dir="${ar ? "rtl" : "ltr"}" style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;background:#fff5f7;border-radius:16px;color:#4a2a36"><h2 style="margin:0 0 12px">Litore</h2>${inner}${signature(ar).html}</div>`;
const button = (href: string, label: string) =>
  `<p><a href="${href}" style="display:inline-block;padding:12px 24px;border-radius:999px;background:#8a5568;color:#fff;text-decoration:none">${label}</a></p>`;

export type OrderMailData = {
  id: string; name: string; total: number; currency: string;
  lines: { name: string; quantity: number }[];
};

/** "We received your order" e-mail. Every value typed by the customer or the owner is escaped. */
export function orderEmail(locale: "ar" | "en", o: OrderMailData) {
  const ar = locale === "ar";
  const link = `${siteUrl()}/${locale}/order/${encodeURIComponent(o.id)}`;
  const subject = ar ? `تم تأكيد طلبك ${o.id} — Litore` : `Your order ${o.id} is confirmed — Litore`;
  const hello = ar ? `مرحبًا ${esc(o.name)} 🌸` : `Hello ${esc(o.name)} 🌸`;
  const intro = ar ? `استلمنا طلبك رقم <b>${esc(o.id)}</b> وتم تأكيد الدفع. سنجهّزه ونرسل لك رقم التتبع عند الشحن.`
    : `We received your order <b>${esc(o.id)}</b> and the payment is confirmed. We will prepare it and send you the tracking number when it ships.`;
  const items = o.lines.map((l) => `<li>${esc(l.name)} × ${l.quantity}</li>`).join("");
  const totalLine = `${ar ? "الإجمالي" : "Total"}: <b>${o.total.toFixed(2)} ${esc(o.currency)}</b>`;
  const btn = ar ? "متابعة الطلب" : "Track your order";
  const html = shell(ar, `<p>${hello}<br>${intro}</p><ul style="padding-inline-start:20px">${items}</ul><p>${totalLine}</p>${button(link, btn)}`);
  const text = [ar ? `مرحبًا ${o.name}` : `Hello ${o.name}`, ar ? `تم تأكيد طلبك ${o.id}.` : `Your order ${o.id} is confirmed.`,
    ...o.lines.map((l) => `- ${l.name} × ${l.quantity}`), `${ar ? "الإجمالي" : "Total"}: ${o.total.toFixed(2)} ${o.currency}`, link].join("\n") + signature(ar).text;
  return { subject, html, text };
}

export type ShippedMailData = { id: string; name: string; carrier: string; tracking: string; trackUrl: string };

/** "Your order is on its way" e-mail, with the tracking number when there is one. Every typed value is escaped. */
export function shippedEmail(locale: "ar" | "en", o: ShippedMailData) {
  const ar = locale === "ar";
  const link = `${siteUrl()}/${locale}/order/${encodeURIComponent(o.id)}`;
  const safeTrack = /^https:\/\//.test(o.trackUrl) ? o.trackUrl : "";
  const subject = ar ? `تم شحن طلبك ${o.id} — Litore` : `Your order ${o.id} has shipped — Litore`;
  const hello = ar ? `مرحبًا ${esc(o.name)} 🌸` : `Hello ${esc(o.name)} 🌸`;
  const intro = ar ? `طلبك رقم <b>${esc(o.id)}</b> خرج للشحن وهو في الطريق إليك.` : `Your order <b>${esc(o.id)}</b> has shipped and is on its way to you.`;
  const rows = [
    o.carrier ? `${ar ? "شركة الشحن" : "Carrier"}: <b>${esc(o.carrier)}</b>` : "",
    o.tracking ? `${ar ? "رقم التتبع" : "Tracking number"}: <b><span dir="ltr">${esc(o.tracking)}</span></b>` : "",
  ].filter(Boolean).join("<br>");
  const html = shell(ar, `<p>${hello}<br>${intro}</p>${rows ? `<p>${rows}</p>` : ""}${safeTrack ? button(esc(safeTrack), ar ? "تتبع الشحنة" : "Track the shipment") : ""}${button(link, ar ? "صفحة الطلب" : "Order page")}`);
  const text = [ar ? `مرحبًا ${o.name}` : `Hello ${o.name}`, ar ? `تم شحن طلبك ${o.id}.` : `Your order ${o.id} has shipped.`,
    o.carrier ? `${ar ? "شركة الشحن" : "Carrier"}: ${o.carrier}` : "", o.tracking ? `${ar ? "رقم التتبع" : "Tracking number"}: ${o.tracking}` : "",
    safeTrack, link].filter(Boolean).join("\n") + signature(ar).text;
  return { subject, html, text };
}
