import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = { title: "لوحة تحكم Litore", robots: { index: false, follow: false } };

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
