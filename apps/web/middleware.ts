import { NextResponse, type NextRequest } from "next/server";
import {
  APP_ROUTE_PREFIX,
  getHostname,
  isAppHost,
  isLocalHost,
  isMarketingHost,
} from "./lib/hosts";

export function middleware(request: NextRequest) {
  const hostname = getHostname(request.headers.get("host"));
  const { pathname } = request.nextUrl;

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
      return NextResponse.redirect(url);
    }

    const url = request.nextUrl.clone();
    url.pathname =
      pathname === "/" ? APP_ROUTE_PREFIX : `${APP_ROUTE_PREFIX}${pathname}`;
    return NextResponse.rewrite(url);
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
      return NextResponse.redirect(dest);
    }
  }

  // localhost:3000 → / landing, /app product (no rewrite)
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
