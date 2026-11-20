/** Same-origin check for state-changing API calls (defence-in-depth next to SameSite cookies). */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // non-browser clients (curl, tests) don't send Origin
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

const attempts = new Map<string, { count: number; reset: number }>();
const MAX_KEYS = 5000;
/** For tests/diagnostics only. */
export const rateLimitKeys = () => attempts.size;

/** Tiny in-memory limiter: max `limit` hits per `windowMs` per key. */
export function rateLimited(key: string, limit = 10, windowMs = 15 * 60_000): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.reset < now) {
    // forget finished windows so made-up keys (random e-mails / addresses) cannot grow the map without limit
    if (attempts.size >= MAX_KEYS) for (const [k, v] of attempts) if (v.reset < now) attempts.delete(k);
    attempts.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}

/**
 * Wrong passwords per account, counted whatever address they come from: 20 within 15 minutes pauses sign-in for that
 * account (even with the right password, or guessing would still pay off) until the window ends. A correct sign-in
 * before that clears the count, so a customer is never slowed by her own few typos.
 */
const failures = new Map<string, { count: number; reset: number }>();
const FAIL_LIMIT = 20, FAIL_WINDOW = 15 * 60_000;
export function tooManyFailures(account: string): boolean {
  const e = failures.get(account);
  return !!e && e.reset >= Date.now() && e.count >= FAIL_LIMIT;
}
export function noteFailure(account: string): void {
  const now = Date.now(); const e = failures.get(account);
  if (!e || e.reset < now) {
    if (failures.size >= MAX_KEYS) for (const [k, v] of failures) if (v.reset < now) failures.delete(k);
    if (failures.size >= MAX_KEYS) return; // full of live entries: the per-address limit still applies
    failures.set(account, { count: 1, reset: now + FAIL_WINDOW });
  } else e.count += 1;
}
export const clearFailures = (account: string): void => { failures.delete(account); };

export const clientIp = (request: Request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
