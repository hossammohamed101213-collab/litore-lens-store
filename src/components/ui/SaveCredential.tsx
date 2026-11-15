"use client";

/** Asks the browser to offer saving a login (Chrome/Edge/Android). Quietly does nothing where it is not supported. */
export async function storeCredential(id: string, password: string, name?: string) {
  try {
    const PC = (window as unknown as { PasswordCredential?: new (d: { id: string; password: string; name?: string }) => Credential }).PasswordCredential;
    if (PC && navigator.credentials?.store) await navigator.credentials.store(new PC({ id, password, name }));
  } catch {
    /* the browser said no — the normal save prompt still works */
  }
}
