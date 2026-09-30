export type WalletBalance = {
  balanceCents: number;
  balanceUsd: number;
};

export async function getWalletBalance(): Promise<WalletBalance | null> {
  try {
    const response = await apiFetch("/v1/billing/balance", { cache: "no-store" });
    if (!response.ok) return null;

    const body: unknown = await response.json();
    if (!isRecord(body)) return null;

    const balanceCents = body.balanceCents;
    const balanceUsd = body.balanceUsd;
    if (typeof balanceCents !== "number" || typeof balanceUsd !== "number") return null;

    return { balanceCents, balanceUsd };
  } catch {
    return null;
  }
}

export async function createTopupCheckout(amountUsd: number): Promise<{ checkoutUrl: string } | null> {
  try {
    const response = await apiFetch("/v1/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountUsd }),
    });
    if (!response.ok) return null;

    const body: unknown = await response.json();
    if (!isRecord(body) || typeof body.checkoutUrl !== "string") return null;

    return { checkoutUrl: body.checkoutUrl };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
import { apiFetch } from "./client";
