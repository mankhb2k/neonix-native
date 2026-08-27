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
    .select("id, r2_key, mime_type, byte_size, status, original_filename")
    .eq("id", assetId)
    .eq("workspace_id", workspaceId)
    .eq("created_by", user.id)
    .maybeSingle();

  if (assetError) return jsonError(assetError.message, 500);
  const assetRow = asset;
  if (!assetRow) return jsonError("Asset not found", 404);
  if (assetRow.status === "ready") return Response.json({ asset: assetRow });
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

  const { data: updated, error: updateError } = await supabase
    .from("assets")
    .update({
      status: "ready",
      content_hash: `r2:${head.sizeBytes}:${storageKey}`,
    })
    .eq("id", assetId)
    .eq("workspace_id", workspaceId)
    .select("id, original_filename, mime_type, byte_size, status, storage_bucket, r2_key, created_at")
    .single();

  if (updateError) return jsonError(updateError.message, 400);

  const { error: sessionError } = await supabase
    .from("upload_sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("asset_id", assetId)
    .eq("created_by", user.id);

  if (sessionError) return jsonError(sessionError.message, 500);
  return Response.json({ asset: updated });
}
