"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Opens the browser's print window. The call is made directly in the tap (some browsers ignore a print asked for later),
 * and if no print window appears - as inside an app-style shortcut on iPhone - a short hint says how to print instead.
 */
export function PrintButton({ label, hint, before, className }: { label: string; hint?: string; before?: () => void; className?: string }) {
  const [stuck, setStuck] = useState(false);
  const opened = useRef(false);
  useEffect(() => {
    const on = () => { opened.current = true; setStuck(false); };
    window.addEventListener("beforeprint", on); window.addEventListener("afterprint", on);
    return () => { window.removeEventListener("beforeprint", on); window.removeEventListener("afterprint", on); };
  }, []);
  return (
    <>
      <button type="button" data-print className={className ?? "min-h-11 rounded-full bg-mauve px-6 text-white hover:bg-[#6f4353]"}
        onClick={() => {
          opened.current = false;
          try { before?.(); } catch { /* printing still goes ahead */ }
          try { window.print(); } catch { /* handled by the hint below */ }
          if (hint) window.setTimeout(() => { if (!opened.current) setStuck(true); }, 1500);
        }}>
        {label}
      </button>
      {stuck && hint ? <p role="status" data-print-hint className="no-print mt-2 rounded-xl bg-blush/50 p-3 text-sm font-medium">{hint}</p> : null}
    </>
  );
}
