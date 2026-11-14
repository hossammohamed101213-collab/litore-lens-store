import { getSetting } from "@/lib/db";
import { removeHeroBg, saveHeroBg } from "../../actions";
import { HeroBgForm } from "../settings/HeroBgForm";
import { Flash, PageTitle } from "../CardGrid";

export default async function BackgroundPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { error, saved } = await searchParams;
  return (
    <>
      <PageTitle icon="🖼️" title="خلفية الصفحة الرئيسية" sub="ارفعي صورتك لتظهر شفافة وفخمة خلف الصفحة الرئيسية. حرّكي القوة والمكان وشوفي المعاينة قبل الحفظ." />
      <Flash saved={saved} error={error} />
      <div className="max-w-xl">
        <HeroBgForm current={getSetting("hero_bg", "")} opacity={Number(getSetting("hero_bg_opacity", "40")) || 40} side={getSetting("hero_bg_side", "center")} pos={Number(getSetting("hero_bg_pos", "20")) || 20} save={saveHeroBg} remove={removeHeroBg} />
      </div>
    </>
  );
}
