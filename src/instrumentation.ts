/** Runs once when the server starts (Next.js instrumentation hook). Starts the background payment check. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return; // never during `next build`
  const { startPaymentWatch } = await import("@/lib/payment/watch");
  startPaymentWatch();
}

/** Every error thrown while serving a page, an action or an API route lands here (Next.js hook): it is written to the store's own error log. */
export async function onRequestError(err: unknown, request: { path?: string; method?: string }) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { recordError } = await import("@/lib/ops/errors");
    const e = err as { message?: string; digest?: string };
    recordError("server", `${e?.message ?? String(err)}${e?.digest ? ` [${e.digest}]` : ""}`, `${request?.method ?? ""} ${request?.path ?? ""}`.trim());
  } catch { /* never make a failing request worse */ }
}
