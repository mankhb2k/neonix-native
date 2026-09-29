import { webhooks } from "@polar-sh/sdk/2027-01";
import { NextResponse } from "next/server";
import { creditWalletFromPolarOrder } from "@/lib/server/billing/wallet";
import { createSupabaseAdminClient } from "@/lib/server/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.POLAR_WEBHOOK_SECRET?.trim();
  if (!secret) {
    // eslint-disable-next-line no-console
    console.error("[webhooks/polar] POLAR_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  }

  // Signature verification needs the exact bytes Polar signed - never
  // request.json() first, that would re-serialize the body and break it.
  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers);

  let event;
  try {
    event = await webhooks.validateEvent(rawBody, headers, secret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 403 });
  }

  if (event.type !== "order.paid") {
    return NextResponse.json({ received: true });
  }

  const order = event.data;
  const userId = order.metadata?.userId;
  if (typeof userId !== "string" || !userId) {
    // eslint-disable-next-line no-console
    console.error("[webhooks/polar] order.paid missing metadata.userId", { orderId: order.id });
    return NextResponse.json({ error: "missing_user_metadata" }, { status: 200 });
  }

  const admin = createSupabaseAdminClient();
  try {
    await creditWalletFromPolarOrder(admin, {
      userId,
      amountCents: order.total_amount,
      currency: order.currency,
      orderId: order.id,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[webhooks/polar] failed to credit wallet", error);
    return NextResponse.json({ error: "ledger_write_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
