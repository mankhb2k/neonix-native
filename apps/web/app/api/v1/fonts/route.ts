/* Supabase's schema client is intentionally untyped in this repository. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { randomUUID } from "node:crypto";
import { getAssetRequestContext, jsonError, userAssetsBucketName } from "@/lib/server/asset-context";
import {
  formatFromFilename,
  mimeTypeForFontFormat,
  USER_FONT_FORMATS,
} from "@/lib/server/font-metadata";
import { fontObjectKey, getUserAssetsProvider } from "@/lib/server/r2";

export const runtime = "nodejs";

function integrity(value: unknown): string | null {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/i.test(value) ? value : null;
}

export async function GET() {
  const result = await getAssetRequestContext();
  if (!result.ok) return jsonError(result.message, result.status);
  const { supabase, workspaceId } = result.context;

  const [familiesResult, filesResult, customFamiliesResult] = await Promise.all([
    supabase.schema("system_catalog").from("font_families").select("id,family_name,source").eq("enabled", true).eq("source", "system").order("family_name"),
    supabase.schema("system_catalog").from("font_files").select("id,font_family_id,weight,style,format,content_hash,r2_key,subfamily_name").eq("enabled", true).in("format", [...USER_FONT_FORMATS]),
    supabase.from("user_font_families").select("id,family_name").eq("workspace_id", workspaceId).eq("enabled", true).order("family_name"),
  ]);
  if (familiesResult.error) return jsonError(familiesResult.error.message, 500);
  if (filesResult.error) return jsonError(filesResult.error.message, 500);
  if (customFamiliesResult.error) return jsonError(customFamiliesResult.error.message, 500);

  const systemFamilies = new Map((familiesResult.data ?? []).map((row) => [row.id, row]));
  const systemFonts = (filesResult.data ?? []).flatMap((row) => {
    const file = row;
    const family = systemFamilies.get(file.font_family_id);
    const hash = integrity(file.content_hash);
    if (!family || !hash) return [];
    return [{
      id: `system:${file.id}`,
      source: "system" as const,
      familyName: family.family_name,
      subfamilyName: file.subfamily_name ?? "Regular",
      weight: file.weight,
      style: file.style,
      format: file.format,
      fontAssetId: `system-font-${file.id}`,
      uri: `/api/v1/system-fonts/${encodeURIComponent(file.id)}`,
      integrity: hash,
    }];
  });

  const customFamilies = (customFamiliesResult.data ?? []) as unknown as Array<{ id: string; family_name: string }>;
  const familyIds = customFamilies.map((family) => family.id);
  const facesResult = familyIds.length > 0
    ? await supabase.from("user_font_faces").select("id,font_family_id,asset_id,weight,style,format,subfamily_name").in("font_family_id", familyIds).eq("enabled", true)
    : { data: [], error: null };
  if (facesResult.error) return jsonError(facesResult.error.message, 500);
  const assetIds = (facesResult.data ?? []).map((face) => face.asset_id);
  const assetsResult = assetIds.length > 0
    ? await supabase.from("assets").select("id,original_filename,byte_size,content_hash").in("id", assetIds).eq("workspace_id", workspaceId).eq("kind", "font").eq("status", "ready").is("deleted_at", null)
    : { data: [], error: null };
  if (assetsResult.error) return jsonError(assetsResult.error.message, 500);
  const familiesById = new Map(customFamilies.map((family) => [family.id, family.family_name]));
  const assetsById = new Map((assetsResult.data ?? []).map((asset) => [asset.id, asset]));
  const customFonts = (facesResult.data ?? []).flatMap((row) => {
    const face = row;
    const asset = assetsById.get(face.asset_id);
    const familyName = familiesById.get(face.font_family_id);
    const hash = integrity(asset?.content_hash);
    if (!asset || !familyName || !hash) return [];
    return [{
      id: `custom:${face.id}`,
      source: "custom" as const,
      familyName,
      subfamilyName: face.subfamily_name ?? "Regular",
      weight: face.weight,
      style: face.style,
      format: face.format,
      fontAssetId: `asset-${face.asset_id}`,
      assetId: face.asset_id,
      filename: asset.original_filename ?? undefined,
      byteSize: asset.byte_size,
      uri: `/api/v1/assets/${encodeURIComponent(face.asset_id)}/media`,
      integrity: hash,
    }];
  });

  return Response.json({ fonts: [...systemFonts, ...customFonts].sort((a, b) => a.familyName.localeCompare(b.familyName) || a.weight - b.weight || a.style.localeCompare(b.style)) });
}

export async function POST(request: Request) {
  const result = await getAssetRequestContext();
  if (!result.ok) return jsonError(result.message, result.status);
  let body: { name?: unknown; size?: unknown };
  try { body = await request.json() as typeof body; } catch { return jsonError("Invalid JSON body"); }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const size = typeof body.size === "number" ? body.size : Number(body.size);
  const format = formatFromFilename(name);
  if (!name || !format || !Number.isSafeInteger(size) || size <= 0) {
    return jsonError("Only static .ttf, .woff, and .woff2 files are supported");
  }
  if (size > result.context.maxUploadBytes) return jsonError("Font exceeds the upload limit", 413);

  const { supabase, user, workspaceId } = result.context;
  const { data: duplicateName } = await supabase.from("assets").select("id").eq("workspace_id", workspaceId).eq("kind", "font").ilike("original_filename", name).is("deleted_at", null).in("status", ["uploading", "ready"]).maybeSingle();
  if (duplicateName) return jsonError("A font with this filename already exists", 409);

  const assetId = randomUUID();
  const mimeType = mimeTypeForFontFormat(format);
  const storageKey = fontObjectKey(workspaceId, assetId, format);
  const { error: assetError } = await supabase.from("assets").insert({
    id: assetId,
    workspace_id: workspaceId,
    r2_key: storageKey,
    content_hash: `pending:${assetId}`,
    mime_type: mimeType,
    byte_size: size,
    created_by: user.id,
    kind: "font",
    status: "uploading",
    storage_bucket: userAssetsBucketName(),
    original_filename: name,
    metadata_json: {},
    preview_status: "unsupported",
    created_at: new Date().toISOString(),
  });
  if (assetError) return jsonError(assetError.code === "23505" ? "A font with this filename already exists" : assetError.message, assetError.code === "23505" ? 409 : 400);

  const { error: sessionError } = await supabase.from("upload_sessions").insert({ workspace_id: workspaceId, asset_id: assetId, created_by: user.id, status: "pending", expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), expected_byte_size: size, expected_mime_type: mimeType });
  if (sessionError) { await supabase.from("assets").delete().eq("id", assetId); return jsonError(sessionError.message, 400); }
  try {
    const signed = await getUserAssetsProvider().presignPut(storageKey, mimeType, 15 * 60);
    return Response.json({ assetId, uploadUrl: signed.url, method: "PUT", headers: signed.headers, expiresAt: signed.expiresAt.toISOString() });
  } catch (error) {
    await supabase.from("upload_sessions").delete().eq("asset_id", assetId);
    await supabase.from("assets").delete().eq("id", assetId);
    return jsonError(error instanceof Error ? error.message : "Unable to connect to R2", 500);
  }
}

