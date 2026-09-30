export type AvatarResponse = {
  avatarPath: string | null;
  avatarUrl: string | null;
  avatarUpdatedAt?: string;
};

export async function uploadAvatar(file: File): Promise<AvatarResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiFetch("/v1/profile/avatar", { method: "POST", body: formData });
  const body: unknown = await response.json();
  if (!response.ok) throw new Error(getErrorMessage(body, "Unable to upload your avatar."));

  if (!isRecord(body) || typeof body.avatarUrl !== "string" || typeof body.avatarPath !== "string") {
    throw new Error("Avatar upload response is invalid.");
  }

  return {
    avatarPath: body.avatarPath,
    avatarUrl: body.avatarUrl,
    avatarUpdatedAt: typeof body.avatarUpdatedAt === "string" ? body.avatarUpdatedAt : undefined,
  };
}

export async function removeAvatar(): Promise<AvatarResponse> {
  const response = await apiFetch("/v1/profile/avatar", { method: "DELETE" });
  const body: unknown = await response.json();
  if (!response.ok) throw new Error(getErrorMessage(body, "Unable to remove your avatar."));

  if (!isRecord(body) || (body.avatarUrl !== null && typeof body.avatarUrl !== "string")) {
    throw new Error("Avatar removal response is invalid.");
  }

  return { avatarPath: null, avatarUrl: body.avatarUrl };
}

function getErrorMessage(body: unknown, fallback: string): string {
  if (!isRecord(body) || !isRecord(body.error) || typeof body.error.message !== "string") return fallback;
  return body.error.message;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
import { apiFetch } from "./client";
