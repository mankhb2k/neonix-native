import { apiFetch } from "./client";

export type CurrentAccount = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

export async function getCurrentAccount(): Promise<CurrentAccount | null> {
  try {
    const response = await apiFetch("/api/auth/get-session", { cache: "no-store" });
    if (!response.ok) return null;

    const body: unknown = await response.json();
    if (!isRecord(body) || !isRecord(body.user)) return null;

    const user = body.user;
    if (
      typeof user.id !== "string" ||
      typeof user.name !== "string" ||
      typeof user.email !== "string"
    ) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: typeof user.image === "string" ? user.image : null,
    };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
