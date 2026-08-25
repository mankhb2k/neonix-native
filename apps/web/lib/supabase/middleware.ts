import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";

export async function updateSupabaseSession(
  request: NextRequest,
  response: NextResponse,
) {
  const env = getSupabaseEnv();
  if (!env) return response;

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // getClaims validates the JWT and refreshes an expired session when needed.
  await supabase.auth.getClaims();
  return response;
}
