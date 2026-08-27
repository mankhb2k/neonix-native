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
};

export async function GET() {
  const result = await getAssetRequestContext();
  if (!result.ok) return jsonError(result.message, result.status);

  const { supabase, workspaceId } = result.context;
  const { data, error } = await supabase
    .from("assets")
    .select("id, original_filename, mime_type, byte_size, status, storage_bucket, r2_key, created_at")
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
      return { ...asset, download_url: downloadUrl };
    }),
  );

  return Response.json({ assets });
}

export async function POST(request: Request) {
  const result = await getAssetRequestContext();
  if (!result.ok) return jsonError(result.message, result.status);

  let body: { name?: unknown; size?: unknown; mimeType?: unknown };
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

  const assetId = randomUUID();
  const provider = getUserAssetsProvider();
  const storageKey = provider.createObjectKey(`asset.${assetId}`, mimeType);
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
  });

  if (sessionError) {
    await supabase.from("assets").delete().eq("id", assetId);
    return jsonError(sessionError.message, 400);
  }

  try {
    const signed = await provider.presignPut(storageKey, mimeType, 15 * 60);
    return Response.json({
      assetId,
      uploadUrl: signed.url,
      method: "PUT",
      headers: signed.headers,
      expiresAt: signed.expiresAt.toISOString(),
    });
  } catch (error) {
    await supabase.from("upload_sessions").delete().eq("asset_id", assetId);
    await supabase.from("assets").delete().eq("id", assetId);
    return jsonError(error instanceof Error ? error.message : "Unable to connect to R2", 500);
  }
}
