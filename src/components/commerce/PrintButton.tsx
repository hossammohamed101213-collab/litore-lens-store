"use client";

export function PrintButton({ label }: { label: string }) {
  return <button type="button" onClick={() => window.print()} className="min-h-11 rounded-full bg-mauve px-6 text-white hover:bg-[#6f4353]">{label}</button>;
}
