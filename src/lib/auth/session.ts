import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export type SessionKind = "customer" | "admin";
const COOKIE = { customer: "litore_session", admin: "litore_admin" } as const;
const TTL_SECONDS = { customer: 60 * 60 * 24 * 30, admin: 60 * 60 * 24 * 30 } as const;
/** Without "stay signed in": a customer is signed out after 12 h, the admin after 8 h. */
const SHORT_TTL = { customer: 60 * 60 * 12, admin: 60 * 60 * 8 } as const;

/**
 * The session cookie is always Secure in production. One exception, for the automated Safari (WebKit) test run only: the test build is
 * served over plain http://localhost, where WebKit refuses Secure cookies. E2E_PLAIN_HTTP_COOKIE=1 is honoured ONLY when the site address
 * the build was made for is itself http://localhost, so it can never switch Secure off on the real (https) store.
 */
export const secureCookie = (env: Record<string, string | undefined> = process.env) =>
  env.NODE_ENV === "production" && !(env.E2E_PLAIN_HTTP_COOKIE === "1" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(env.NEXT_PUBLIC_SITE_URL ?? ""));

const sha = (t: string) => createHash("sha256").update(t).digest("hex");

/** Only a hash of the token is stored, so a leaked database cannot be used to log in. */
export async function createSession(kind: SessionKind, userId: string, remember = true) {
  const token = randomBytes(32).toString("base64url");
  db().prepare("DELETE FROM sessions WHERE expires_at < ?").run(Math.floor(Date.now() / 1000)); // housekeeping
  const ttl = remember ? TTL_SECONDS[kind] : SHORT_TTL[kind];
  const expires = Math.floor(Date.now() / 1000) + ttl;
  db().prepare("INSERT INTO sessions(token_hash,kind,user_id,expires_at) VALUES (?,?,?,?)").run(sha(token), kind, userId, expires);
  (await cookies()).set(COOKIE[kind], token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie(),
    path: "/",
    maxAge: ttl,
  });
}

export async function currentUserId(kind: SessionKind): Promise<string | null> {
  const token = (await cookies()).get(COOKIE[kind])?.value;
  if (!token) return null;
  const row = db().prepare("SELECT user_id, expires_at FROM sessions WHERE token_hash = ? AND kind = ?").get(sha(token), kind) as
    | { user_id: string; expires_at: number } | undefined;
  if (!row) return null;
  if (row.expires_at < Math.floor(Date.now() / 1000)) {
    db().prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha(token));
    return null;
  }
  return row.user_id;
}

/** The name of the admin session cookie, for the request gate in `src/proxy.ts`. */
export const ADMIN_COOKIE = COOKIE.admin;

/**
 * True when this token is a live admin session. It reads the request's own cookie value, so it can run in the request
 * gate before any page starts to render.
 */
export function adminSessionValid(token: string | undefined): boolean {
  if (!token) return false;
  const row = db().prepare("SELECT s.expires_at FROM sessions s JOIN admins a ON a.id = s.user_id WHERE s.token_hash = ? AND s.kind = 'admin'").get(sha(token)) as { expires_at: number } | undefined;
  return !!row && row.expires_at >= Math.floor(Date.now() / 1000);
}

export async function destroySession(kind: SessionKind) {
  const store = await cookies();
  const token = store.get(COOKIE[kind])?.value;
  if (token) db().prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha(token));
  store.delete(COOKIE[kind]);
}

/** After a password change: signs out every other device of this user and keeps the current one. */
export async function revokeOtherSessions(kind: SessionKind, userId: string) {
  const token = (await cookies()).get(COOKIE[kind])?.value;
  db().prepare("DELETE FROM sessions WHERE kind = ? AND user_id = ? AND token_hash != ?").run(kind, userId, token ? sha(token) : "");
}

export type Customer = { id: string; email: string; name: string; phone: string; avatar: string; birthday: string; city: string };

export async function getCustomer(): Promise<Customer | null> {
  const id = await currentUserId("customer");
  if (!id) return null;
  return (db().prepare("SELECT id,email,name,phone,avatar,birthday,city FROM customers WHERE id = ?").get(id) as Customer | undefined) ?? null;
}

export async function getAdmin(): Promise<{ id: string; email: string } | null> {
  const id = await currentUserId("admin");
  if (!id) return null;
  return (db().prepare("SELECT id,email FROM admins WHERE id = ?").get(id) as { id: string; email: string } | undefined) ?? null;
}
