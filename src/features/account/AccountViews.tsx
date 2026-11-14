"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { formatPrice } from "@/lib/i18n/format";
import { gulfMarkets } from "@/lib/shipping/countries";
import type { Order, Product } from "@/lib/commerce/types";
import { ProductCard } from "@/components/commerce/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { waLink } from "@/lib/site";
import { useCart } from "@/features/cart/CartProvider";
import { useAccount } from "./AccountProvider";

type Base = { locale: Locale; dict: Dictionary };
const inputCls = "min-h-11 w-full rounded-xl border border-gold/50 bg-surface px-4 aria-[invalid=true]:border-2 aria-[invalid=true]:border-mauve";
const btn = "min-h-12 rounded-full bg-mauve px-8 text-white hover:bg-[#6f4353] disabled:bg-mauve/40";

function Field({ id, label, error, ...rest }: { id: string; label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-bold">{label}</label>
      <input id={id} name={id} className={inputCls} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : undefined} {...rest} />
      {error && <p id={`${id}-err`} className="mt-1 text-sm font-medium">⚠ {error}</p>}
    </div>
  );
}

function PasswordField({ id, label, error, show, onToggle, labels, ...rest }: { id: string; label: string; error?: string; show: boolean; onToggle: () => void; labels: { show: string; hide: string } } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-bold">{label}</label>
      <div className="relative">
        <input id={id} name={id} type={show ? "text" : "password"} dir="ltr" className={`${inputCls} pr-12`} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : undefined} {...rest} />
        <button type="button" onClick={onToggle} aria-label={show ? labels.hide : labels.show} aria-pressed={show}
          className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full hover:bg-blush/40">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {!show && <path d="M4 4l16 16" />}
          </svg>
        </button>
      </div>
      {error && <p id={`${id}-err`} className="mt-1 text-sm font-medium">⚠ {error}</p>}
    </div>
  );
}

const REMEMBER_KEY = "litore.remember.v1";
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export function AuthForm({ locale, dict, mode, emailMode = false }: Base & { mode: "login" | "register" | "forgot"; emailMode?: boolean }) {
  const a = dict.account;
  const router = useRouter();
  const { login, register, user, ready } = useAccount();
  const [v, setV] = useState({ name: "", email: "", password: "", phone: "", identifier: "", referral: "", myCode: "" });
  const { applyCoupon } = useCart();
  const [err, setErr] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const [via, setVia] = useState<"email" | "whatsapp">("whatsapp");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);

  // "Remember me" keeps the e-mail on this device so only the password is needed next time.
  useEffect(() => {
    if (mode !== "login") return;
    try {
      const saved = window.localStorage.getItem(REMEMBER_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setV((x) => ({ ...x, email: saved }));
    } catch {
      /* ignore */
    }
  }, [mode]);

  useEffect(() => {
    if (ready && user && mode !== "forgot") router.replace(`/${locale}/account`);
  }, [ready, user, mode, router, locale]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const next: Record<string, string> = {};
    if (mode === "forgot") {
      const id = v.identifier.trim();
      if (id.length < 5) next.identifier = id ? a.invalidEmail : a.required;
      if (Object.keys(next).length === 0) {
        setBusy(true);
        const res = await fetch("/api/account/forgot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: id, locale }) }).catch(() => null);
        setBusy(false);
        if (res?.status === 429) next.identifier = a.tooMany;
        else if (!res || !res.ok) next.identifier = a.invalidEmail;
        else { setVia((await res.json().catch(() => ({}))).via === "email" ? "email" : "whatsapp"); setSent(true); }
      }
      setErr(next);
      return;
    }
    if (!emailOk(v.email.trim())) next.email = v.email.trim() ? a.invalidEmail : a.required;
    if (mode === "register" && v.name.trim().length < 2) next.name = a.required;
    if (v.password.length < 8) next.password = v.password ? a.passwordShort : a.required;
    if (Object.keys(next).length === 0) {
      setBusy(true);
      const r = mode === "login" ? await login(v.email, v.password, remember) : await register(v.name, v.email, v.password, v.phone, { referralCode: v.referral, myCode: v.myCode });
      setBusy(false);
      const welcome = (r as { welcome?: { coupon: string; percent: number } | null }).welcome;
      if (r.ok && welcome) {
        await applyCoupon(welcome.coupon); // the welcome discount is waiting in her cart
        try { window.sessionStorage.setItem("litore_welcome", String(welcome.percent)); } catch { /* ignore */ }
      }
      if (r.ok && mode === "login") {
        try {
          if (remember) window.localStorage.setItem(REMEMBER_KEY, v.email.trim().toLowerCase());
          else window.localStorage.removeItem(REMEMBER_KEY);
        } catch {
          /* ignore */
        }
      }
      if (!r.ok && r.error === "code_taken") next.myCode = a.codeTaken;
      else if (!r.ok && "field" in r && r.field === "myCode") next.myCode = a.codeInvalid;
      else if (!r.ok) next.email = r.error === "exists" ? a.exists : r.error === "too_many" ? a.tooMany : r.error === "invalid_credentials" ? a.notFound : a.required;
    }
    setErr(next);
  }

  const title = mode === "login" ? a.login : mode === "register" ? a.register : a.forgotTitle;
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-center font-display text-4xl font-semibold">{title}</h1>
      <form onSubmit={submit} noValidate className="space-y-4 rounded-card border border-gold/40 bg-surface p-6">
        {mode === "forgot" && <p className="text-sm leading-7">{emailMode ? a.forgotHintEmail : a.forgotHint}</p>}
        {mode === "register" && <Field id="name" label={a.name} autoComplete="name" value={v.name} error={err.name} onChange={(e) => setV({ ...v, name: e.target.value })} />}
        {mode !== "forgot" && <Field id="email" label={a.email} type="email" dir="ltr" autoComplete="email" inputMode="email" value={v.email} error={err.email} onChange={(e) => setV({ ...v, email: e.target.value })} />}
        {mode === "register" && <Field id="phone" label={a.phoneOptional} type="tel" dir="ltr" autoComplete="tel" inputMode="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />}
        {mode !== "forgot" && (
          <PasswordField id="password" label={a.password} show={show} onToggle={() => setShow((x) => !x)} labels={{ show: a.showPassword, hide: a.hidePassword }}
            autoComplete={mode === "login" ? "current-password" : "new-password"} value={v.password} error={err.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
        )}
        {mode === "register" && (
          <>
            <Field id="referral" label={a.haveReferral} dir="ltr" autoComplete="off" placeholder={a.referralPh} value={v.referral} onChange={(e) => setV({ ...v, referral: e.target.value })} />
            <Field id="myCode" label={a.makeCode} dir="ltr" autoComplete="off" placeholder={a.makeCodePh} value={v.myCode} error={err.myCode} onChange={(e) => setV({ ...v, myCode: e.target.value })} />
          </>
        )}
        {mode === "forgot" && <Field id="identifier" label={a.forgotIdentifier} dir="ltr" autoComplete="username" value={v.identifier} error={err.identifier} onChange={(e) => setV({ ...v, identifier: e.target.value })} />}
        <button className={`${btn} w-full`} disabled={busy}>{mode === "forgot" ? a.send : title}</button>
        {mode === "login" && (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-5 w-5 accent-[#8a5568]" />
            {a.remember}
          </label>
        )}
        {sent && (
          <div role="status" className="space-y-2 rounded-xl bg-blush/30 p-3 text-sm font-medium">
            <p>{via === "email" ? a.forgotSentEmail : a.forgotSent}</p>
            {via === "whatsapp" && <a className="underline" href={waLink(locale === "ar" ? "مرحبًا، أحتاج مساعدة في استرجاع كلمة سر حسابي في Litore" : "Hi, I need help recovering my Litore account password")} target="_blank" rel="noopener noreferrer">{a.forgotWa}</a>}
          </div>
        )}
        <div className="space-y-1 text-center text-sm">
          {mode === "login" && (
            <>
              <p><Link href={`/${locale}/account/forgot`} className="underline">{a.forgot}</Link></p>
              <p>{a.noAccount} <Link href={`/${locale}/account/register`} className="underline">{a.register}</Link></p>
            </>
          )}
          {mode === "register" && <p>{a.haveAccount} <Link href={`/${locale}/account/login`} className="underline">{a.login}</Link></p>}
          {mode === "forgot" && <p><Link href={`/${locale}/account/login`} className="underline">{a.login}</Link></p>}
        </div>
      </form>
    </div>
  );
}

/** Opened from the WhatsApp link: sets a new password using the one-hour token. */
export function ResetForm({ locale, dict, token }: Base & { token: string }) {
  const a = dict.account;
  const [v, setV] = useState({ password: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (v.password.length < 8) return setMsg({ ok: false, text: a.passwordShort });
    if (v.password !== v.confirm) return setMsg({ ok: false, text: a.passwordMismatch });
    setBusy(true);
    const res = await fetch("/api/account/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, password: v.password }) }).catch(() => null);
    setBusy(false);
    if (res?.ok) setMsg({ ok: true, text: a.resetDone });
    else setMsg({ ok: false, text: res?.status === 429 ? a.tooMany : a.resetExpired });
  }
  const labels = { show: a.showPassword, hide: a.hidePassword };
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-center font-display text-4xl font-semibold">{a.resetTitle}</h1>
      <form onSubmit={submit} noValidate className="space-y-4 rounded-card border border-gold/40 bg-surface p-6">
        {!(msg?.ok) && (
          <>
            <PasswordField id="password" label={a.newPassword} show={show} onToggle={() => setShow((x) => !x)} labels={labels} autoComplete="new-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
            <PasswordField id="confirm" label={a.confirmPassword} show={show} onToggle={() => setShow((x) => !x)} labels={labels} autoComplete="new-password" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} />
            <button className={`${btn} w-full`} disabled={busy}>{a.save}</button>
          </>
        )}
        {msg && <p role="status" className="text-sm font-medium">{msg.ok ? "✓ " : "⚠ "}{msg.text}</p>}
        {msg?.ok && <Link href={`/${locale}/account/login`} className={`${btn} inline-flex w-full items-center justify-center`}>{a.login}</Link>}
        {msg && !msg.ok && <p className="text-center text-sm"><Link href={`/${locale}/account/forgot`} className="underline">{a.forgot}</Link></p>}
      </form>
    </div>
  );
}

/** Shell for signed-in pages: redirects guests to login and shows the account tabs. */
export function AccountShell({ locale, dict, children }: Base & { children: React.ReactNode }) {
  const a = dict.account;
  const router = useRouter();
  const { ready, user, logout } = useAccount();
  useEffect(() => {
    if (ready && !user) router.replace(`/${locale}/account/login`);
  }, [ready, user, router, locale]);
  if (!ready || !user) return <p role="status" className="py-16 text-center">{a.redirecting}</p>;

  const tabs = [
    [`/${locale}/account`, a.profile],
    [`/${locale}/account/orders`, a.orders],
    [`/${locale}/account/addresses`, a.addresses],
    [`/${locale}/account/referrals`, a.refTitle],
    [`/${locale}/wishlist`, a.favorites],
  ];
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">{a.hello}، {user.name}</h1>
        <button onClick={logout} className="min-h-11 rounded-full border border-mauve px-5 text-sm hover:bg-blush/40">{a.logout}</button>
      </div>
      <nav aria-label={a.title} className="mb-6 flex flex-wrap gap-2">
        {tabs.map(([href, label]) => (
          <Link key={href} href={href} className="inline-flex min-h-11 items-center rounded-full border border-gold/50 bg-surface px-5 text-sm hover:bg-blush/40">{label}</Link>
        ))}
      </nav>
      {children}
    </div>
  );
}

export function ProfileView({ dict }: Base) {
  const a = dict.account;
  const { user, updateProfile, refresh } = useAccount();
  const [v, setV] = useState({ name: user?.name ?? "", phone: user?.phone ?? "", birthday: user?.birthday ?? "", city: user?.city ?? "", email: user?.email ?? "", currentPassword: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [photoErr, setPhotoErr] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  if (!user) return null;
  const emailChanged = v.email.trim().toLowerCase() !== user.email;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (v.name.trim().length < 2) return setMsg({ ok: false, text: a.required });
    if (!emailOk(v.email.trim())) return setMsg({ ok: false, text: a.invalidEmail });
    setBusy(true);
    const r = await updateProfile({ name: v.name, phone: v.phone, birthday: v.birthday, city: v.city, email: v.email, currentPassword: emailChanged ? v.currentPassword : undefined });
    setBusy(false);
    if (r.ok) { setMsg({ ok: true, text: a.saved }); setV((x) => ({ ...x, currentPassword: "" })); }
    else setMsg({ ok: false, text: r.error === "wrong_password" ? a.wrongPassword : r.error === "exists" ? a.exists : r.error === "too_many" ? a.tooMany : a.required });
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const fd = new FormData();
    fd.append("avatar", f);
    const res = await fetch("/api/account/profile", { method: "POST", body: fd }).catch(() => null);
    setPhotoErr(!res?.ok);
    if (res?.ok) await refresh();
  }
  async function removePhoto() {
    await fetch("/api/account/profile?remove=1", { method: "POST" });
    await refresh();
  }
  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    if (pw.next.length < 8) return setPwMsg({ ok: false, text: a.passwordShort });
    const res = await fetch("/api/account/password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(pw) }).catch(() => null);
    if (res?.ok) { setPwMsg({ ok: true, text: a.saved }); setPw({ current: "", next: "" }); }
    else setPwMsg({ ok: false, text: res?.status === 403 ? a.wrongPassword : a.tooMany });
  }
  const labels = { show: a.showPassword, hide: a.hidePassword };
  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center gap-4 rounded-card border border-gold/40 bg-surface p-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {user.avatar ? <img src={`/uploads/${user.avatar}`} alt={a.photo} className="h-20 w-20 rounded-full object-cover ring-2 ring-gold/60" /> : (
          <span aria-hidden="true" className="flex h-20 w-20 items-center justify-center rounded-full bg-blush font-display text-3xl">{user.name.slice(0, 1)}</span>
        )}
        <div className="space-y-2">
          <p className="font-bold">{a.photo}</p>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-mauve px-5 text-sm hover:bg-blush/40">
              {a.changePhoto}
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} className="sr-only" />
            </label>
            {user.avatar && <button type="button" onClick={removePhoto} className="min-h-11 px-3 text-sm underline">{a.removePhoto}</button>}
          </div>
          {photoErr && <p role="alert" className="text-sm">⚠ {a.photoError}</p>}
        </div>
      </section>

      <form onSubmit={save} noValidate className="space-y-4 rounded-card border border-gold/40 bg-surface p-5">
        <Field id="p-name" label={a.name} autoComplete="name" value={v.name} onChange={set("name")} />
        <Field id="p-email" label={a.email} type="email" dir="ltr" autoComplete="email" inputMode="email" value={v.email} onChange={set("email")} />
        {emailChanged && (
          <>
            <p className="text-sm">{a.emailChangeHint}</p>
            <PasswordField id="p-cur" label={a.currentPassword} show={showPw} onToggle={() => setShowPw((x) => !x)} labels={labels} autoComplete="current-password" value={v.currentPassword} onChange={set("currentPassword")} />
          </>
        )}
        <Field id="p-phone" label={a.phone} type="tel" dir="ltr" autoComplete="tel" inputMode="tel" value={v.phone} onChange={set("phone")} />
        <Field id="p-birthday" label={a.birthday} type="date" value={v.birthday} onChange={set("birthday")} />
        <Field id="p-city" label={a.city} autoComplete="address-level2" value={v.city} onChange={set("city")} />
        <button className={btn} disabled={busy}>{a.save}</button>
        {msg && <p role="status" className="text-sm font-medium">{msg.ok ? "" : "⚠ "}{msg.text}</p>}
      </form>

      <form onSubmit={changePw} noValidate className="space-y-4 rounded-card border border-gold/40 bg-surface p-5">
        <h2 className="font-bold">{a.changePassword}</h2>
        <PasswordField id="pw-cur" label={a.currentPassword} show={showPw} onToggle={() => setShowPw((x) => !x)} labels={labels} autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
        <PasswordField id="pw-new" label={a.newPassword} show={showPw} onToggle={() => setShowPw((x) => !x)} labels={labels} autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
        <button className={btn}>{a.changePassword}</button>
        {pwMsg && <p role="status" className="text-sm font-medium">{pwMsg.ok ? "" : "⚠ "}{pwMsg.text}</p>}
      </form>
    </div>
  );
}

const RET_WHY: [string, string, string][] = [["damaged", "المنتج وصل تالفًا", "Item arrived damaged"], ["wrong", "استلمت منتجًا غير المطلوب", "Wrong item received"], ["color", "اللون غير مناسب", "Colour not right"], ["comfort", "غير مريح", "Not comfortable"], ["other", "سبب آخر", "Other reason"]];
function ReturnRequest({ orderId, locale, sent }: { orderId: string; locale: string; sent: boolean }) {
  const ar = locale === "ar";
  const [open, setOpen] = useState(false); const [reason, setReason] = useState("damaged"); const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">(sent ? "done" : "idle");
  async function send(e: React.FormEvent) {
    e.preventDefault(); setState("busy");
    const r = await fetch("/api/account/returns", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId, reason, details }) });
    setState(r.ok || r.status === 409 ? "done" : "error");
  }
  if (state === "done") return <p className="w-full text-sm font-medium text-mauve" role="status">{ar ? "تم استلام طلب المرتجع وسنتواصل معك قريبًا 🌸" : "Return request received — we will contact you soon 🌸"}</p>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center rounded-full border border-gold px-5 text-sm hover:bg-blush/40">{ar ? "طلب مرتجع" : "Request a return"}</button>;
  return (
    <form onSubmit={send} className="w-full space-y-2 border-t border-gold/30 pt-3">
      <label className="block text-sm font-bold" htmlFor={`rw-${orderId}`}>{ar ? "سبب الإرجاع" : "Reason"}</label>
      <select id={`rw-${orderId}`} value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-11 w-full rounded-xl border border-gold/50 px-3 text-base">{RET_WHY.map(([k, a, e]) => <option key={k} value={k}>{ar ? a : e}</option>)}</select>
      <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={2} maxLength={600} placeholder={ar ? "تفاصيل إضافية (اختياري)" : "More details (optional)"} className="w-full rounded-xl border border-gold/50 px-3 py-2 text-base" />
      {state === "error" && <p role="alert" className="text-sm">{ar ? "تعذّر الإرسال، حاولي مرة أخرى." : "Could not send, please try again."}</p>}
      <div className="flex gap-2"><button disabled={state === "busy"} className="min-h-11 rounded-full bg-mauve px-6 text-white disabled:opacity-50">{ar ? "إرسال الطلب" : "Send request"}</button><button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-full border border-mauve px-5">{ar ? "إلغاء" : "Cancel"}</button></div>
    </form>
  );
}

export function OrdersView({ locale, dict }: Base) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [rets, setRets] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    fetch("/api/account/returns").then((r) => r.json()).then((d) => live && setRets((d.returns ?? []).map((x: { orderId: string }) => x.orderId))).catch(() => {});
    fetch("/api/account/orders").then((r) => r.json()).then((d) => live && setOrders(d.orders ?? []));
    return () => { live = false; };
  }, []);

  if (orders && orders.length === 0) return <EmptyState title={dict.account.noOrders} hint="" href={`/${locale}/shop`} cta={dict.cart.continue} />;
  return (
    <ul className="space-y-3" aria-busy={!orders}>
      {orders?.map((o) => (
        <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-gold/40 bg-surface p-4">
          <div>
            <p className="font-bold" dir="ltr">{o.id}</p>
            <p className="text-sm">{new Date(o.createdAt).toLocaleDateString(locale === "ar" ? "ar-AE" : "en-AE")}</p>
          </div>
          <p className="font-bold">{formatPrice(o.total, o.currency, locale)}</p>
          <Link href={`/${locale}/order/${o.id}`} className="inline-flex min-h-11 items-center rounded-full border border-mauve px-5 text-sm hover:bg-blush/40">{dict.account.view}</Link>
          {(o.status === "delivered" || o.status === "shipped") && <ReturnRequest orderId={o.id} locale={locale} sent={rets.includes(o.id)} />}
        </li>
      ))}
    </ul>
  );
}

export function AddressesView({ dict }: Base) {
  const a = dict.account;
  const { user, addAddress, removeAddress } = useAccount();
  const blank = { label: "", name: "", phone: "", line1: "", city: "", country: "AE" };
  const [v, setV] = useState(blank);
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    for (const k of ["label", "name", "phone", "line1", "city"] as const) if (!v[k].trim()) next[k] = a.required;
    setErr(next);
    if (Object.keys(next).length) return;
    await addAddress(v);
    setV(blank);
  }

  return (
    <div className="space-y-6">
      {user && user.addresses.length === 0 ? <p>{a.noAddresses}</p> : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {user?.addresses.map((x) => (
            <li key={x.id} className="rounded-card border border-gold/40 bg-surface p-4 text-sm">
              <p className="font-bold">{x.label}</p>
              <p>{x.name} · <span dir="ltr">{x.phone}</span></p>
              <p>{x.line1}، {x.city}، {(dict.countries as Record<string, string>)[x.country]}</p>
              <button onClick={() => removeAddress(x.id)} className="mt-2 min-h-11 underline">{a.delete}</button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} noValidate className="space-y-4 rounded-card border border-gold/40 bg-surface p-5">
        <h2 className="font-bold">{a.addAddress}</h2>
        <Field id="label" label={a.label} value={v.label} error={err.label} onChange={set("label")} />
        <Field id="name" label={a.name} value={v.name} error={err.name} onChange={set("name")} />
        <Field id="phone" label={a.phone} type="tel" dir="ltr" value={v.phone} error={err.phone} onChange={set("phone")} />
        <Field id="line1" label={a.line1} value={v.line1} error={err.line1} onChange={set("line1")} />
        <Field id="city" label={a.city} value={v.city} error={err.city} onChange={set("city")} />
        <div>
          <label htmlFor="country" className="mb-1 block text-sm font-bold">{a.country}</label>
          <select id="country" value={v.country} onChange={set("country")} className={inputCls}>
            {gulfMarkets.map((m) => <option key={m.code} value={m.code}>{(dict.countries as Record<string, string>)[m.code]}</option>)}
          </select>
        </div>
        <button className={btn}>{a.save}</button>
      </form>
    </div>
  );
}

export function WishlistView({ locale, dict }: Base) {
  const { wishlist, ready } = useAccount();
  const [items, setItems] = useState<Product[] | null>(null);
  useEffect(() => {
    if (!ready) return;
    let live = true;
    fetch(`/api/products?ids=${wishlist.join(",")}`).then((r) => r.json()).then((d) => live && setItems(d.products));
    return () => { live = false; };
  }, [wishlist, ready]);

  if (items && (items.length === 0 || wishlist.length === 0)) {
    return <EmptyState title={dict.wishlist.empty} hint={dict.wishlist.emptyHint} href={`/${locale}/shop`} cta={dict.cart.continue} />;
  }
  return (
    <ul className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4" aria-busy={!items}>
      {items?.map((p) => <li key={p.id}><ProductCard product={p} locale={locale} mockLabel={dict.preview.mockBadge} /></li>)}
    </ul>
  );
}

export function WishlistButton({ productId, dict }: { productId: string; dict: Dictionary }) {
  const { wishlist, toggleWishlist } = useAccount();
  const on = wishlist.includes(productId);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => toggleWishlist(productId)}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gold/50 bg-surface px-5 text-sm hover:bg-blush/40"
    >
      <span aria-hidden="true">{on ? "♥" : "♡"}</span>
      {on ? dict.wishlist.remove : dict.wishlist.add}
    </button>
  );
}

export function TrackForm({ locale, dict }: Base) {
  const router = useRouter();
  const [id, setId] = useState("");
  const t = dict.track;
  return (
    <form
      className="mx-auto mt-6 max-w-md space-y-4 rounded-card border border-gold/40 bg-surface p-6"
      onSubmit={(e) => { e.preventDefault(); if (id.trim()) router.push(`/${locale}/order/${encodeURIComponent(id.trim().toUpperCase())}`); }}
    >
      <p className="text-sm">{t.hint}</p>
      <Field id="order" label={t.label} dir="ltr" value={id} onChange={(e) => setId(e.target.value)} />
      <button className={`${btn} w-full`}>{t.button}</button>
    </form>
  );
}

type RefData = {
  code: string | null; balance: number; joined: number; refereePct: number; ownerPct: number;
  coupons: { code: string; value: number }[];
  redemptions: { id: string; percent: number; kind: string; status: string; coupon_code: string | null }[];
};

export function ReferralsView({ dict, locale }: Base) {
  const a = dict.account;
  const [d, setD] = useState<RefData | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const load = () => fetch("/api/account/referral").then((r) => r.json()).then((x) => { setD(x); setCode((c) => c || x.code || ""); });
  useEffect(() => { let live = true; fetch("/api/account/referral").then((r) => r.json()).then((x) => { if (live) { setD(x); setCode(x.code || ""); } }); return () => { live = false; }; }, []);

  async function saveCode(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/account/referral", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
    setMsg(res.ok ? a.saved : res.status === 409 ? a.codeTaken : a.codeInvalid);
    if (res.ok) await load();
  }
  async function redeem(kind: "discount" | "free_product") {
    const res = await fetch("/api/account/referral/redeem", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind }) });
    setMsg(res.ok ? a.refRedeemSent : a.required);
    await load();
  }
  if (!d) return <p role="status" className="py-8 text-center">…</p>;
  const shareText = locale === "ar" ? `سجّلي في Litore بكودي ${d.code} وخذي خصم ${d.refereePct}% 🌸 https://litore.store/ar/account/register` : `Join Litore with my code ${d.code} and get ${d.refereePct}% off 🌸 https://litore.store/en/account/register`;
  const st = (s: string) => (s === "approved" ? a.refApproved : s === "rejected" ? a.refRejected : a.refPending);
  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-card border border-gold/40 bg-surface p-5">
        <h2 className="font-bold">{a.refTitle}</h2>
        <p className="text-sm leading-7">{a.refIntro.replace("{a}", String(d.refereePct)).replace("{b}", String(d.ownerPct))}</p>
        <form onSubmit={saveCode} className="space-y-3">
          <Field id="refcode" label={a.refYourCode} dir="ltr" autoComplete="off" placeholder={a.makeCodePh} value={code} onChange={(e) => setCode(e.target.value)} />
          <p className="text-xs opacity-80">{a.refChangeHint}</p>
          <div className="flex flex-wrap gap-2">
            <button className={btn}>{a.refSaveCode}</button>
            {d.code && (
              <>
                <button type="button" onClick={() => { void navigator.clipboard?.writeText(d.code!); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="min-h-12 rounded-full border border-mauve px-6 hover:bg-blush/40">{copied ? a.refCopied : a.refCopy}</button>
                <a href={waLink(shareText)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center rounded-full border border-mauve px-6 hover:bg-blush/40">{a.refShare}</a>
              </>
            )}
          </div>
        </form>
      </section>

      <section className="space-y-3 rounded-card border border-gold/40 bg-surface p-5">
        <p className="font-bold">{a.refBalance}: <span dir="ltr">{d.balance}%</span> · {a.refJoined}: {d.joined}</p>
        <div className="h-3 overflow-hidden rounded-full bg-blush" role="progressbar" aria-valuenow={d.balance} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-mauve" style={{ width: `${Math.min(100, d.balance)}%` }} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button disabled={d.balance <= 0} onClick={() => redeem("discount")} className={btn}>{a.refRedeemDiscount}</button>
          <button disabled={d.balance < 100} onClick={() => redeem("free_product")} className="min-h-12 rounded-full border border-mauve px-6 hover:bg-blush/40 disabled:opacity-40">{a.refRedeemFree}</button>
        </div>
        {msg && <p role="status" className="text-sm font-medium">{msg}</p>}
      </section>

      <section className="space-y-2 rounded-card border border-gold/40 bg-surface p-5">
        <h2 className="font-bold">{a.refCoupons}</h2>
        {d.coupons.length === 0 ? <p className="text-sm">{a.refNoCoupons}</p> : (
          <ul className="space-y-2">{d.coupons.map((c) => <li key={c.code} className="flex items-center justify-between gap-3 rounded-xl bg-blush/30 p-3"><strong dir="ltr" className="select-all">{c.code}</strong><span>{c.value}%</span></li>)}</ul>
        )}
        {d.redemptions.length > 0 && (
          <>
            <h3 className="pt-2 font-bold">{a.refRequests}</h3>
            <ul className="space-y-1 text-sm">{d.redemptions.map((r) => <li key={r.id}>{r.percent}% — {st(r.status)}{r.coupon_code ? <> · <strong dir="ltr" className="select-all">{r.coupon_code}</strong></> : null}</li>)}</ul>
          </>
        )}
      </section>
    </div>
  );
}
