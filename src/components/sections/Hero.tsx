import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { ButtonLink } from "@/components/ui/Button";
import { GlassLens } from "@/components/ui/GlassLens";

const LENSES = [
  { c: "#e68aa8", a: "#c7a16a", s: 150, p: "start-[-3rem] top-6", d: 9, o: 0 },
  { c: "#7fc4e6", a: "#e8d3a2", s: 100, p: "start-[18%] top-[62%]", d: 11, o: 1.2 },
  { c: "#a98fe0", a: "#f0d9a0", s: 130, p: "end-[-2.5rem] top-10", d: 10, o: .6 },
  { c: "#7fd1a8", a: "#c7a16a", s: 100, p: "end-[16%] top-[64%]", d: 8, o: 2 },
  { c: "#f2b36b", a: "#8a5a3c", s: 110, p: "start-[42%] top-[-2.5rem]", d: 12, o: 1.6 },
  { c: "#9aa7b5", a: "#e6e0d3", s: 90, p: "start-[6%] top-[78%]", d: 10, o: 2.6 },
  { c: "#d86aa0", a: "#f3c5d2", s: 110, p: "end-[4%] top-[78%]", d: 13, o: .3 },
];

export function Hero({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const h = dict.hero;
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-br from-[#fde4ec] via-[#fff5f6] to-[#efe6fb]">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        {LENSES.map((l, i) => (
          <GlassLens
            key={i}
            color={l.c}
            accent={l.a}
            size={l.s}
            className={`lens-float absolute opacity-80 ${l.p} ${i > 3 ? "hidden sm:block" : ""}`}
            style={{ ["--dur" as string]: `${l.d}s`, ["--delay" as string]: `-${l.o * 3}s`, filter: i % 3 === 0 ? "blur(0.6px)" : undefined }}
          />
        ))}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,245,246,.92),rgba(255,245,246,.55)_45%,rgba(255,245,246,0)_75%)]" />
      </div>
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
