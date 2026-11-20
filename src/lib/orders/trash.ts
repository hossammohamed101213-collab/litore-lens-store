import { db } from "@/lib/db";
import { orderDeletable } from "@/lib/db/admin";

/** A deleted order can be brought back for this long; after that it is removed for good. */
export const TRASH_HOURS = 48;
const TTL = TRASH_HOURS * 3600;
const now = () => Math.floor(Date.now() / 1000);

type Row = Record<string, unknown>;
export type TrashedOrder = { id: string; deletedAt: number; hoursLeft: number; email: string; total: number; currency: string; status: string; paymentStatus: string; createdAt: string };

/** Column names come from the database itself, never from the stored copy, so a restore can only write real columns. */
const columns = (table: string) => (db().prepare(`SELECT name FROM pragma_table_info(?)`).all(table) as { name: string }[]).map((c) => c.name);

function insertRow(table: "orders" | "order_lines" | "returns", row: Row) {
  const cols = columns(table).filter((c) => c in row);
  db().prepare(`INSERT INTO ${table} (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${cols.map(() => "?").join(",")})`).run(...cols.map((c) => row[c] as never));
}

/**
 * Moves orders to the deleted list. Paid and refunded orders are financial records and are never moved: they come back
 * in `skipped`. An order still holding stock (new / being prepared) gives it back, exactly as deleting always did.
 */
export function trashOrders(ids: string[], by = ""): { moved: string[]; skipped: string[] } {
  const c = db(); const moved: string[] = []; const skipped: string[] = [];
  const unique = [...new Set(ids.map((i) => i.trim()).filter(Boolean))].slice(0, 500);
  c.transaction(() => {
    for (const id of unique) {
      const o = c.prepare("SELECT * FROM orders WHERE id = ?").get(id) as Row | undefined;
      if (!o) continue;
      if (!orderDeletable(o as { payment_status: string; is_mock: number })) { skipped.push(id); continue; }
      const lines = c.prepare("SELECT * FROM order_lines WHERE order_id = ?").all(id) as Row[];
      const returns = c.prepare("SELECT * FROM returns WHERE order_id = ?").all(id) as Row[];
      const holding = o.status === "new" || o.status === "processing";
      if (holding) { const up = c.prepare("UPDATE variants SET stock = stock + ? WHERE id = ?"); for (const l of lines) up.run(l.quantity as number, l.variant_id as string); }
      c.prepare(`INSERT OR REPLACE INTO deleted_orders (id, deleted_at, deleted_by, email, total_minor, currency, status, payment_status, created_at, stock_returned, order_json, lines_json, returns_json)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, now(), by.slice(0, 120), String(o.email ?? ""), Number(o.total_minor ?? 0), String(o.currency ?? "AED"), String(o.status ?? ""), String(o.payment_status ?? ""),
        String(o.created_at ?? ""), holding ? 1 : 0, JSON.stringify(o), JSON.stringify(lines), JSON.stringify(returns));
      c.prepare("DELETE FROM orders WHERE id = ?").run(id);
      moved.push(id);
    }
  })();
  return { moved, skipped };
}

/**
 * Puts a deleted order back exactly as it was. If deleting it gave stock back, the same pieces are taken again; when
 * they have been sold meanwhile nothing is restored (the whole step is undone) and the reason is returned.
 */
export function restoreOrderSafe(id: string): { ok: true } | { ok: false; reason: "gone" | "exists" | "stock" } {
  const c = db();
  const t = c.prepare("SELECT * FROM deleted_orders WHERE id = ? AND deleted_at >= ?").get(id, now() - TTL) as { order_json: string; lines_json: string; returns_json: string; stock_returned: number } | undefined;
  if (!t) return { ok: false, reason: "gone" };
  if (c.prepare("SELECT 1 FROM orders WHERE id = ?").get(id)) return { ok: false, reason: "exists" };
  const order = JSON.parse(t.order_json) as Row; const lines = JSON.parse(t.lines_json) as Row[]; const returns = JSON.parse(t.returns_json) as Row[];
  try {
    c.transaction(() => {
      if (t.stock_returned === 1) {
        const take = c.prepare("UPDATE variants SET stock = stock - ? WHERE id = ? AND stock >= ?");
        for (const l of lines) if (take.run(l.quantity as number, l.variant_id as string, l.quantity as number).changes !== 1) throw new Error("stock");
      }
      insertRow("orders", order);
      for (const l of lines) insertRow("order_lines", l);
      for (const r of returns) insertRow("returns", r);
      c.prepare("DELETE FROM deleted_orders WHERE id = ?").run(id);
    })();
  } catch (e) { if (e instanceof Error && e.message === "stock") return { ok: false, reason: "stock" }; throw e; }
  return { ok: true };
}

/** Removes for good what has waited longer than 48 hours. Called by the background timer and whenever the list is opened. */
export function purgeTrash(): number {
  return db().prepare("DELETE FROM deleted_orders WHERE deleted_at < ?").run(now() - TTL).changes;
}

export function listTrash(): TrashedOrder[] {
  purgeTrash();
  const rows = db().prepare("SELECT id, deleted_at, email, total_minor, currency, status, payment_status, created_at FROM deleted_orders ORDER BY deleted_at DESC").all() as
    { id: string; deleted_at: number; email: string; total_minor: number; currency: string; status: string; payment_status: string; created_at: string }[];
  return rows.map((r) => ({ id: r.id, deletedAt: r.deleted_at, hoursLeft: Math.max(0, Math.ceil((r.deleted_at + TTL - now()) / 3600)), email: r.email, total: r.total_minor / 100, currency: r.currency, status: r.status, paymentStatus: r.payment_status, createdAt: r.created_at }));
}

export const trashCount = () => (db().prepare("SELECT COUNT(*) n FROM deleted_orders WHERE deleted_at >= ?").get(now() - TTL) as { n: number }).n;
