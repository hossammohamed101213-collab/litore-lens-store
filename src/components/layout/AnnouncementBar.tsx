import type { Locale } from "@/lib/i18n/config";

/** Shows only a real, configured message. Hidden when none is set. */
export function AnnouncementBar({ locale }: { locale: Locale }) {
  const text = locale === "ar" ? process.env.NEXT_PUBLIC_ANNOUNCEMENT_AR : process.env.NEXT_PUBLIC_ANNOUNCEMENT_EN;
  if (!text) return null;
  return (
    <div className="bg-mauve px-4 py-2 text-center text-sm text-white">{text}</div>
  );
}
