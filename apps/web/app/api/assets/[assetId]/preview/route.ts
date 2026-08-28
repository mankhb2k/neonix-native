import { getAssetRequestContext, jsonError } from "@/lib/server/asset-context";
import { getUserAssetsProvider } from "@/lib/server/r2";

export const runtime = "nodejs";

const MAX_POSTER_BYTES = 5 * 1024 * 1024;

type PreviewAsset = {
  id: string;
  preview_key: string | null;
  preview_status?: string;
  mime_type?: string;
  status?: string;
};

function isPreviewAsset(value: unknown): value is PreviewAsset {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string"
    && (record.preview_key === null || typeof record.preview_key === "string")
    && (record.preview_status === undefined || typeof record.preview_status === "string")
    && (record.mime_type === undefined || typeof record.mime_type === "string")
    && (record.status === undefined || typeof record.status === "string");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const result = await getAssetRequestContext();
  if (!result.ok) return jsonError(result.message, result.status);

  const { assetId } = await params;
  const { supabase, workspaceId } = result.context;
  const { data, error } = await supabase
    .from("assets")
    .select("id, preview_key, preview_status")
    .eq("id", assetId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!isPreviewAsset(data)) return jsonError("Asset not found", 404);
  const asset = data;
  if (asset.preview_status !== "ready" || typeof asset.preview_key !== "string") {
    return jsonError("Asset preview is not ready", 409);
  }

  const signed = await getUserAssetsProvider().presignGet(asset.preview_key, 10 * 60);
  return Response.json({
    assetId,
    url: signed.url,
    expiresAt: signed.expiresAt.toISOString(),
  });
}

/** Persist a browser-generated poster for assets uploaded before poster support. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const result = await getAssetRequestContext();
  if (!result.ok) return jsonError(result.message, result.status);

  const { assetId } = await params;
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim();
  const contentLength = Number(request.headers.get("content-length"));
  if (contentType !== "image/webp") return jsonError("Poster must use image/webp", 415);
  if (Number.isFinite(contentLength) && contentLength > MAX_POSTER_BYTES) {
    return jsonError("Poster exceeds the 5 MB limit", 413);
  }

  const { supabase, workspaceId } = result.context;
  const { data, error } = await supabase
    .from("assets")
    .select("id, mime_type, status, preview_key")
    .eq("id", assetId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  const rawAsset: unknown = data;
  if (!isPreviewAsset(rawAsset) || typeof rawAsset.mime_type !== "string" || typeof rawAsset.status !== "string") {
    return jsonError("Asset not found", 404);
  }
  const asset = rawAsset;
  const mimeType = asset.mime_type;
  const status = asset.status;
  if (status !== "ready") return jsonError("Asset is not ready", 409);
  if (!mimeType || !mimeType.startsWith("video/")) return jsonError("Only video posters are supported", 415);

  const body = Buffer.from(await request.arrayBuffer());
  if (body.byteLength === 0) return jsonError("Poster body is empty");
  if (body.byteLength > MAX_POSTER_BYTES) return jsonError("Poster exceeds the 5 MB limit", 413);

  const previewKey = asset.preview_key ?? `assets/${asset.id}/preview/poster.webp`;
  try {
    await getUserAssetsProvider().putObject({ key: previewKey, body, contentType: "image/webp" });
  } catch (uploadError) {
    return jsonError(uploadError instanceof Error ? uploadError.message : "Unable to store poster", 500);
  }

  const { error: updateError } = await supabase
    .from("assets")
    .update({
      preview_key: previewKey,
      preview_status: "ready",
      preview_version: 3,
      preview_error: null,
    })
    .eq("id", asset.id)
    .eq("workspace_id", workspaceId);

  if (updateError) return jsonError(updateError.message, 500);
  return Response.json({ assetId: asset.id, previewKey, previewStatus: "ready" });
}
