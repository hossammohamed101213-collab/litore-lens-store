import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { ButtonLink } from "@/components/ui/Button";
import { getSetting } from "@/lib/db";

const SIDE: Record<string, string> = {
  center: "inset-x-0 w-full [mask-image:linear-gradient(to_bottom,#000_55%,transparent_100%)]",
  start: "start-0 w-full md:w-[62%] [mask-image:linear-gradient(to_bottom,#000_55%,transparent_100%),linear-gradient(to_right,#000_55%,transparent_100%)] [mask-composite:intersect] rtl:[mask-image:linear-gradient(to_bottom,#000_55%,transparent_100%),linear-gradient(to_left,#000_55%,transparent_100%)]",
  end: "end-0 w-full md:w-[62%] [mask-image:linear-gradient(to_bottom,#000_55%,transparent_100%),linear-gradient(to_left,#000_55%,transparent_100%)] [mask-composite:intersect] rtl:[mask-image:linear-gradient(to_bottom,#000_55%,transparent_100%),linear-gradient(to_right,#000_55%,transparent_100%)]",
};

export function Hero({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const h = dict.hero;
  const bg = /^[\w.-]+$/.test(getSetting("hero_bg", "")) ? getSetting("hero_bg", "") : "";
  const opacity = Math.min(90, Math.max(10, Number(getSetting("hero_bg_opacity", "40")) || 40)) / 100;
  const side = getSetting("hero_bg_side", "center");
  const pos = Math.min(100, Math.max(0, Number(getSetting("hero_bg_pos", "20")) || 20));
  return (
    <section className="relative isolate overflow-hidden glass-plain">
      {bg && (
        <div className="pointer-events-none absolute inset-y-0 -z-10 overflow-hidden" style={{ insetInline: 0 }} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/uploads/${bg}`} alt="" className={`absolute inset-y-0 h-full object-cover ${SIDE[side] ?? SIDE.center}`} style={{ opacity, objectPosition: `50% ${pos}%` }} />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,245,246,.55),rgba(255,245,246,0)_70%)]" />
        </div>
      )}
      <div className="mx-auto flex min-h-[26rem] max-w-3xl flex-col items-center justify-center px-5 py-14 text-center sm:min-h-[30rem]">
        <p className="mb-3 text-sm tracking-widest text-rose">{h.eyebrow}</p>
        <h1 className="text-balance font-display text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">{h.title}</h1>
        <p className="mx-auto mt-4 max-w-md text-lg">{h.subtitle}</p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <ButtonLink href={`/${locale}/shop`}>{h.cta}</ButtonLink>
          <ButtonLink href={`/${locale}/color-guide`} variant="secondary" className="bg-white/60 backdrop-blur">{h.secondary}</ButtonLink>
        </div>
        <p className="mt-6 text-sm opacity-80">{h.note}</p>
      </div>
    </section>
  );
}
