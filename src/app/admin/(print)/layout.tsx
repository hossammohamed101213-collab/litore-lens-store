import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Pages made to be printed. They sit outside the panel frame on purpose: with no header, bars or backgrounds around
 * them the printed page holds the labels and nothing else, which is what keeps printing the same on every browser.
 */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  if (!(await getAdmin())) redirect("/admin/login");
  return <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>;
}
