"use client";
import { useRef, useState } from "react";

type Props = { current: string; opacity: number; side: string; pos: number; save: (f: FormData) => void; remove: (f: FormData) => void };

/** Upload the owner's photo for the home-page header: shrinks it in the browser, previews the fade, sets strength/side/position. */
export function HeroBgForm({ current, opacity, side, pos, save, remove }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(current ? `/uploads/${current}` : "");
  const [op, setOp] = useState(opacity); const [sd, setSd] = useState(side); const [ps, setPs] = useState(pos); const [busy, setBusy] = useState(false);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return; setBusy(true);
    try {
      const bmp = await createImageBitmap(f); const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
      const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/webp", 0.88));
      const out = blob && blob.size < f.size ? new File([blob], "hero.webp", { type: "image/webp" }) : f;
      const dt = new DataTransfer(); dt.items.add(out); if (ref.current) ref.current.files = dt.files;
      setPreview(URL.createObjectURL(out));
    } catch { setPreview(URL.createObjectURL(f)); }
    setBusy(false);
  }
  const maskSide = sd === "center" ? "" : sd === "start" ? "to right" : "to left";
  return (
    <div className="space-y-4">
      <form action={save} className="space-y-4">
        <input ref={ref} id="hero_photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} className="sr-only" />
        <button type="button" onClick={() => ref.current?.click()} className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-mauve bg-blush/30 px-4 text-base font-bold hover:bg-blush/50 sm:w-auto">
          {busy ? "جارٍ تجهيز الصورة…" : current || preview ? "تغيير الصورة" : "اختيار صورة الخلفية"}
        </button>
        {preview && (
          <div className="relative h-52 overflow-hidden rounded-card border border-gold/40 bg-gradient-to-br from-[#fde4ec] via-[#fff5f6] to-[#efe6fb]" aria-label="معاينة">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="absolute inset-y-0 h-full w-full object-cover" style={{ opacity: op / 100, objectPosition: `50% ${ps}%`, width: sd === "center" ? "100%" : "62%", [sd === "end" ? "right" : "left"]: 0, maskImage: `linear-gradient(to bottom,#000 55%,transparent 100%)${maskSide ? `,linear-gradient(${maskSide},#000 55%,transparent 100%)` : ""}`, maskComposite: "intersect", WebkitMaskComposite: "source-in" } as React.CSSProperties} />
            <p className="absolute inset-0 grid place-items-center font-display text-2xl font-semibold text-mauve">لوّني نظرتك…</p>
          </div>
        )}
        <div><label htmlFor="op" className="mb-1 block text-sm font-bold">قوة الصورة: {op}% <span className="font-normal opacity-70">(أقل = أشفّ)</span></label>
          <input id="op" name="opacity" type="range" min={10} max={90} value={op} onChange={(e) => setOp(Number(e.target.value))} className="w-full accent-[#8a5568]" /></div>
        <div><label htmlFor="sd" className="mb-1 block text-sm font-bold">مكان الصورة</label>
          <select id="sd" name="side" value={sd} onChange={(e) => setSd(e.target.value)} className="min-h-11 w-full rounded-xl border border-gold/50 px-3 text-base">
            <option value="center">في المنتصف خلف الكلام</option><option value="end">بجانب (مع تلاشي ناعم نحو الكلام)</option><option value="start">الجانب الآخر</option></select></div>
        <div><label htmlFor="ps" className="mb-1 block text-sm font-bold">ارتفاع التركيز على الصورة: {ps}% <span className="font-normal opacity-70">(حرّكيه لإظهار الوجه)</span></label>
          <input id="ps" name="pos" type="range" min={0} max={100} value={ps} onChange={(e) => setPs(Number(e.target.value))} className="w-full accent-[#8a5568]" /></div>
        <button className="min-h-12 rounded-full bg-mauve px-10 text-white hover:bg-[#6f4353]">حفظ الخلفية</button>
      </form>
      {current && <form action={remove}><button className="min-h-11 rounded-full border border-mauve px-6 text-sm hover:bg-blush/40">حذف الصورة (خلفية سادة)</button></form>}
    </div>
  );
}
