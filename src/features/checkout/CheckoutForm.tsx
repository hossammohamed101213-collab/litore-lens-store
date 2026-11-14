"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { formatPrice } from "@/lib/i18n/format";
import type { ShippingRate } from "@/lib/shipping/types";
import type { Totals } from "@/lib/commerce/totals";
import { gulfMarkets } from "@/lib/shipping/countries";
import { useCart } from "@/features/cart/CartProvider";
import { CartLines } from "@/features/cart/CartLines";
import { CouponForm } from "@/features/cart/CouponForm";
import { EmptyState } from "@/components/ui/EmptyState";

type Values = {
  email: string; phone: string; name: string; country: string;
  city: string; region: string; line1: string; line2: string; postalCode: string;
};
const empty: Values = { email: "", phone: "", name: "", country: "AE", city: "", region: "", line1: "", line2: "", postalCode: "" };

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const phoneOk = (v: string) => /^[+\d][\d\s-]{6,17}$/.test(v);

export function CheckoutForm({ locale, dict, paymentMode }: { locale: Locale; dict: Dictionary; paymentMode: "mock" | "cod" | "online" }) {
  const router = useRouter();
  const { count, lines, validated, coupon, clear } = useCart();
  const [v, setV] = useState<Values>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [quote, setQuote] = useState<{ totals: Totals; taxRate: number; taxInclusive: boolean } | null>(null);
  const [rateId, setRateId] = useState("");
  const [payment, setPayment] = useState<"mock-paid" | "mock-fail" | "cod" | "online">(paymentMode === "cod" ? "cod" : paymentMode === "online" ? "online" : "mock-paid");
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [key] = useState(() => crypto.randomUUID());
  const k = dict.checkout;

  // The server computes shipping, tax and totals; we only display them.
  const lineKey = JSON.stringify(lines);
  const couponCode = coupon?.valid ? coupon.code : undefined;
  useEffect(() => {
    if (count === 0) return;
    let live = true;
    fetch("/api/checkout/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lines: JSON.parse(lineKey), country: v.country, couponCode, shippingRateId: rateId || undefined }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!live || !d.totals) return;
        setRates(d.rates ?? []);
        setRateId(d.rate?.id ?? "");
        setQuote({ totals: d.totals, taxRate: d.taxRate, taxInclusive: d.taxInclusive });
      })
      .catch(() => live && setRates([]));
    return () => { live = false; };
  }, [v.country, lineKey, couponCode, rateId, count]);

  if (count === 0) return <EmptyState title={k.emptyCart} hint={dict.cart.emptyHint} href={`/${locale}/shop`} cta={dict.cart.continue} />;

  const rate = rates.find((r) => r.id === rateId);
  const blocked = validated?.lines.some((l) => l.status === "out_of_stock" || l.status === "not_found");
  const set = (name: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setV((p) => ({ ...p, [name]: e.target.value }));
    setErrors((p) => ({ ...p, [name]: undefined }));
  };

  function validate(): boolean {
    const next: Partial<Record<keyof Values, string>> = {};
    if (!v.email.trim()) next.email = k.required; else if (!emailOk(v.email.trim())) next.email = k.invalidEmail;
    if (!v.phone.trim()) next.phone = k.required; else if (!phoneOk(v.phone.trim())) next.phone = k.invalidPhone;
    if (v.name.trim().length < 2) next.name = k.required;
    if (v.city.trim().length < 2) next.city = k.required;
    if (v.line1.trim().length < 3) next.line1 = k.required;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return; // blocks double clicks
    setBanner(null);
    if (!validate()) {
      document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines,
          contact: { email: v.email.trim(), phone: v.phone.trim() },
          address: {
            name: v.name.trim(), phone: v.phone.trim(), line1: v.line1.trim(),
            line2: v.line2.trim() || undefined, city: v.city.trim(),
            region: v.region.trim() || undefined, country: v.country,
            postalCode: v.postalCode.trim() || undefined,
          },
          shippingRateId: rateId,
          couponCode: coupon?.valid ? coupon.code : undefined,
          paymentMethod: payment,
          idempotencyKey: key,
          locale,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        clear();
        if (data.redirectUrl) { window.location.href = data.redirectUrl; return; }
        router.push(`/${locale}/order/${data.orderId}`);
        return;
      }
      if (res.status === 402) { router.push(`/${locale}/checkout/failed`); return; }
      setBanner(res.status === 409 ? k.stockChanged : dict.cart.error);
    } catch {
      setBanner(dict.cart.error);
    }
    setSubmitting(false);
  }

  const field = (name: keyof Values, label: string, opts: { type?: string; autoComplete?: string; optional?: boolean; dir?: "ltr" } = {}) => (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-bold">{label}</label>
      <input
        id={name} name={name} type={opts.type ?? "text"} value={v[name]} onChange={set(name)}
        autoComplete={opts.autoComplete} dir={opts.dir}
        aria-invalid={errors[name] ? true : undefined} aria-describedby={errors[name] ? `${name}-err` : undefined}
        className="min-h-11 w-full rounded-xl border border-gold/50 bg-surface px-4 aria-[invalid=true]:border-2 aria-[invalid=true]:border-mauve"
      />
      {errors[name] && <p id={`${name}-err`} className="mt-1 text-sm font-medium">⚠ {errors[name]}</p>}
    </div>
  );
  const card = "space-y-4 rounded-card border border-gold/40 bg-surface p-5";

  return (
    <form onSubmit={submit} noValidate className="grid gap-8 lg:grid-cols-[1fr_24rem]">
      <div className="space-y-6">
        <p className="text-sm">{k.guest}</p>
        <section className={card} aria-labelledby="h-contact">
          <h2 id="h-contact" className="font-bold">{k.contact}</h2>
          {field("email", k.email, { type: "email", autoComplete: "email", dir: "ltr" })}
          {field("phone", k.phone, { type: "tel", autoComplete: "tel", dir: "ltr" })}
        </section>

        <section className={card} aria-labelledby="h-address">
          <h2 id="h-address" className="font-bold">{k.address}</h2>
          {field("name", k.name, { autoComplete: "name" })}
          <div>
            <label htmlFor="country" className="mb-1 block text-sm font-bold">{k.country}</label>
            <select id="country" value={v.country} onChange={set("country")} className="min-h-11 w-full rounded-xl border border-gold/50 bg-surface px-4">
              {gulfMarkets.map((m) => (
                <option key={m.code} value={m.code}>{(dict.countries as Record<string, string>)[m.code]}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("city", k.city, { autoComplete: "address-level2" })}
            {field("region", k.region, { autoComplete: "address-level1" })}
          </div>
          {field("line1", k.line1, { autoComplete: "address-line1" })}
          {field("line2", k.line2, { autoComplete: "address-line2" })}
          {field("postalCode", k.postal, { autoComplete: "postal-code", dir: "ltr" })}
        </section>

        <fieldset className={card}>
          <legend className="px-1 font-bold">{k.shippingMethod}</legend>
          {rates.map((r) => (
            <label key={r.id} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-gold/40 px-4 py-2">
              <span className="flex items-center gap-3">
                <input type="radio" name="rate" checked={rateId === r.id} onChange={() => setRateId(r.id)} className="size-4 accent-[#865466]" />
                {r.label[locale]}
              </span>
              <span>{formatPrice(r.amount, r.currency, locale)}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className={card}>
          <legend className="px-1 font-bold">{k.payment}</legend>
          {paymentMode === "online" ? (
            <>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-mauve bg-blush/30 px-4 py-2">
                <input type="radio" name="payment" checked readOnly className="size-4 accent-[#865466]" />
                <span className="font-bold">{k.payOnline}</span>
              </label>
              <p className="text-sm">{k.onlineNote}</p>
            </>
          ) : paymentMode === "cod" ? (
            <>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-mauve bg-blush/30 px-4 py-2">
                <input type="radio" name="payment" checked readOnly className="size-4 accent-[#865466]" />
                <span className="font-bold">{k.payCod}</span>
              </label>
              <p className="text-sm">{k.codNote}</p>
            </>
          ) : (
            <>
              <p className="text-sm">{k.mockNote}</p>
              {([["mock-paid", k.payMock], ["mock-fail", k.payMockFail]] as const).map(([val, label]) => (
                <label key={val} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-gold/40 px-4 py-2">
                  <input type="radio" name="payment" checked={payment === val} onChange={() => setPayment(val)} className="size-4 accent-[#865466]" />
                  {label}
                </label>
              ))}
            </>
          )}
        </fieldset>
      </div>

      <aside className="h-fit space-y-4 rounded-card border border-gold/40 bg-surface p-5 lg:sticky lg:top-24">
        <h2 className="font-bold">{k.summary}</h2>
        <CartLines locale={locale} dict={dict} />
        <CouponForm dict={dict} />
        {quote && validated && (
          <dl>
            {([
              [dict.cart.subtotal, quote.totals.subtotal],
              ...(quote.totals.discount > 0 ? [[dict.cart.discount, -quote.totals.discount]] : []),
              [`${dict.cart.shipping}${rate ? ` (${rate.label[locale]})` : ""}`, quote.totals.shipping],
              ...(quote.totals.tax > 0 ? [[`${dict.cart.tax}${quote.taxInclusive ? ` — ${dict.cart.taxIncluded}` : ""}`, quote.totals.tax]] : []),
            ] as [string, number][]).map(([label, amount]) => (
              <div key={label} className="flex justify-between py-1 text-sm"><dt>{label}</dt><dd>{formatPrice(amount, validated.currency, locale)}</dd></div>
            ))}
            <div className="mt-2 flex justify-between border-t border-gold/40 pt-3 text-lg font-bold"><dt>{dict.cart.total}</dt><dd>{formatPrice(quote.totals.total, validated.currency, locale)}</dd></div>
          </dl>
        )}
        {!rate && quote && <p role="alert" className="text-sm font-medium">{k.noShipping}</p>}
        {banner && (
          <p role="alert" className="rounded-xl bg-blush/60 p-3 text-sm font-medium">
            {banner}{" "}
            <Link href={`/${locale}/cart`} className="underline">{k.backToCart}</Link>
          </p>
        )}
        <button
          type="submit"
          disabled={submitting || !!blocked || !rate || !validated || !quote}
          className="min-h-12 w-full rounded-full bg-mauve text-base font-medium text-white hover:bg-[#6f4353] disabled:cursor-not-allowed disabled:bg-mauve/40"
        >
          {submitting ? k.placing : k.place}
        </button>
      </aside>
    </form>
  );
}
