"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type SavedAddress = { id: string; label: string; name: string; phone: string; line1: string; city: string; country: string };
export type User = { id: string; email: string; name: string; phone: string; avatar: string; birthday: string; city: string; addresses: SavedAddress[] };
type Result = { ok: true } | { ok: false; error: "invalid_credentials" | "exists" | "too_many" | "invalid" | "network" | "wrong_password" };

type Ctx = {
  ready: boolean;
  user: User | null;
  wishlist: string[];
  login: (email: string, password: string, remember?: boolean) => Promise<Result>;
  register: (name: string, email: string, password: string, phone?: string) => Promise<Result>;
  updateProfile: (p: { name: string; phone: string; birthday: string; city: string; email: string; currentPassword?: string }) => Promise<Result>;
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
  return { ok: false, error: e === "invalid_credentials" || e === "exists" || e === "too_many" || e === "wrong_password" ? e : "invalid" };
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

  const saveWishlist = (list: string[]) => {
    try {
      window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  };

  // When a customer signs in: merge favourites saved on the server with this browser's, and keep both in step.
  const uid = user?.id ?? null;
  const prevUid = useRef<string | null>(null);
  const synced = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (uid && synced.current !== uid) {
      synced.current = uid;
      fetch("/api/account/sync")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d) return;
          setWishlist((local) => {
            const merged = Array.from(new Set([...(d.wishlist as string[]), ...local]));
            saveWishlist(merged);
            if (merged.length !== (d.wishlist as string[]).length) {
              void fetch("/api/account/sync", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ wishlist: merged }) });
            }
            return merged;
          });
        })
        .catch(() => undefined);
    }
    if (!uid && prevUid.current) {
      // Signed out: don't leave her favourites behind on a shared device.
      synced.current = null;
       
      setWishlist([]);
      saveWishlist([]);
    }
    prevUid.current = uid;
  }, [uid, ready]);

  const value = useMemo<Ctx>(
    () => ({
      ready, user, wishlist, refresh,
      login: async (email, password, remember = true) => {
        try {
          const r = await toResult(await post("/api/account/login", { email, password, remember }));
          if (r.ok) await refresh();
          return r;
        } catch {
          return { ok: false, error: "network" };
        }
      },
      register: async (name, email, password, phone) => {
        try {
          const r = await toResult(await post("/api/account/register", { name, email, password, phone: phone ?? "" }));
          if (r.ok) await refresh();
          return r;
        } catch {
          return { ok: false, error: "network" };
        }
      },
      updateProfile: async (p) => {
        try {
          const res = await fetch("/api/account/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(p) });
          const r = await toResult(res);
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
          saveWishlist(next);
          if (uid) void fetch("/api/account/sync", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ wishlist: next }) });
          return next;
        }),
    }),
    [ready, user, wishlist, refresh, uid],
  );

  return <AccountCtx.Provider value={value}>{children}</AccountCtx.Provider>;
}

export function useAccount(): Ctx {
  const ctx = useContext(AccountCtx);
  if (!ctx) throw new Error("useAccount must be used inside AccountProvider");
  return ctx;
}
