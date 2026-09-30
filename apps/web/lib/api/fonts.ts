import { apiFetch } from "./client";
import { createAssetUpload, type UploadSession } from "./assets";
import { getDefaultWorkspaceId } from "./workspaces";

export type FontOption = {
  id: string;
  source: "system" | "custom";
  familyName: string;
  subfamilyName: string;
  weight: number;
  style: "normal" | "italic" | "oblique";
  format: "ttf" | "woff" | "woff2";
  fontAssetId: string;
  uri: string;
  integrity: string;
  assetId?: string;
  filename?: string;
  byteSize?: number;
};

export type FontUploadSession = {
  assetId: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: string;
};

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function listFonts(): Promise<FontOption[]> {
  const workspaceId = await getDefaultWorkspaceId();
  const response = await apiFetch(`/v1/fonts/families?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: "no-store" });
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { fontFamilies?: Array<{ id: string; familyName: string }> };
  return (body.fontFamilies ?? []).map((family) => ({
    id: `custom:${family.id}`,
    source: "custom" as const,
    familyName: family.familyName,
    subfamilyName: "Regular",
    weight: 400,
    style: "normal" as const,
    format: "ttf" as const,
    fontAssetId: family.id,
    uri: "",
    integrity: "",
  }));
}

export async function createFontUpload(file: File): Promise<FontUploadSession> {
  const session: UploadSession = await createAssetUpload(file);
  return {
    assetId: session.assetId,
    uploadUrl: session.uploadUrl,
    method: session.method,
    headers: session.headers,
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  };
}

export async function completeFontUpload(assetId: string): Promise<FontOption> {
  const response = await apiFetch("/v1/fonts/upload/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ assetId }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { font: FontOption };
  return body.font;
}

export async function uploadFontBytes(session: FontUploadSession, file: File): Promise<void> {
  const response = await fetch(session.uploadUrl, {
    method: session.method,
    headers: session.headers,
    body: file,
  });
  if (!response.ok) throw new Error(`R2 upload failed (${response.status})`);
}

export async function deleteFont(fontId: string): Promise<void> {
  const response = await apiFetch(`/v1/fonts/families/${encodeURIComponent(fontId)}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await readError(response));
}
