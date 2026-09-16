import { getAssetRequestContext, jsonError } from "@/lib/server/asset-context";
import { MEDIA_PIPELINE_VERSION } from "@/lib/server/media/worker";
import { getUserAssetsProvider } from "@/lib/server/r2";

export const runtime = "nodejs";

type UploadAssetRow = {
  id: string;
  r2_key: string | null;
  mime_type: string;
  byte_size: number;
  status: string;
  original_filename: string | null;
  preview_key: string | null;
  preview_status: string | null;
  media_status: string | null;
  preview_version: number | null;
};

type MediaJobRow = {
  id: string;
  status: string;
  started_at: string | null;
  attempt_count: number;
};

function asUploadAssetRow(value: unknown): UploadAssetRow | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string"
    && (record.r2_key === null || typeof record.r2_key === "string")
    && typeof record.mime_type === "string"
    && typeof record.byte_size === "number"
    && typeof record.status === "string"
    ? value as UploadAssetRow
    : null;
}

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
    .select("id, r2_key, mime_type, byte_size, status, original_filename, preview_key, preview_status, media_status, preview_version")
    .eq("id", assetId)
    .eq("workspace_id", workspaceId)
    .eq("created_by", user.id)
    .maybeSingle();

  if (assetError) return jsonError(assetError.message, 500);
  const assetRow = asUploadAssetRow(asset);
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
  const isVideo = assetRow.mime_type.startsWith("video/");
  const isAudio = assetRow.mime_type.startsWith("audio/");
  const browserPreviewExpected = Number(uploadSession?.expected_preview_byte_size) > 0;
  if (previewKey) {
    if (browserPreviewExpected) {
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
    } else if (!isVideo) {
      previewError = "Preview poster was not uploaded";
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("assets")
    .update({
      status: "ready",
      media_status: isVideo || isAudio ? "queued" : "not_required",
      content_hash: `r2:${head.eTag ?? head.sizeBytes}:${storageKey}`,
      preview_status: previewReady ? "ready" : previewKey ? (isVideo && !browserPreviewExpected ? "pending" : "failed") : "unsupported",
      preview_error: previewError,
    })
    .eq("id", assetId)
    .eq("workspace_id", workspaceId)
    .select("id, original_filename, mime_type, byte_size, status, storage_bucket, r2_key, created_at, preview_key, preview_status, media_status, preview_version, source_duration_ms, source_width, source_height, has_audio")
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

  let mediaJob: MediaJobRow | null = null;
  if (isVideo || isAudio) {
    const sourceIntegrity = `r2:${head.eTag ?? head.sizeBytes}:${storageKey}`;
    const idempotencyKey = `${assetId}:${sourceIntegrity}:v${MEDIA_PIPELINE_VERSION}`;
    const { data: createdJob, error: mediaJobError } = await supabase
      .from("media_jobs")
      .insert({
        workspace_id: workspaceId,
        asset_id: assetId,
        status: "queued",
        media_kind: isVideo ? "video" : "audio",
        idempotency_key: idempotencyKey,
        source_integrity: sourceIntegrity,
        pipeline_version: MEDIA_PIPELINE_VERSION,
      })
      .select("id, status, started_at, attempt_count")
      .single();
    if (mediaJobError) {
      if (mediaJobError.code !== "23505") return jsonError(mediaJobError.message, 500);
      const { data: existingJob, error: existingJobError } = await supabase
        .from("media_jobs")
        .select("id, status, started_at, attempt_count")
        .eq("asset_id", assetId)
        .maybeSingle();
      if (existingJobError || !existingJob) return jsonError(existingJobError?.message ?? "Media job not found", 500);
      mediaJob = existingJob;
    } else {
      mediaJob = createdJob;
    }

  }

  return Response.json({ asset: updated, ...(mediaJob ? { mediaJob } : {}) });
}
