"use client";
import { useEffect, useRef } from "react";
import { storeCredential } from "./SaveCredential";

/** Put inside a plain login <form>: when it is submitted, hand the typed login to the browser so it offers to save it. */
export function SaveLoginOnSubmit({ userField = "email", passField = "password" }: { userField?: string; passField?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const onSubmit = () => {
      const u = (form.elements.namedItem(userField) as HTMLInputElement | null)?.value.trim();
      const p = (form.elements.namedItem(passField) as HTMLInputElement | null)?.value;
      if (u && p) void storeCredential(u, p);
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [userField, passField]);
  return <span ref={ref} hidden />;
}
