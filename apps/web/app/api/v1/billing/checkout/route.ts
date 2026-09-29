import { NextResponse } from "next/server";
import { getPolarClient, getTopupProductId } from "@/lib/server/billing/polar-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_TOPUP_USD = 1;
const MAX_TOPUP_USD = 2000;

export async function POST(request: Request) {
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

  let amountUsd: number;
  try {
    const body: unknown = await request.json();
    const raw = body && typeof body === "object" ? (body as Record<string, unknown>).amountUsd : undefined;
    amountUsd = Number(raw);
  } catch {
    return NextResponse.json({ error: { message: "Invalid request body" } }, { status: 400 });
  }

  if (!Number.isFinite(amountUsd) || amountUsd < MIN_TOPUP_USD || amountUsd > MAX_TOPUP_USD) {
    return NextResponse.json(
      { error: { message: `amountUsd must be between ${MIN_TOPUP_USD} and ${MAX_TOPUP_USD}` } },
      { status: 400 },
    );
  }

  const amountCents = Math.round(amountUsd * 100);
  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

  try {
    const polar = getPolarClient();
    const checkout = await polar.checkouts.create({
      products: [getTopupProductId()],
      amount: amountCents,
      external_customer_id: user.id,
      customer_email: user.email ?? undefined,
      success_url: `${origin}/dashboard/topup?checkout=success`,
      metadata: { userId: user.id, kind: "wallet_topup" },
    });
    return NextResponse.json({ checkoutUrl: checkout.url });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[billing/checkout] failed to create Polar checkout", error);
    return NextResponse.json({ error: { message: "Unable to start checkout" } }, { status: 502 });
  }
}
