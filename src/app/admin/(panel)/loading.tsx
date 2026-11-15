/** Shown at once while an admin page is being prepared (and lets the phone pre-load every page shell). */
export default function Loading() {
  return (
    <div role="status" aria-label="جارٍ التحميل" className="space-y-4">
      <div className="h-9 w-48 animate-pulse rounded-xl bg-white/70" />
      <div className="h-4 w-72 max-w-full animate-pulse rounded bg-white/60" />
      <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-white/60" />)}
      </div>
    </div>
  );
}
