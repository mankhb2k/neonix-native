import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function getWalletBalanceCents(
  admin: SupabaseClient,
  userId: string,
): Promise<number> {
  const result = await admin.rpc("wallet_balance_cents", { account_id: userId });
  if (result.error) throw new Error(`Unable to load wallet balance: ${result.error.message}`);
  return Number(result.data ?? 0);
}

export async function creditWalletFromPolarOrder(
  admin: SupabaseClient,
  params: {
    userId: string;
    amountCents: number;
    currency: string;
    orderId: string;
  },
): Promise<{ credited: boolean }> {
  const { userId, amountCents, currency, orderId } = params;
  // external_ref carries the Polar order id, which is unique in the schema -
  // a retried webhook delivery hits the conflict below and credits nothing twice.
  const result = await admin.from("wallet_ledger").insert({
    user_id: userId,
    amount_cents: amountCents,
    currency,
    kind: "topup",
    external_ref: orderId,
    metadata: { source: "polar" },
  });

  if (result.error) {
    if (result.error.code === "23505") return { credited: false };
    throw new Error(`Unable to credit wallet: ${result.error.message}`);
  }
  return { credited: true };
}
