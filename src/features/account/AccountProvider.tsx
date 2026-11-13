"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type SavedAddress = { id: string; label: string; name: string; phone: string; line1: string; city: string; country: string };
export type User = { id: string; email: string; name: string; addresses: SavedAddress[] };
type Result = { ok: true } | { ok: false; error: "invalid_credentials" | "exists" | "too_many" | "invalid" | "network" };

type Ctx = {
  ready: boolean;
  user: User | null;
  wishlist: string[];
  login: (email: string, password: string) => Promise<Result>;
  register: (name: string, email: string, password: string) => Promise<Result>;
  logout: () => Promise<void>;
  addAddress: (a: Omit<SavedAddress, "id">) => Promise<void>;
  removeAddress: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  toggleWishlist: (productId: string) => void;
};

const AccountCtx = createContext<Ctx | null>(null);
const WISHLIST_KEY = "litore.wishlist.v1";

const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function toResult(res: Response): Promise<Result> {
  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => ({}));
  const e = data.error;
  return { ok: false, error: e === "invalid_credentials" || e === "exists" || e === "too_many" ? e : "invalid" };
}

/** Real accounts: the session lives in an httpOnly cookie managed by the server. Wishlist stays in this browser. */
export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [wishlist, setWishlist] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    try {
      const d = await fetch("/api/account/me").then((r) => r.json());
      setUser(d.user ?? null);
    } catch {
      setUser(null);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    try {
      const raw = window.localStorage.getItem(WISHLIST_KEY);
      if (raw) setWishlist(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, [refresh]);

  const value = useMemo<Ctx>(
    () => ({
      ready, user, wishlist, refresh,
      login: async (email, password) => {
        try {
          const r = await toResult(await post("/api/account/login", { email, password }));
          if (r.ok) await refresh();
          return r;
        } catch {
          return { ok: false, error: "network" };
        }
      },
      register: async (name, email, password) => {
        try {
          const r = await toResult(await post("/api/account/register", { name, email, password }));
          if (r.ok) await refresh();
          return r;
        } catch {
          return { ok: false, error: "network" };
        }
      },
      logout: async () => {
        await post("/api/account/logout", {});
        setUser(null);
      },
      addAddress: async (a) => {
        await post("/api/account/addresses", a);
        await refresh();
      },
      removeAddress: async (id) => {
        await fetch(`/api/account/addresses?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        await refresh();
      },
      toggleWishlist: (pid) =>
        setWishlist((prev) => {
          const next = prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid];
          try {
            window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(next));
          } catch {
            /* ignore */
          }
          return next;
        }),
    }),
    [ready, user, wishlist, refresh],
  );

  return <AccountCtx.Provider value={value}>{children}</AccountCtx.Provider>;
}

export function useAccount(): Ctx {
  const ctx = useContext(AccountCtx);
  if (!ctx) throw new Error("useAccount must be used inside AccountProvider");
  return ctx;
}
