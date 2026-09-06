/* Supabase's schema client is intentionally untyped in this repository. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { createHash } from "node:crypto";
import { getAssetRequestContext, jsonError } from "@/lib/server/asset-context";
import { formatFromFilename, parseUserFont } from "@/lib/server/font-metadata";
import { getUserAssetsProvider } from "@/lib/server/r2";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const result = await getAssetRequestContext();
  if (!result.ok) return jsonError(result.message, result.status);
  let body: { assetId?: unknown };
  try { body = await request.json() as typeof body; } catch { return jsonError("Invalid JSON body"); }
  const assetId = typeof body.assetId === "string" ? body.assetId : "";
  if (!assetId) return jsonError("assetId is required");

  const { supabase, user, workspaceId } = result.context;
  const { data: assetData, error: assetError } = await supabase.from("assets").select("id,r2_key,mime_type,byte_size,status,original_filename").eq("id", assetId).eq("workspace_id", workspaceId).eq("created_by", user.id).eq("kind", "font").maybeSingle();
  if (assetError) return jsonError(assetError.message, 500);
  const asset = assetData;
  if (!asset) return jsonError("Font upload not found", 404);
  if (asset.status === "ready") return jsonError("Font upload is already complete", 409);
  if (asset.status !== "uploading" || typeof asset.r2_key !== "string") return jsonError("Font is not uploadable", 409);

  const provider = getUserAssetsProvider();
  const head = await provider.headObject(asset.r2_key);
  if (!head) return jsonError("The font has not finished uploading to R2", 400);
  if (head.sizeBytes !== asset.byte_size) return jsonError("Uploaded font size does not match the declared size", 400);
  const fileName = asset.original_filename ?? "";
  const format = formatFromFilename(fileName);
  if (!format) return jsonError("Only static .ttf, .woff, and .woff2 files are supported", 400);

  const buffer = await provider.getObject(asset.r2_key);
  if (!buffer) return jsonError("Unable to read uploaded font", 502);
  const hash = createHash("sha256").update(buffer).digest("hex");
  const contentHash = `sha256:${hash}`;
  const metadata = (() => { try { return parseUserFont(buffer); } catch (error) { return error instanceof Error ? error : new Error("Invalid font"); } })();
  if (metadata instanceof Error) {
    await provider.deleteObject(asset.r2_key).catch(() => undefined);
    await supabase.from("upload_sessions").delete().eq("asset_id", assetId);
    await supabase.from("assets").delete().eq("id", assetId);
    return jsonError(metadata.message, 400);
  }

  const { data: sameHash } = await supabase.from("assets").select("id").eq("workspace_id", workspaceId).eq("kind", "font").eq("content_hash", contentHash).is("deleted_at", null).eq("status", "ready").neq("id", assetId).maybeSingle();
  if (sameHash) return rejectDuplicate(provider, supabase, assetId, asset.r2_key, "This font file already exists (same content)");

  let { data: family } = await supabase.from("user_font_families").select("id,family_name").eq("workspace_id", workspaceId).ilike("family_name", metadata.familyName).maybeSingle();
  if (!family) {
    const slug = `${metadata.familyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70)}-${assetId.slice(0, 8)}`;
    const familyInsert = await supabase.from("user_font_families").insert({ workspace_id: workspaceId, created_by: user.id, slug, family_name: metadata.familyName, metadata_json: {} }).select("id,family_name").single();
    if (familyInsert.error) return rejectDuplicate(provider, supabase, assetId, asset.r2_key, familyInsert.error.code === "23505" ? "A font family with this name already exists" : familyInsert.error.message, familyInsert.error.code === "23505" ? 409 : 400);
    family = familyInsert.data;
  }

  const { data: sameFace } = await supabase.from("user_font_faces").select("id").eq("font_family_id", family.id).eq("face_key", metadata.faceKey).maybeSingle();
  if (sameFace) return rejectDuplicate(provider, supabase, assetId, asset.r2_key, "A font with this family, weight, and style already exists");

  const { error: updateError } = await supabase.from("assets").update({ status: "ready", content_hash: contentHash, mime_type: `font/${format}`, metadata_json: { familyName: metadata.familyName, subfamilyName: metadata.subfamilyName, weight: metadata.weight, style: metadata.style } }).eq("id", assetId).eq("workspace_id", workspaceId);
  if (updateError) return jsonError(updateError.message, 400);
  const { error: faceError } = await supabase.from("user_font_faces").insert({ font_family_id: family.id, asset_id: assetId, face_key: metadata.faceKey, version: metadata.version, weight: metadata.weight, style: metadata.style, width_class: metadata.widthClass, format, subfamily_name: metadata.subfamilyName, postscript_name: metadata.postscriptName, axes_json: metadata.axes, metadata_json: {} });
  if (faceError) return rejectDuplicate(provider, supabase, assetId, asset.r2_key, faceError.code === "23505" ? "A font with this family, weight, and style already exists" : faceError.message, faceError.code === "23505" ? 409 : 400);
  await supabase.from("upload_sessions").update({ status: "completed", completed_at: new Date().toISOString() }).eq("asset_id", assetId).eq("created_by", user.id);

  return Response.json({ font: { id: `custom:${metadata.faceKey}:${assetId}`, source: "custom", familyName: metadata.familyName, subfamilyName: metadata.subfamilyName, weight: metadata.weight, style: metadata.style, format, fontAssetId: `asset-${assetId}`, assetId, filename: fileName, byteSize: asset.byte_size, uri: `/api/assets/${encodeURIComponent(assetId)}/media`, integrity: contentHash } });
}

async function rejectDuplicate(provider: ReturnType<typeof getUserAssetsProvider>, supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, assetId: string, key: string, message: string, status = 409): Promise<Response> {
  await provider.deleteObject(key).catch(() => undefined);
  await supabase.from("upload_sessions").delete().eq("asset_id", assetId);
  await supabase.from("assets").delete().eq("id", assetId);
  return jsonError(message, status);
}
