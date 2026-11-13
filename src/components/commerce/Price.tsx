import type { Locale } from "@/lib/i18n/config";
import { formatPrice } from "@/lib/i18n/format";

type Props = { amount: number; compareAt?: number; currency: string; locale: Locale; pendingLabel: string };

/** price 0 means "not set yet" (sample data) — never show a fake 0.00. */
export function Price({ amount, compareAt, currency, locale, pendingLabel }: Props) {
  if (!amount) return <span className="text-sm opacity-80">{pendingLabel}</span>;
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className="text-xl font-bold">{formatPrice(amount, currency, locale)}</span>
      {compareAt && compareAt > amount && (
        <s className="text-sm opacity-60">{formatPrice(compareAt, currency, locale)}</s>
      )}
    </span>
  );
}
