import { notFound } from "next/navigation";
import { getSetting } from "@/lib/db";
import { saveSocial } from "../../../actions";
import { Flash, PageTitle, inputCls, panelCls, saveCls } from "../../CardGrid";

const NAMES: Record<string, [string, string]> = { whatsapp: ["💬", "واتساب"], tiktok: ["🎵", "تيك توك"], instagram: ["📸", "إنستجرام"] };

export default async function SocialOne({ params, searchParams }: { params: Promise<{ k: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { k } = await params; const { error, saved } = await searchParams;
  const n = NAMES[k]; if (!n) notFound();
  return (
    <>
      <PageTitle icon={n[0]} title={n[1]} sub={k === "whatsapp" ? "الصقي رابط واتساب. لو تركتيه فاضي يستخدم رقم المتجر." : "الصقي رابط حساب المتجر كاملًا."} />
      <Flash saved={saved} error={error} />
      <form action={saveSocial} className={panelCls}>
        <input type="hidden" name="k" value={k} />
        <div>
          <label htmlFor="url" className="mb-1 block text-sm font-bold">رابط {n[1]}</label>
          <input id="url" name="url" dir="ltr" placeholder="https://" defaultValue={getSetting("social_" + k, "")} className={inputCls} />
        </div>
        <button className={saveCls}>حفظ</button>
      </form>
    </>
  );
}
