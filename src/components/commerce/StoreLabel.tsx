import QRCode from "qrcode";
import { code128Svg } from "@/lib/barcode";
import type { LabelOrder } from "@/lib/orders/label";
import { uaeDateTime } from "@/lib/time";
import { WHATSAPP_DISPLAY } from "@/lib/site";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://litore.store").replace(/\/$/, "");
const CARRIERS: Record<string, string> = { quiqup: "Quiqup", aramex: "Aramex", emx: "EMX" };
const PAY: Record<LabelOrder["paymentStatus"], [string, string]> = { paid: ["PAID", "مدفوع"], pending: ["UNPAID", "غير مدفوع"], failed: ["UNPAID", "غير مدفوع"], refunded: ["REFUNDED", "مُسترد"] };
const country = (code: string) => { try { return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code; } catch { return code; } };
const n2 = (n: number) => n.toFixed(2);
/** More products than fit are summed into one closing line; the QR receipt lists them all. */
const MAX_LINES = 5;

/** The receipt address printed as a QR code. */
export const receiptUrl = (token: string) => `${SITE}/r/${token}`;

/** Black-and-white styles for a 100 × 150 mm thermal label. Rendered once per print page. */
export const LABEL_CSS = `
@page{size:100mm 150mm;margin:0}
.lt-label{width:100mm;height:150mm;padding:3mm;display:flex;flex-direction:column;background:#fff;color:#000;font-family:Tajawal,Arial,sans-serif;font-size:8pt;line-height:1.25;direction:ltr;text-align:left;box-sizing:border-box;break-after:page;page-break-after:always;overflow:hidden}
.lt-label *{box-sizing:border-box;margin:0;padding:0;color:#000;border-radius:0}
.lt-label .box{border:0.5mm solid #000;outline:0.2mm solid #000;outline-offset:0.7mm;display:flex;flex-direction:column;flex:1;min-height:0;margin:0.9mm}
.lt-label .row{display:flex;border-bottom:0.35mm solid #000}
.lt-label .cell{padding:1.5mm 2mm;min-width:0}
.lt-label .k{font-size:6pt;font-weight:700;letter-spacing:.06em;text-transform:uppercase;display:flex;justify-content:space-between;gap:2mm}
.lt-label .k [lang=ar]{letter-spacing:0;font-size:6.5pt}
.lt-label .head{height:17mm;background:#000}
.lt-label .head *{color:#fff}
.lt-label .brand{flex:1;display:flex;align-items:center;gap:2mm}
.lt-label .brand svg{width:9mm;height:9mm;flex:none}
.lt-label .brand b{font-family:"Cormorant Garamond",Georgia,serif;font-weight:600;font-size:22pt;line-height:.9;display:block}
.lt-label .brand small{font-size:5.8pt;letter-spacing:.05em;display:block;margin-top:.5mm;white-space:nowrap}
.lt-label .state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 3.5mm;text-align:center;background:#fff;margin:1.5mm;min-width:25mm}
.lt-label .state *{color:#000}
.lt-label .state b{font-size:13pt;letter-spacing:.06em;line-height:1}
.lt-label .state span{font-size:9.5pt;font-weight:700;line-height:1.2}
.lt-label .tag{display:flex;justify-content:space-between;font-size:6.2pt;font-weight:700;letter-spacing:.14em;padding:.7mm 2mm;border-bottom:0.35mm solid #000}
.lt-label .tag [lang=ar]{letter-spacing:0;font-size:7pt}
.lt-label .oid{font-family:"DejaVu Sans Mono","Courier New",monospace;font-weight:700;font-size:12.5pt;letter-spacing:.02em;margin-top:.5mm}
.lt-label .bar{height:10.5mm;width:100%;margin-top:.8mm}
.lt-label .bar svg{width:100%;height:100%;display:block}
.lt-label .to .name{font-size:13.5pt;font-weight:700;line-height:1.15;margin-top:.6mm;unicode-bidi:plaintext}
.lt-label .to .ph{font-size:11.5pt;font-weight:700;direction:ltr}
.lt-label .to .ad{font-size:9.6pt;line-height:1.2;margin-top:.4mm;unicode-bidi:plaintext;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.lt-label .to .city{font-size:11.5pt;font-weight:700;text-transform:uppercase;margin-top:.3mm}
.lt-label table{width:100%;border-collapse:collapse;font-size:7.6pt}
.lt-label th{font-size:6pt;text-align:left;letter-spacing:.05em;text-transform:uppercase;border-bottom:0.25mm solid #000;padding:0 0 .6mm;font-weight:700}
.lt-label td{padding:.9mm 0;border-bottom:0.15mm dotted #000;vertical-align:top}
.lt-label td:first-child{max-width:48mm;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.lt-label tr:last-child td{border-bottom:0}
.lt-label .n{text-align:right;white-space:nowrap}
.lt-label .tot{display:grid;grid-template-columns:1fr auto;gap:.3mm 3mm;font-size:8pt}
.lt-label .tot .g{font-weight:700;font-size:11pt;border-top:0.35mm solid #000;padding-top:.7mm;margin-top:.5mm}
.lt-label .pay{margin-top:1.2mm;border:0.35mm solid #000;padding:.9mm 1.5mm;font-size:7.2pt}
.lt-label .pay b{font-size:8.4pt}
.lt-label .qr{width:27mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border-left:0.35mm solid #000}
.lt-label .qr svg{width:21.5mm;height:21.5mm;display:block}
.lt-label .qr p{font-size:5.6pt;line-height:1.2;margin-top:.7mm;font-weight:700}
.lt-label .foot{font-size:6pt;padding:.4mm 2mm 0;display:flex;justify-content:space-between;gap:2mm}
@media screen{.lt-sheet>div{max-width:100%;overflow-x:auto}}
@media print{html,body{background:#fff !important;margin:0 !important;padding:0 !important;min-height:0 !important;height:auto !important}main{margin:0 !important;padding:0 !important;max-width:none !important}.no-print{display:none !important}.lt-sheet{display:block !important;margin:0 !important;padding:0 !important}.lt-sheet>div{box-shadow:none !important;margin:0 !important}main,.lt-sheet{direction:ltr !important}.lt-label{margin:0 !important;height:149.4mm}.lt-sheet>div:last-child .lt-label{break-after:auto;page-break-after:auto}}
`;

const Crown = () => (
  <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#fff" d="M6 34 3 14l11 9 10-15 10 15 11-9-3 20H6zm1 3h34v4H7v-4z" /><circle cx="3" cy="12" r="2.6" fill="#fff" /><circle cx="24" cy="6" r="2.6" fill="#fff" /><circle cx="45" cy="12" r="2.6" fill="#fff" /></svg>
);

/** One store label (invoice + packing slip) for a thermal 100 × 150 mm printer. Litore's own, not the carrier's waybill. */
export async function StoreLabel({ o }: { o: LabelOrder }) {
  const qr = await QRCode.toString(receiptUrl(o.token), { type: "svg", margin: 0, errorCorrectionLevel: "M" });
  const [stEn, stAr] = o.status === "cancelled" ? ["CANCELLED", "ملغي"] : PAY[o.paymentStatus];
  const shown = o.lines.length > MAX_LINES ? o.lines.slice(0, MAX_LINES - 1) : o.lines;
  const rest = o.lines.slice(shown.length);
  const method = o.gateway ? "Card" : "";
  return (
    <section className="lt-label" data-label={o.id} lang="en">
      <div className="box">
        <div className="row head">
          <div className="cell brand"><Crown /><div><b>Litore</b><small>LITORE COSMETICS · litore.store</small><small>WhatsApp {WHATSAPP_DISPLAY}</small></div></div>
          <div className="state" data-state={stEn}><b>{stEn}</b><span lang="ar" dir="rtl">{stAr}</span></div>
        </div>
        <div className="tag"><span>✦ STORE INVOICE ✦</span><span lang="ar" dir="rtl">✦ فاتورة المتجر ✦</span></div>
        <div className="row">
          <div className="cell" style={{ flex: 1 }}>
            <div className="k"><span>Order no.</span><span lang="ar" dir="rtl">رقم الطلب</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><div className="oid">{o.id}</div><div style={{ fontSize: "7.4pt" }}>{uaeDateTime(o.createdAt, "en-GB")}</div></div>
            <div className="bar" dangerouslySetInnerHTML={{ __html: code128Svg(o.id) }} />
          </div>
        </div>
        <div className="row">
          <div className="cell to" style={{ flex: 1 }}>
            <div className="k"><span>Deliver to</span><span lang="ar" dir="rtl">المستلم</span></div>
            <div className="name">{o.name}</div><div className="ph">{o.phone}</div>
            <div className="ad">{[o.line1, o.line2].filter(Boolean).join(", ")}</div>
            <div className="city">{[o.city, o.region !== o.city ? o.region : "", country(o.country)].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
        <div className="row">
          <div className="cell" style={{ flex: 1, borderRight: "0.35mm solid #000" }}><div className="k"><span>From</span><span lang="ar" dir="rtl">المرسل</span></div><b>LITORE COSMETICS</b><div>Abu Dhabi, UAE</div></div>
          <div className="cell" style={{ width: "38mm" }}><div className="k"><span>Carrier</span><span lang="ar" dir="rtl">شركة الشحن</span></div><b style={{ fontSize: "11pt" }}>{CARRIERS[o.carrier] ?? "—"}</b></div>
        </div>
        <div className="row" style={{ flex: 1, minHeight: 0 }}>
          <div className="cell" style={{ flex: 1 }}>
            <table>
              <thead><tr><th>Item · <bdi lang="ar">المنتج</bdi></th><th>Size</th><th className="n">Qty</th><th className="n">{o.currency}</th></tr></thead>
              <tbody>
                {shown.map((l, i) => (
                  <tr key={i}><td><b>{l.nameEn}</b>{l.nameAr ? <> · <bdi lang="ar">{l.nameAr}</bdi></> : null}</td><td>{l.size}</td><td className="n">{l.quantity}</td><td className="n">{n2(l.total)}</td></tr>
                ))}
                {rest.length > 0 && <tr><td><b>+ {rest.length} more items</b> · <bdi lang="ar">منتجات أخرى</bdi></td><td /><td className="n">{rest.reduce((s, l) => s + l.quantity, 0)}</td><td className="n">{n2(rest.reduce((s, l) => s + l.total, 0))}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="row" style={{ borderBottom: 0 }}>
          <div className="cell" style={{ flex: 1 }}>
            <div className="tot">
              <span>Subtotal · <bdi lang="ar">المجموع</bdi></span><span className="n">{n2(o.subtotal)}</span>
              {o.discount > 0 && <><span>Discount · <bdi lang="ar">الخصم</bdi></span><span className="n">−{n2(o.discount)}</span></>}
              <span>Shipping · <bdi lang="ar">الشحن</bdi></span><span className="n">{n2(o.shipping)}</span>
              {o.tax > 0 && <><span>VAT incl. · <bdi lang="ar">شامل الضريبة</bdi></span><span className="n">{n2(o.tax)}</span></>}
              <span className="g">TOTAL · <bdi lang="ar">الإجمالي</bdi></span><span className="n g">{o.currency} {n2(o.total)}</span>
            </div>
            <div className="pay">
              <b>{stEn} · <bdi lang="ar">{stAr}</bdi>{o.paymentStatus === "paid" || o.paymentStatus === "refunded" ? <> · {o.currency} {n2(o.total)}</> : null}</b>
              {o.paymentStatus === "paid" && (method || o.paidAt) ? <><br />{method ? <><bdi>{method}</bdi> · <bdi lang="ar">بطاقة</bdi></> : null}{method && o.paidAt ? " · " : ""}{o.paidAt ? <bdi>{uaeDateTime(o.paidAt, "en-GB")}</bdi> : null}</> : null}
              {o.refunded > 0 ? <><br />Refunded · <bdi lang="ar">المسترد</bdi> · {o.currency} {n2(o.refunded)}</> : null}
            </div>
          </div>
          <div className="cell qr"><div dangerouslySetInnerHTML={{ __html: qr }} /><p>Scan for receipt &amp; payment status<br /><span lang="ar" dir="rtl">امسحي الكود لعرض الإيصال وحالة الدفع</span></p></div>
        </div>
      </div>
      <div className="foot"><span>Thank you for shopping with Litore</span><span lang="ar" dir="rtl">شكرًا لتسوقك من ليتوري</span></div>
    </section>
  );
}
