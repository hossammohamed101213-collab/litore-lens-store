/** Sends transactional e-mail through Resend's HTTPS API. Without RESEND_API_KEY it is simply "off" and callers fall back.
 * RESEND_ENDPOINT overrides the address (tests only). */
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
  const html = `<div dir="${ar ? "rtl" : "ltr"}" style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;background:#fff5f7;border-radius:16px;color:#4a2a36"><h2 style="margin:0 0 12px">Litore</h2><p>${hello}<br>${intro}</p><ul style="padding-inline-start:20px">${items}</ul><p>${totalLine}</p><p><a href="${link}" style="display:inline-block;padding:12px 24px;border-radius:999px;background:#8a5568;color:#fff;text-decoration:none">${btn}</a></p></div>`;
  const text = [ar ? `مرحبًا ${o.name}` : `Hello ${o.name}`, ar ? `تم تأكيد طلبك ${o.id}.` : `Your order ${o.id} is confirmed.`,
    ...o.lines.map((l) => `- ${l.name} × ${l.quantity}`), `${ar ? "الإجمالي" : "Total"}: ${o.total.toFixed(2)} ${o.currency}`, link].join("\n");
  return { subject, html, text };
}
