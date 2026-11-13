"use client";

import { useRef, useState } from "react";

type Existing = { id: string; file: string };

/** Clear "add photos" button, previews of what was chosen, and controls for the photos already saved. */
export function ImagePicker({ existing, spin }: { existing: Existing[]; spin: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<{ name: string; url: string }[]>([]);
  const [dels, setDels] = useState<Record<string, boolean>>({});

  const MAX = 12;
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState<File[]>([]);

  // Phone photos are big: shrink each to max 1600px WebP in the browser so uploads stay fast and under the server limit.
  async function shrink(f: File): Promise<File> {
    try {
      const bmp = await createImageBitmap(f);
      const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
      const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/webp", 0.86));
      if (!blob || blob.size >= f.size) return f;
      return new File([blob], f.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" });
    } catch { return f; }
  }

  function apply(files: File[]) {
    setChosen(files);
    if (ref.current) { const dt = new DataTransfer(); files.forEach((f) => dt.items.add(f)); ref.current.files = dt.files; }
    setPreviews((old) => { old.forEach((p) => URL.revokeObjectURL(p.url)); return files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })); });
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) return;
    setBusy(true);
    const small = await Promise.all(picked.map(shrink));
    apply([...chosen, ...small].slice(0, MAX));
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <input ref={ref} id="images" name="images" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={onPick} className="sr-only" />
      <button type="button" onClick={() => ref.current?.click()}
        className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-mauve bg-blush/30 px-4 text-base font-bold hover:bg-blush/50 sm:w-auto">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
        {busy ? "جارٍ تجهيز الصور…" : "إضافة صور (اختاري عدة صور مرة واحدة)"}
      </button>
      <p className="text-xs opacity-80">JPG أو PNG أو WebP (حتى 12 صورة، وتُصغَّر تلقائيًا لتُرفع بسرعة). الصور تظهر بنفس ترتيبها؛ الأولى هي صورة البطاقة.</p>

      {previews.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-3 text-sm font-bold">صور جديدة سيتم رفعها عند «حفظ» ({previews.length}):<button type="button" onClick={() => apply([])} className="text-xs font-normal underline">مسح المختارة</button></p>
          <ul className="flex flex-wrap gap-3">
            {previews.map((p) => (
              <li key={p.url} className="text-center text-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="size-24 rounded-xl border border-gold/40 object-cover" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {existing.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-bold">الصور الحالية — غيّري رقم الترتيب لتغيير مكان الصورة، أو علّمي «حذف»:</p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {existing.map((im, i) => (
              <li key={im.id} className={`space-y-2 rounded-xl border border-gold/40 p-2 text-xs ${dels[im.id] ? "opacity-40" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/uploads/${im.file}`} alt="" className="aspect-square w-full rounded-lg object-cover" />
                <label className="flex items-center gap-2">ترتيب
                  <input type="number" min={1} name={`img_sort_${im.id}`} defaultValue={i + 1} className="min-h-9 w-16 rounded-lg border border-gold/50 px-2" />
                </label>
                <label className="flex min-h-9 items-center gap-2">
                  <input type="checkbox" name={`img_del_${im.id}`} onChange={(e) => setDels({ ...dels, [im.id]: e.target.checked })} /> حذف
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="flex min-h-11 items-start gap-3 rounded-xl bg-blush/30 p-3 text-sm">
        <input type="checkbox" name="spin" defaultChecked={spin} className="mt-1 h-5 w-5" />
        <span><strong>عرض 360°:</strong> فعّليه فقط لو الصور مصوّرة حول المنتج بالترتيب (من زاوية لزاوية). صفحة المنتج ستلف الصور تلقائيًا وتقف عند لمس العميلة أو وقوف الماوس عليها.</span>
      </label>
    </div>
  );
}
