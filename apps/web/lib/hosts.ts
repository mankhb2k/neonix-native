export const MARKETING_HOSTS = new Set([
  "neonix.video",
  "www.neonix.video",
]);

export const APP_HOSTS = new Set(["app.neonix.video"]);

export function getHostname(hostHeader: string | null): string {
  return (hostHeader ?? "").split(":")[0]?.toLowerCase() ?? "";
}

export function isAppHost(hostname: string): boolean {
  return APP_HOSTS.has(hostname) || hostname.startsWith("app.");
}

export function isMarketingHost(hostname: string): boolean {
  return MARKETING_HOSTS.has(hostname) || hostname === "www.localhost";
}

export function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local")
  );
}

/** Internal route prefix for workspace pages in the Next.js tree. */
export const APP_ROUTE_PREFIX = "/app";

/**
 * Public base path for workspace links:
 * - local development: `/app`
 * - app.neonix.video: `` (root of the workspace subdomain)
 */
export function getPublicAppBasePath(hostname: string): string {
  if (isAppHost(hostname)) return "";
  return APP_ROUTE_PREFIX;
}

export function marketingUrl(path = "/"): string {
  const base = (
    process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return p === "/" ? base : `${base}${p}`;
}

/** URL for the account/control-plane dashboard on the marketing domain. */
export function dashboardUrl(path = "/dashboard"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return marketingUrl(normalized === "/" ? "/dashboard" : normalized);
}

/** URL for the isolated editor/preview workspace. */
export function appUrl(path = "/"): string {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000/app"
  ).replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  if (p === "/") return base;
  return `${base}${p}`;
}
