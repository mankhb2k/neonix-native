import { getAssetRequestContext, jsonError } from "@/lib/server/asset-context";
import { getUserAssetsProvider } from "@/lib/server/r2";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const result = await getAssetRequestContext();
  if (!result.ok) return jsonError(result.message, result.status);

  let body: { assetId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Invalid JSON body");
  }

  const assetId = typeof body.assetId === "string" ? body.assetId : "";
  if (!assetId) return jsonError("assetId is required");

  const { supabase, user, workspaceId } = result.context;
  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, r2_key, mime_type, byte_size, status, original_filename, preview_key, preview_status, preview_version")
    .eq("id", assetId)
    .eq("workspace_id", workspaceId)
    .eq("created_by", user.id)
    .maybeSingle();

  if (assetError) return jsonError(assetError.message, 500);
  const assetRow = asset;
  if (!assetRow) return jsonError("Asset not found", 404);
  if (assetRow.status === "ready") {
    return Response.json({ asset: assetRow });
  }
  if (assetRow.status !== "uploading") return jsonError("Asset is not uploadable", 409);
  const storageKey = typeof assetRow.r2_key === "string" ? assetRow.r2_key : null;
  if (!storageKey) return jsonError("Asset storage key is invalid", 500);

  const provider = getUserAssetsProvider();
  const head = await provider.headObject(storageKey);
  if (!head) return jsonError("The file has not finished uploading to R2", 400);
  if (head.sizeBytes !== assetRow.byte_size) {
    return jsonError("Uploaded file size does not match the declared size", 400);
  }
  if (head.contentType && head.contentType !== assetRow.mime_type) {
    return jsonError("Uploaded content type does not match the declared type", 400);
  }

  const { data: uploadSession, error: uploadSessionReadError } = await supabase
    .from("upload_sessions")
    .select("expected_preview_byte_size, expected_preview_mime_type")
    .eq("asset_id", assetId)
    .eq("created_by", user.id)
    .maybeSingle();
  if (uploadSessionReadError) return jsonError(uploadSessionReadError.message, 500);

  let previewReady = false;
  let previewError: string | null = null;
  const previewKey = typeof assetRow.preview_key === "string" ? assetRow.preview_key : null;
  if (previewKey) {
    const previewHead = await provider.headObject(previewKey);
    if (previewHead?.sizeBytes && previewHead.sizeBytes > 0) {
      if (uploadSession?.expected_preview_byte_size && previewHead.sizeBytes !== uploadSession.expected_preview_byte_size) {
        previewError = "Uploaded preview size does not match the declared size";
      } else if (uploadSession?.expected_preview_mime_type && previewHead.contentType
        && previewHead.contentType !== uploadSession.expected_preview_mime_type) {
        previewError = "Uploaded preview content type does not match the declared type";
      } else if (previewHead.contentType && previewHead.contentType !== "image/webp") {
        previewError = "Uploaded preview content type does not match image/webp";
      } else {
        previewReady = true;
      }
    } else {
      previewError = "Preview poster was not uploaded";
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("assets")
    .update({
      status: "ready",
      content_hash: `r2:${head.sizeBytes}:${storageKey}`,
      preview_status: previewReady ? "ready" : previewKey ? "failed" : "unsupported",
      preview_error: previewError,
    })
    .eq("id", assetId)
    .eq("workspace_id", workspaceId)
    .select("id, original_filename, mime_type, byte_size, status, storage_bucket, r2_key, created_at, preview_key, preview_status, preview_version, source_duration_ms, source_width, source_height, has_audio")
    .single();

  if (updateError) return jsonError(updateError.message, 400);

  if (previewError) {
    // Server logs make failed browser poster generation observable without
    // exposing storage credentials or returning internal R2 details.
    // eslint-disable-next-line no-console
    console.warn("[assets] poster preview failed", {
      assetId,
      previewKey,
      reason: previewError,
    });
  }

  const { error: sessionError } = await supabase
    .from("upload_sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("asset_id", assetId)
    .eq("created_by", user.id);

  if (sessionError) return jsonError(sessionError.message, 500);
  return Response.json({ asset: updated });
}
