// Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='long-password' node scripts/create-admin.mjs
import Database from "better-sqlite3";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "";
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 10 characters).");
  process.exit(1);
}
const file = path.resolve(process.env.DATABASE_PATH ?? "./data/litore.db");
fs.mkdirSync(path.dirname(file), { recursive: true });
const db = new Database(file);
db.exec(`CREATE TABLE IF NOT EXISTS admins (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
const salt = randomBytes(16);
const hash = `scrypt$${salt.toString("base64")}$${scryptSync(password, salt, 64).toString("base64")}`;
db.prepare(`INSERT INTO admins(id,email,password_hash) VALUES (?,?,?)
  ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash`).run(randomUUID(), email, hash);
console.log(`Admin ready: ${email}`);
