import { NextResponse, type NextRequest } from "next/server";
import {
  APP_ROUTE_PREFIX,
  getHostname,
  isAppHost,
  isLocalHost,
  isMarketingHost,
} from "./lib/hosts";
import { updateSupabaseSession } from "./lib/supabase/middleware";

function workspaceOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://app.neonix.video";
}

function controlOrigin(): string {
  return process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://neonix.video";
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

  // MCP uses bearer authentication at the route itself. Keep the endpoint and
  // protected-resource metadata out of cookie session refresh and host rewrites.
  if (
    pathname === "/api/mcp" ||
    pathname.startsWith("/.well-known/oauth-protected-resource")
  ) {
    return NextResponse.next();
  }

  // API, authentication, and docs do not belong to either UI shell.
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
      return updateSupabaseSession(request, response);
    }

    if (pathname === "/") {
      response = redirectTo(request, controlOrigin(), "/dashboard");
      return updateSupabaseSession(request, response);
    }

    if (isWorkspaceRoute(pathname)) {
      if (pathname.startsWith("/preview/")) {
        response = redirectTo(request, controlOrigin(), pathname);
        return updateSupabaseSession(request, response);
      }
      const url = request.nextUrl.clone();
      url.pathname = `${APP_ROUTE_PREFIX}${pathname}`;
      response = NextResponse.rewrite(url);
      return updateSupabaseSession(request, response);
    }

    response = redirectTo(request, controlOrigin(), "/dashboard");
    return updateSupabaseSession(request, response);
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
      response = redirectTo(request, workspaceRouteOrigin(cleanPath), cleanPath);
    } else if (cleanPath === "/") {
      response = redirectTo(request, controlOrigin(), "/dashboard");
    } else {
      response = redirectTo(request, controlOrigin(), cleanPath);
    }
    return updateSupabaseSession(request, response);
  }

  // localhost keeps internal /app/editor routes for development. The dashboard
  // itself has moved to /dashboard.
  response = NextResponse.next();
  return updateSupabaseSession(request, response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ttf|otf|woff|woff2)$).*)",
  ],
};
