import { archiveProduct, saveProduct } from "../../actions";

type Row = Record<string, string | number | null>;
const input = "min-h-11 w-full rounded-xl border border-gold/50 bg-surface px-3";
const card = "space-y-4 rounded-card border border-gold/40 bg-surface p-5";

function F({ label, name, def, type = "text", dir, hint, step }: { label: string; name: string; def?: string | number | null; type?: string; dir?: "ltr"; hint?: string; step?: string }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-bold">{label}</label>
      <input id={name} name={name} type={type} step={step} defaultValue={def ?? ""} dir={dir} className={input} />
      {hint && <p className="mt-1 text-xs opacity-80">{hint}</p>}
    </div>
  );
}

export function ProductForm({ product, variants, error, saved }: { product?: Row; variants: Row[]; error?: string; saved?: boolean }) {
  const p = product ?? {};
  const rows = [...variants, ...Array.from({ length: product ? 2 : 3 }, () => ({}) as Row)];
  return (
    <div className="space-y-6">
    <form action={saveProduct} encType="multipart/form-data" className="space-y-6">
      {p.id && <input type="hidden" name="id" value={String(p.id)} />}
      {error && <p role="alert" className="rounded-xl bg-blush/60 p-3 text-sm font-medium">⚠ {error}</p>}
      {saved && <p role="status" className="rounded-xl bg-blush/40 p-3 text-sm font-medium">تم الحفظ.</p>}

      <section className={card}>
        <h2 className="font-bold">البيانات الأساسية</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <F label="الاسم بالعربي" name="name_ar" def={p.name_ar} />
          <F label="الاسم بالإنجليزي" name="name_en" def={p.name_en} dir="ltr" />
          <F label="وصف مختصر (عربي)" name="short_ar" def={p.short_ar} />
          <F label="وصف مختصر (إنجليزي)" name="short_en" def={p.short_en} dir="ltr" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="desc_ar" className="mb-1 block text-sm font-bold">الوصف الكامل (عربي)</label><textarea id="desc_ar" name="desc_ar" rows={4} defaultValue={String(p.desc_ar ?? "")} className={`${input} py-2`} /></div>
          <div><label htmlFor="desc_en" className="mb-1 block text-sm font-bold">الوصف الكامل (إنجليزي)</label><textarea id="desc_en" name="desc_en" rows={4} dir="ltr" defaultValue={String(p.desc_en ?? "")} className={`${input} py-2`} /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <F label="السعر (درهم)" name="price" type="number" step="0.01" def={p.price_minor != null ? Number(p.price_minor) / 100 : ""} dir="ltr" />
          <F label="السعر قبل الخصم (اختياري)" name="compare_at" type="number" step="0.01" def={p.compare_at_minor ? Number(p.compare_at_minor) / 100 : ""} dir="ltr" hint="يظهر فقط لو أكبر من السعر." />
          <div>
            <label htmlFor="status" className="mb-1 block text-sm font-bold">الحالة</label>
            <select id="status" name="status" defaultValue={String(p.status ?? "draft")} className={input}>
              <option value="draft">مسودة (غير ظاهر)</option><option value="active">منشور</option><option value="archived">مؤرشف</option>
            </select>
          </div>
        </div>
        <F label="رابط المنتج (slug) — اتركه فارغًا ليُنشأ من الاسم الإنجليزي" name="slug" def={p.slug} dir="ltr" />
      </section>

      <section className={card}>
        <h2 className="font-bold">الصورة</h2>
        <input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="block text-sm" />
        <p className="text-xs opacity-80">JPG أو PNG أو WebP، حتى 5MB. يُفضّل صورة مربعة.</p>
        {p.image && (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/uploads/${p.image}`} alt="الصورة الحالية" className="size-24 rounded-xl border border-gold/40 object-cover" />
            <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="remove_image" /> حذف الصورة</label>
          </div>
        )}
      </section>

      <section className={card}>
        <h2 className="font-bold">المواصفات (اختياري — تُكتب فقط من بيانات المورّد المعتمدة)</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="color_family" className="mb-1 block text-sm font-bold">العائلة اللونية</label>
            <select id="color_family" name="color_family" defaultValue={String(p.color_family ?? "")} className={input}>
              <option value="">—</option>
              {[["pink", "وردي"], ["honey", "عسلي"], ["mauve", "موف"], ["gray", "رمادي"], ["hazel", "بندقي"], ["green", "أخضر"], ["blue", "أزرق"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <F label="لون العرض (مثال #D68FA5)" name="swatch" def={p.swatch} dir="ltr" hint="يُستخدم للرسم قبل رفع الصورة." />
          <F label="مدة الاستخدام" name="wear_duration" def={p.wear_duration} />
          <F label="القطر" name="diameter" def={p.diameter} dir="ltr" />
          <F label="الانحناء (Base Curve)" name="base_curve" def={p.base_curve} dir="ltr" />
          <F label="نسبة الماء" name="water_content" def={p.water_content} dir="ltr" />
          <F label="عدد العدسات في العبوة" name="lens_count" type="number" def={p.lens_count} dir="ltr" />
        </div>
      </section>

      <section className={card}>
        <h2 className="font-bold">الخيارات والمخزون</h2>
        <p className="text-xs">اكتب رمز المنتج (SKU) لكل خيار. اترك الصف فارغًا لتجاهله. لو للمنتج خيار واحد يظهر مختارًا تلقائيًا.</p>
        <input type="hidden" name="v_count" value={rows.length} />
        <div className="space-y-3">
          {rows.map((v, i) => (
            <div key={i} className="grid items-end gap-3 rounded-xl border border-gold/30 p-3 sm:grid-cols-6">
              {v.id && <input type="hidden" name={`v_id_${i}`} value={String(v.id)} />}
              <F label="SKU" name={`v_sku_${i}`} def={v.sku} dir="ltr" />
              <F label="اسم الخيار (عربي)" name={`v_title_ar_${i}`} def={v.title_ar} />
              <F label="اسم الخيار (إنجليزي)" name={`v_title_en_${i}`} def={v.title_en} dir="ltr" />
              <F label="المخزون" name={`v_stock_${i}`} type="number" def={v.stock ?? 0} dir="ltr" />
              <F label="سعر خاص (اختياري)" name={`v_price_${i}`} type="number" step="0.01" def={v.price_minor != null ? Number(v.price_minor) / 100 : ""} dir="ltr" />
              {v.id ? <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name={`v_delete_${i}`} /> حذف</label> : <span />}
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button className="min-h-12 rounded-full bg-mauve px-10 text-white hover:bg-[#6f4353]">حفظ</button>
      </div>
    </form>
      {p.id && (
        <form action={archiveProduct}>
          <input type="hidden" name="id" value={String(p.id)} />
          <button className="min-h-11 rounded-full border border-mauve px-6 text-sm hover:bg-blush/40">أرشفة المنتج (إخفاؤه من المتجر)</button>
        </form>
      )}
    </div>
  );
}
