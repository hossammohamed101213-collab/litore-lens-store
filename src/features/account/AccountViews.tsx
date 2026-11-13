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

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export function AuthForm({ locale, dict, mode }: Base & { mode: "login" | "register" | "forgot" }) {
  const a = dict.account;
  const router = useRouter();
  const { login, register, user, ready } = useAccount();
  const [v, setV] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (ready && user && mode !== "forgot") router.replace(`/${locale}/account`);
  }, [ready, user, mode, router, locale]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!emailOk(v.email.trim())) next.email = v.email.trim() ? a.invalidEmail : a.required;
    if (mode === "register" && v.name.trim().length < 2) next.name = a.required;
    if (mode !== "forgot" && v.password.length < 8) next.password = v.password ? a.passwordShort : a.required;
    if (Object.keys(next).length === 0 && mode !== "forgot") {
      const r = mode === "login" ? await login(v.email, v.password) : await register(v.name, v.email, v.password);
      if (!r.ok) next.email = r.error === "exists" ? a.exists : r.error === "too_many" ? a.tooMany : r.error === "invalid_credentials" ? a.notFound : a.required;
    }
    setErr(next);
    if (Object.keys(next).length === 0 && mode === "forgot") setSent(true);
  }

  const title = mode === "login" ? a.login : mode === "register" ? a.register : a.forgotTitle;
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-center font-display text-4xl font-semibold">{title}</h1>
      <form onSubmit={submit} noValidate className="space-y-4 rounded-card border border-gold/40 bg-surface p-6">
        <p className="text-sm">{mode === "forgot" ? a.forgotHint : ""}</p>
        {mode === "register" && <Field id="name" label={a.name} autoComplete="name" value={v.name} error={err.name} onChange={(e) => setV({ ...v, name: e.target.value })} />}
        <Field id="email" label={a.email} type="email" dir="ltr" autoComplete="email" value={v.email} error={err.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
        {mode !== "forgot" && (
          <Field id="password" label={a.password} type="password" dir="ltr" autoComplete={mode === "login" ? "current-password" : "new-password"} value={v.password} error={err.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
        )}
        <button className={`${btn} w-full`}>{mode === "forgot" ? a.send : title}</button>
        {sent && <p role="status" className="text-sm font-medium">{a.forgotSent}</p>}
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
  const { user } = useAccount();
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-card border border-gold/40 bg-surface p-6">
      <dt className="font-bold">{dict.account.name}</dt><dd>{user?.name}</dd>
      <dt className="font-bold">{dict.account.email}</dt><dd dir="ltr" className="text-start">{user?.email}</dd>
    </dl>
  );
}

export function OrdersView({ locale, dict }: Base) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  useEffect(() => {
    let live = true;
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
