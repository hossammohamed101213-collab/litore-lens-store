"use client";
import { useLinkStatus } from "next/link";
import { createPortal } from "react-dom";

/** Inside a <Link>: the instant it is tapped, the loading page (grey placeholder blocks) fills the screen under the header. */
export function OpeningVeil() {
  const { pending } = useLinkStatus();
  if (!pending || typeof document === "undefined") return null;
  return createPortal(
    <div role="status" aria-label="جارٍ التحميل"
      className="fixed inset-x-0 bottom-0 top-[4.4rem] z-20 overflow-hidden bg-[linear-gradient(160deg,#fff7fa,#fdeef4_45%,#f4effc)]">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <div className="h-9 w-48 animate-pulse rounded-xl bg-white/80" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-white/70" />
        <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-white/70" />)}
        </div>
      </div>
    </div>,
    document.body,
  );
}
