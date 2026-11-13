import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export type SessionKind = "customer" | "admin";
const COOKIE = { customer: "litore_session", admin: "litore_admin" } as const;
const TTL_SECONDS = { customer: 60 * 60 * 24 * 30, admin: 60 * 60 * 8 } as const;

const sha = (t: string) => createHash("sha256").update(t).digest("hex");

/** Only a hash of the token is stored, so a leaked database cannot be used to log in. */
export async function createSession(kind: SessionKind, userId: string) {
  const token = randomBytes(32).toString("base64url");
  db().prepare("DELETE FROM sessions WHERE expires_at < ?").run(Math.floor(Date.now() / 1000)); // housekeeping
  const expires = Math.floor(Date.now() / 1000) + TTL_SECONDS[kind];
  db().prepare("INSERT INTO sessions(token_hash,kind,user_id,expires_at) VALUES (?,?,?,?)").run(sha(token), kind, userId, expires);
  (await cookies()).set(COOKIE[kind], token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS[kind],
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

export async function destroySession(kind: SessionKind) {
  const store = await cookies();
  const token = store.get(COOKIE[kind])?.value;
  if (token) db().prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha(token));
  store.delete(COOKIE[kind]);
}

export type Customer = { id: string; email: string; name: string };

export async function getCustomer(): Promise<Customer | null> {
  const id = await currentUserId("customer");
  if (!id) return null;
  return (db().prepare("SELECT id,email,name FROM customers WHERE id = ?").get(id) as Customer | undefined) ?? null;
}

export async function getAdmin(): Promise<{ id: string; email: string } | null> {
  const id = await currentUserId("admin");
  if (!id) return null;
  return (db().prepare("SELECT id,email FROM admins WHERE id = ?").get(id) as { id: string; email: string } | undefined) ?? null;
}
