import "server-only";

/**
 * Best-effort client IP for rate-limiting public, unauthenticated endpoints.
 * Not meant to be spoof-proof (a caller can forge these headers when there is
 * no trusted reverse proxy in front of the app) - it only needs to make
 * casual abuse from a single source expensive to work around, not resist a
 * determined attacker.
 */
export function clientIpForRateLimit(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}
