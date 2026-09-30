export type StorageUsage = {
  usedBytes: number;
  quotaBytes: number;
  usedPercent: number;
};

export async function getStorageUsage(): Promise<StorageUsage | null> {
  try {
    const response = await apiFetch("/v1/account/storage", {
      cache: "no-store",
    });
    if (!response.ok) return null;

    const body: unknown = await response.json();
    if (!isRecord(body)) return null;

    const usedBytes = body.usedBytes;
    const quotaBytes = body.quotaBytes;
    const usedPercent = body.usedPercent;
    if (
      typeof usedBytes !== "number" ||
      typeof quotaBytes !== "number" ||
      typeof usedPercent !== "number"
    ) {
      return null;
    }

    return { usedBytes, quotaBytes, usedPercent };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
import { apiFetch } from "./client";
