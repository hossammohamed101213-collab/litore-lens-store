/** Sends transactional e-mail through Resend's HTTPS API. Without RESEND_API_KEY it is simply "off" and callers fall back. */
export const emailEnabled = () => !!process.env.RESEND_API_KEY;

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "https://litore.store").replace(/\/$/, "");

export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
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

export function resetEmail(locale: "ar" | "en", name: string, link: string) {
  const ar = locale === "ar";
  const subject = ar ? "تعيين كلمة سر جديدة لحسابك في Litore" : "Set a new password for your Litore account";
  const body = ar
    ? `مرحبًا ${name} 🌸<br>اضغطي على الزر لتعيين كلمة سر جديدة. الرابط صالح لمدة ساعة ويعمل مرة واحدة.<br>إن لم تطلبي ذلك فتجاهلي هذه الرسالة وحسابك آمن.`
    : `Hello ${name} 🌸<br>Tap the button to set a new password. The link works once and expires in one hour.<br>If you didn't ask for this, ignore this email — your account is safe.`;
  const html = `<div dir="${ar ? "rtl" : "ltr"}" style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;background:#fff5f7;border-radius:16px;color:#4a2a36"><h2 style="margin:0 0 12px">Litore</h2><p style="line-height:1.8">${body}</p><p style="text-align:center;margin:24px 0"><a href="${link}" style="background:#8a5568;color:#fff;padding:14px 28px;border-radius:999px;text-decoration:none">${ar ? "تعيين كلمة سر جديدة" : "Set new password"}</a></p><p style="font-size:12px;color:#8a6a75;word-break:break-all">${link}</p></div>`;
  return { subject, html, text: `${body.replace(/<br>/g, "\n")}\n${link}` };
}
