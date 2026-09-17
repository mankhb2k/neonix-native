import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";
import { getSupabaseCookieOptions } from "./cookie-options";

export async function createSupabaseServerClient() {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(env.url, env.publishableKey, {
    cookieOptions: getSupabaseCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, {
            ...options,
            ...getSupabaseCookieOptions(),
          }),
          );
        } catch {
          // Server Components cannot always set cookies. The middleware
          // refreshes the session and owns the response cookie writes.
        }
      },
    },
  });
}

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}
