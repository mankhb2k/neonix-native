import "server-only";

import { createPolar } from "@polar-sh/sdk/2027-01";

export type PolarEnvironment = "sandbox" | "production";

function resolveEnvironment(): PolarEnvironment {
  const raw = process.env.POLAR_ENVIRONMENT?.trim().toLowerCase();
  return raw === "production" ? "production" : "sandbox";
}

let cached: ReturnType<typeof createPolar> | null = null;

export function getPolarClient() {
  if (cached) return cached;
  const accessToken = process.env.POLAR_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    throw new Error("Missing POLAR_ACCESS_TOKEN");
  }
  cached = createPolar({ accessToken, environment: resolveEnvironment() });
  return cached;
}

export function getTopupProductId(): string {
  const productId = process.env.POLAR_TOPUP_PRODUCT_ID?.trim();
  if (!productId) {
    throw new Error("Missing POLAR_TOPUP_PRODUCT_ID");
  }
  return productId;
}
