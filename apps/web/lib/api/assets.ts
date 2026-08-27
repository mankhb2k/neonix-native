export type Asset = {
  id: string;
  original_filename: string | null;
  mime_type: string;
  byte_size: number;
  status: "uploading" | "ready" | "failed" | "deleting" | "deleted";
  created_at: string;
  download_url: string | null;
};

export type UploadSession = {
  assetId: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
};

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function listAssets(): Promise<Asset[]> {
  const response = await fetch("/api/assets", { cache: "no-store" });
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { assets: Asset[] };
  return body.assets;
}

export async function createAssetUpload(file: File): Promise<UploadSession> {
  const response = await fetch("/api/assets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, mimeType: file.type || "application/octet-stream" }),
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as UploadSession;
}

export async function uploadAssetBytes(session: UploadSession, file: File): Promise<void> {
  const response = await fetch(session.uploadUrl, {
    method: session.method,
    headers: session.headers,
    body: file,
  });
  if (!response.ok) throw new Error(`R2 upload failed (${response.status})`);
}

export async function completeAssetUpload(assetId: string): Promise<void> {
  const response = await fetch("/api/assets/upload/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ assetId }),
  });
  if (!response.ok) throw new Error(await readError(response));
}

export async function deleteAsset(assetId: string): Promise<void> {
  const response = await fetch(`/api/assets/${encodeURIComponent(assetId)}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await readError(response));
}

