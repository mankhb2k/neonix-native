import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * The dashboard and editor live on sibling subdomains in production.
 * Sharing the auth cookie at the parent domain lets a session created on
 * neonix.video be read by app.neonix.video.
 */
export function getSupabaseCookieOptions(): CookieOptionsWithName | undefined {
  if (process.env.NODE_ENV !== "production") return undefined;
  return {
    domain: ".neonix.video",
    path: "/",
    sameSite: "lax",
    secure: true,
  };
}
