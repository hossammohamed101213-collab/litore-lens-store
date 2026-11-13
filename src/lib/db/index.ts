import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA } from "./schema";
import { seedSampleData } from "./seed";

type DB = Database.Database;
const g = globalThis as unknown as { __litoreDb?: DB };

/** Where uploaded product images live (outside the build, so they persist). */
export const uploadDir = () => path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./data/uploads");

export function db(): DB {
  if (g.__litoreDb) return g.__litoreDb;
  const configured = process.env.DATABASE_PATH ?? "./data/litore.db";
  const file = configured === ":memory:" ? configured : path.resolve(/*turbopackIgnore: true*/ configured);
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const conn = new Database(file);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  conn.exec(SCHEMA);
  g.__litoreDb = conn;
  if (process.env.SEED_SAMPLE === "true") seedSampleData(conn);
  return conn;
}

export const toMinor = (n: number) => Math.round(n * 100);
export const fromMinor = (n: number) => n / 100;

export function getSetting(key: string, fallback = ""): string {
  const row = db().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? fallback;
}

export function setSetting(key: string, value: string) {
  db().prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, value);
}
