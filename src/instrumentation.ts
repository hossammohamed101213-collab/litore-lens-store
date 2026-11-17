/** Runs once when the server starts (Next.js instrumentation hook). Starts the background payment check. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return; // never during `next build`
  const { startPaymentWatch } = await import("@/lib/payment/watch");
  startPaymentWatch();
}
