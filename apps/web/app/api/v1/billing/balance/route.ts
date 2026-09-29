import { NextResponse } from "next/server";
import { getWalletBalanceCents } from "@/lib/server/billing/wallet";
import { createSupabaseAdminClient } from "@/lib/server/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let sessionClient;
  try {
    sessionClient = await createSupabaseServerClient();
  } catch {
    return NextResponse.json({ error: { message: "Supabase is not configured" } }, { status: 503 });
  }

  const {
    data: { user },
    error: userError,
  } = await sessionClient.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: { message: "Authentication required" } }, { status: 401 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const balanceCents = await getWalletBalanceCents(admin, user.id);
    return NextResponse.json({ balanceCents, balanceUsd: balanceCents / 100 });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[billing/balance] failed to load balance", error);
    return NextResponse.json({ error: { message: "Unable to load balance" } }, { status: 500 });
  }
}
