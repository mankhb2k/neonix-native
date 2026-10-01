import { NextResponse, type NextRequest } from "next/server";
import {
  APP_ROUTE_PREFIX,
  getHostname,
  isAppHost,
  isLocalHost,
  isMarketingHost,
} from "./lib/hosts";

function workspaceOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://app.neonix.video";
}

function controlOrigin(): string {
  return process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://www.neonix.video";
}

function redirectTo(
  request: NextRequest,
  origin: string,
  pathname: string,
): NextResponse {
  const destination = new URL(origin);
  destination.pathname = pathname;
  destination.search = request.nextUrl.search;
  return NextResponse.redirect(destination);
}

function isWorkspaceRoute(pathname: string): boolean {
  return pathname.startsWith("/editor/") || pathname.startsWith("/preview/");
}

function workspaceRouteOrigin(pathname: string): string {
  return pathname.startsWith("/preview/") ? controlOrigin() : workspaceOrigin();
}

function removeInternalWorkspacePrefix(pathname: string): string {
  if (pathname === APP_ROUTE_PREFIX) return "/";
  return pathname.slice(APP_ROUTE_PREFIX.length) || "/";
}

export async function middleware(request: NextRequest) {
  const hostname = getHostname(request.headers.get("host"));
  const { pathname } = request.nextUrl;
  let response: NextResponse;

  // API routes belong to apps/api, never to a UI host.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // API, authentication, and docs do not belong to either UI shell.
  if (
    pathname.startsWith("/docs") ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/oauth/") ||
    // MCP OAuth sign-in/consent pages: apps/api redirects here (on whichever
    // host WEB_APP_URL points to) and the signed query must reach the page
    // untouched - redirecting to /dashboard would skip the consent step.
    pathname === "/mcp/sign-in" ||
    pathname === "/mcp/consent"
  ) {
    return NextResponse.next();
  }

  // app.neonix.video is the isolated editor/preview workspace. It never hosts
  // billing, settings, or the project dashboard.
  if (isAppHost(hostname)) {
    if (
      pathname === APP_ROUTE_PREFIX ||
      pathname.startsWith(`${APP_ROUTE_PREFIX}/`)
    ) {
      const cleanPath = removeInternalWorkspacePrefix(pathname);
      if (isWorkspaceRoute(cleanPath)) {
        response = redirectTo(request, workspaceRouteOrigin(cleanPath), cleanPath);
      } else {
        response = redirectTo(request, controlOrigin(), "/dashboard");
      }
      return response;
    }

    if (pathname === "/") {
      return redirectTo(request, controlOrigin(), "/dashboard");
    }

    if (isWorkspaceRoute(pathname)) {
      if (pathname.startsWith("/preview/")) {
        return redirectTo(request, controlOrigin(), pathname);
      }
      const url = request.nextUrl.clone();
      url.pathname = `${APP_ROUTE_PREFIX}${pathname}`;
      return NextResponse.rewrite(url);
    }

    return redirectTo(request, controlOrigin(), "/dashboard");
  }

  // Keep old /app editor links working during the domain migration. Control
  // routes move to neonix.video; editor/preview routes move to app.neonix.video.
  if (
    isMarketingHost(hostname) &&
    !isLocalHost(hostname) &&
    (pathname === APP_ROUTE_PREFIX || pathname.startsWith(`${APP_ROUTE_PREFIX}/`))
  ) {
    const cleanPath = removeInternalWorkspacePrefix(pathname);
    if (isWorkspaceRoute(cleanPath)) {
      return redirectTo(request, workspaceRouteOrigin(cleanPath), cleanPath);
    }
    if (cleanPath === "/") {
      return redirectTo(request, controlOrigin(), "/dashboard");
    }
    return redirectTo(request, controlOrigin(), cleanPath);
  }

  // localhost keeps internal /app/editor routes for development. The dashboard
  // itself has moved to /dashboard.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ttf|otf|woff|woff2)$).*)",
  ],
};
