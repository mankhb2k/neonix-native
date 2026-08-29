import { randomUUID } from "node:crypto";
import {
  assetKindForMime,
  getAssetRequestContext,
  jsonError,
  userAssetsBucketName,
} from "@/lib/server/asset-context";
import { getUserAssetsProvider } from "@/lib/server/r2";

export const runtime = "nodejs";

type AssetRow = {
  id: string;
  original_filename: string | null;
  mime_type: string;
  byte_size: number;
  status: "uploading" | "ready";
  storage_bucket: string;
  r2_key: string;
  created_at: string;
  preview_key: string | null;
  preview_status: "pending" | "ready" | "failed" | "unsupported" | null;
  preview_version: number | null;
  source_duration_ms: number | null;
  source_width: number | null;
  source_height: number | null;
  has_audio: boolean | null;
};

export async function GET() {
  const result = await getAssetRequestContext();
  if (!result.ok) return jsonError(result.message, result.status);

  const { supabase, workspaceId } = result.context;
  const { data, error } = await supabase
    .from("assets")
    .select("id, original_filename, mime_type, byte_size, status, storage_bucket, r2_key, created_at, preview_key, preview_status, preview_version, source_duration_ms, source_width, source_height, has_audio")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .in("status", ["uploading", "ready"])
    .order("created_at", { ascending: false });

  if (error) return jsonError(error.message, 500);

  const provider = getUserAssetsProvider();
  const assets = await Promise.all(
    ((data ?? []) as unknown as AssetRow[]).map(async (asset) => {
      let downloadUrl: string | null = null;
      if (asset.status === "ready") {
        const signed = await provider.presignGet(asset.r2_key, 10 * 60);
        downloadUrl = signed.url;
      }
      const previewUrl = asset.preview_key && asset.preview_status === "ready"
        ? (await provider.presignGet(asset.preview_key, 10 * 60)).url
        : null;
      return { ...asset, download_url: downloadUrl, preview_url: previewUrl };
    }),
  );

  return Response.json({ assets });
}

export async function POST(request: Request) {
  const result = await getAssetRequestContext();
  if (!result.ok) return jsonError(result.message, result.status);

  let body: {
    name?: unknown;
    size?: unknown;
    mimeType?: unknown;
    preview?: {
      size?: unknown;
      mimeType?: unknown;
      width?: unknown;
      height?: unknown;
      durationMs?: unknown;
    } | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Invalid JSON body");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const mimeType = typeof body.mimeType === "string" ? body.mimeType.trim() : "";
  const size = typeof body.size === "number" ? body.size : Number(body.size);

  if (!name || !mimeType || !Number.isSafeInteger(size) || size <= 0) {
    return jsonError("File name, MIME type, and size are required");
  }
  if (size > result.context.maxUploadBytes) {
    return jsonError(
      `File exceeds the ${Math.floor(result.context.maxUploadBytes / (1024 * 1024))} MB upload limit`,
      413,
    );
  }

  const previewBody = body.preview;
  const optionalNumber = (value: unknown): number | undefined => {
    if (value === undefined || value === null || value === "") return undefined;
    return typeof value === "number" ? value : Number(value);
  };
  const previewSize = optionalNumber(previewBody?.size);
  const previewWidth = optionalNumber(previewBody?.width);
  const previewHeight = optionalNumber(previewBody?.height);
  const previewDurationMs = optionalNumber(previewBody?.durationMs);
  const hasPreview = Boolean(previewBody);
  if (hasPreview && (
    !Number.isSafeInteger(previewSize) || previewSize! <= 0 || previewSize! > 5 * 1024 * 1024
    || previewBody?.mimeType !== "image/webp"
    || !Number.isSafeInteger(previewWidth) || previewWidth! <= 0
    || !Number.isSafeInteger(previewHeight) || previewHeight! <= 0
    || (previewDurationMs !== undefined && (!Number.isFinite(previewDurationMs) || previewDurationMs < 0))
  )) {
    return jsonError("Preview metadata is invalid");
  }
  const validatedPreviewSize = hasPreview ? previewSize! : null;
  const validatedPreviewWidth = hasPreview ? previewWidth! : null;
  const validatedPreviewHeight = hasPreview ? previewHeight! : null;

  const assetId = randomUUID();
  const provider = getUserAssetsProvider();
  const storageKey = provider.createObjectKey(assetId, mimeType);
  const previewKey = hasPreview ? `assets/${assetId}/preview/poster.webp` : null;
  const bucket = userAssetsBucketName();
  const now = new Date().toISOString();
  const { supabase, user, workspaceId } = result.context;

  const { error: assetError } = await supabase.from("assets").insert({
    id: assetId,
    workspace_id: workspaceId,
    r2_key: storageKey,
    content_hash: `pending:${assetId}`,
    mime_type: mimeType,
    byte_size: size,
    created_by: user.id,
    kind: assetKindForMime(mimeType),
    status: "uploading",
    storage_bucket: bucket,
    original_filename: name,
    metadata_json: {},
    preview_key: previewKey,
    preview_status: hasPreview ? "pending" : "unsupported",
    source_duration_ms: hasPreview && Number.isFinite(previewDurationMs!) ? Math.round(previewDurationMs!) : null,
    source_width: validatedPreviewWidth,
    source_height: validatedPreviewHeight,
    has_audio: null,
    preview_version: hasPreview ? 3 : null,
    created_at: now,
  });

  if (assetError) return jsonError(assetError.message, 400);

  const { error: sessionError } = await supabase.from("upload_sessions").insert({
    workspace_id: workspaceId,
    asset_id: assetId,
    created_by: user.id,
    status: "pending",
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    expected_byte_size: size,
    expected_mime_type: mimeType,
    expected_preview_byte_size: validatedPreviewSize,
    expected_preview_mime_type: hasPreview ? "image/webp" : null,
    preview_key: previewKey,
  });

  if (sessionError) {
    await supabase.from("assets").delete().eq("id", assetId);
    return jsonError(sessionError.message, 400);
  }

  try {
    const signed = await provider.presignPut(storageKey, mimeType, 15 * 60);
    const previewSigned = previewKey
      ? await provider.presignPut(previewKey, "image/webp", 15 * 60)
      : null;
    return Response.json({
      assetId,
      uploadUrl: signed.url,
      method: "PUT",
      headers: signed.headers,
      expiresAt: signed.expiresAt.toISOString(),
      previewUploadUrl: previewSigned?.url,
      previewHeaders: previewSigned?.headers,
      previewKey,
    });
  } catch (error) {
    await supabase.from("upload_sessions").delete().eq("asset_id", assetId);
    await supabase.from("assets").delete().eq("id", assetId);
    return jsonError(error instanceof Error ? error.message : "Unable to connect to R2", 500);
  }
}
