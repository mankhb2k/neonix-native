export type Asset = {
  id: string;
  original_filename: string | null;
  mime_type: string;
  byte_size: number;
  status: "uploading" | "ready" | "failed" | "deleting" | "deleted";
  created_at: string;
  download_url: string | null;
  preview_key?: string | null;
  preview_status?: "pending" | "ready" | "failed" | "unsupported" | null;
  preview_version?: number | null;
  preview_url?: string | null;
  source_duration_ms?: number | null;
  source_width?: number | null;
  source_height?: number | null;
  has_audio?: boolean | null;
  preview_error?: string | null;
};

export type AssetUsageProject = {
  id: string;
  title: string;
  publicRef: string;
};

export type UploadPreview = {
  size: number;
  mimeType: "image/webp";
  width: number;
  height: number;
  durationMs?: number;
};

export type UploadSession = {
  assetId: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  previewUploadUrl?: string;
  previewHeaders?: Record<string, string>;
  previewKey?: string;
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
  const response = await apiFetch("/v1/assets", { cache: "no-store" });
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { assets: Asset[] };
  return body.assets;
}

export async function createAssetUpload(file: File, preview?: UploadPreview): Promise<UploadSession> {
  const response = await apiFetch("/v1/assets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      preview: preview
        ? {
            size: preview.size,
            mimeType: preview.mimeType,
            width: preview.width,
            height: preview.height,
            durationMs: preview.durationMs,
          }
        : undefined,
    }),
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

export async function uploadAssetPreview(session: UploadSession, preview: Blob): Promise<void> {
  if (!session.previewUploadUrl) return;
  const response = await fetch(session.previewUploadUrl, {
    method: "PUT",
    headers: session.previewHeaders ?? { "content-type": "image/webp" },
    body: preview,
  });
  if (!response.ok) throw new Error(`R2 preview upload failed (${response.status})`);
}

export async function getAssetUsage(assetId: string): Promise<AssetUsageProject[]> {
  const response = await apiFetch(`/v1/assets/${encodeURIComponent(assetId)}/usage`, { cache: "no-store" });
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { projects?: AssetUsageProject[] };
  return Array.isArray(body.projects) ? body.projects : [];
}

export async function completeAssetUpload(assetId: string): Promise<void> {
  const response = await apiFetch("/v1/assets/upload/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ assetId }),
  });
  if (!response.ok) throw new Error(await readError(response));
}

export async function deleteAsset(assetId: string, options?: { replaceReferences?: boolean }): Promise<void> {
  const response = await apiFetch(`/v1/assets/${encodeURIComponent(assetId)}`, {
    method: "DELETE",
    ...(options ? {
      headers: { "content-type": "application/json" },
      body: JSON.stringify(options),
    } : {}),
  });
  if (!response.ok) throw new Error(await readError(response));
}
import { apiFetch } from "./client";
