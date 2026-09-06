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
  const response = await fetch("/api/fonts", { cache: "no-store" });
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { fonts: FontOption[] };
  return body.fonts;
}

export async function createFontUpload(file: File): Promise<FontUploadSession> {
  const response = await fetch("/api/fonts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size }),
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as FontUploadSession;
}

export async function completeFontUpload(assetId: string): Promise<FontOption> {
  const response = await fetch("/api/fonts/upload/complete", {
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
  const response = await fetch(`/api/fonts/${encodeURIComponent(fontId)}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await readError(response));
}
