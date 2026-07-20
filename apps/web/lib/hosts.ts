export const MARKETING_HOSTS = new Set([
  "motionvideo.com",
  "www.motionvideo.com",
]);

export const APP_HOSTS = new Set(["app.motionvideo.com"]);

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

/** Path prefix for product routes in the Next.js tree (always `/app`). */
export const APP_ROUTE_PREFIX = "/app";

/**
 * Public base path for links:
 * - local / marketing host: `/app`
 * - app subdomain: `` (root of subdomain)
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

export function appUrl(path = "/"): string {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000/app"
  ).replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  if (p === "/") return base;
  return `${base}${p}`;
}
