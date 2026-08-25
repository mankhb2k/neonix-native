import { NextResponse, type NextRequest } from "next/server";
import {
  APP_ROUTE_PREFIX,
  getHostname,
  isAppHost,
  isLocalHost,
  isMarketingHost,
} from "./lib/hosts";
import { updateSupabaseSession } from "./lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const hostname = getHostname(request.headers.get("host"));
  const { pathname } = request.nextUrl;
  let response: NextResponse;

  // API and docs stay on this host (no /app rewrite)
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/docs") ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/oauth/")
  ) {
    response = NextResponse.next();
    return updateSupabaseSession(request, response);
  }

  // app.motionvideo.com → rewrite into /app/*
  if (isAppHost(hostname)) {
    // Prefer clean URLs on subdomain (no /app prefix in the address bar)
    if (
      pathname === APP_ROUTE_PREFIX ||
      pathname.startsWith(`${APP_ROUTE_PREFIX}/`)
    ) {
      const url = request.nextUrl.clone();
      url.pathname =
        pathname === APP_ROUTE_PREFIX
          ? "/"
          : pathname.slice(APP_ROUTE_PREFIX.length) || "/";
      response = NextResponse.redirect(url);
      return updateSupabaseSession(request, response);
    }

    const url = request.nextUrl.clone();
    url.pathname =
      pathname === "/" ? APP_ROUTE_PREFIX : `${APP_ROUTE_PREFIX}${pathname}`;
    response = NextResponse.rewrite(url);
    return updateSupabaseSession(request, response);
  }

  // motionvideo.com/app → redirect to app subdomain
  if (isMarketingHost(hostname) && !isLocalHost(hostname)) {
    if (
      pathname === APP_ROUTE_PREFIX ||
      pathname.startsWith(`${APP_ROUTE_PREFIX}/`)
    ) {
      const appOrigin =
        process.env.NEXT_PUBLIC_APP_URL ?? "https://app.motionvideo.com";
      const dest = new URL(appOrigin);
      const suffix =
        pathname === APP_ROUTE_PREFIX
          ? "/"
          : pathname.slice(APP_ROUTE_PREFIX.length) || "/";
      dest.pathname = suffix;
      dest.search = request.nextUrl.search;
      response = NextResponse.redirect(dest);
      return updateSupabaseSession(request, response);
    }
  }

  // localhost:3000 → / landing, /app product (no rewrite)
  response = NextResponse.next();
  return updateSupabaseSession(request, response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
