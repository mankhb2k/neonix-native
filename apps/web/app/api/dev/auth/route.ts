import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  if (process.env.NODE_ENV === "production" || process.env.DEV_DEMO_AUTH !== "1") {
    return new Response(null, { status: 404 });
  }

  const email = process.env.DEV_DEMO_EMAIL?.trim().toLowerCase();
  const password = process.env.DEV_DEMO_PASSWORD;
  if (!email || !password) {
    return Response.json(
      { error: { message: "Development demo credentials are not configured" } },
      { status: 503 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email?.toLowerCase() === email) return Response.json({ signedIn: false });
  if (user) await supabase.auth.signOut();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return Response.json(
      { error: { message: "Unable to sign in the development demo account" } },
      { status: 401 },
    );
  }

  return Response.json({ signedIn: true });
}
