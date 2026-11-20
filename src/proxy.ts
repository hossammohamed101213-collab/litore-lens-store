import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, adminSessionValid } from "@/lib/auth/session";
import { defaultLocale, isLocale } from "@/lib/i18n/config";

/**
 * Two jobs, both before any page starts to render:
 * 1. The admin panel. Every address under /admin except the sign-in page is answered with a bare redirect unless the
 *    request carries a live admin session. The check has to be here: a page and its layout render side by side, so a
 *    redirect thrown by the layout still let the page's own data travel in the body of the redirect answer.
 * 2. Redirect any shop path without a locale prefix to the default locale (Arabic).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname === "/admin/login" || adminSessionValid(request.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login"; url.search = "";
    // A panel form sent after the session ended: the app's own "go to this page" answer, so the browser opens the sign-in
    // page (a plain redirect would leave the button spinning). It carries no page content at all.
    if (request.headers.has("next-action")) return new NextResponse(null, { status: 303, headers: { "x-action-redirect": "/admin/login;replace", "Cache-Control": "no-store" } });
    const res = NextResponse.redirect(url, request.method === "GET" || request.method === "HEAD" ? 307 : 303);
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
  const first = pathname.split("/")[1] ?? "";
  if (isLocale(first)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/((?!_next|api|admin|uploads|brand|fonts|.*\\..*).*)"],
};
