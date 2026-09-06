/* Supabase's schema client is intentionally untyped in this repository. */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { createHash } from "node:crypto";
import { getAssetRequestContext, jsonError } from "@/lib/server/asset-context";
import { getUserAssetsProvider } from "@/lib/server/r2";
import { MotionProtocolV2Schema, type MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";

export const runtime = "nodejs";

const NOTO_SANS: MotionProtocolV2["assets"][number] = {
  id: "font-noto-sans-regular",
  kind: "font",
  uri: "/preview/font/Noto_Sans/NotoSans-Regular.ttf",
  weight: 400,
  integrity: "sha256:fe8c022f48d8dd29f17b744d16f9346f4357e16f7d4f7be58b000ae7c291b614",
};

function replaceFont(document: MotionProtocolV2, assetId: string, familyName: string): MotionProtocolV2 {
  const customId = `asset-${assetId}`;
  const next = structuredClone(document);
  if (!next.assets.some((asset) => asset.id === NOTO_SANS.id)) next.assets.push(NOTO_SANS);
  for (const layer of next.layers) {
    if (layer.type !== "text") continue;
    for (const chunk of layer.payload.chunks) {
      for (const span of chunk.spans) {
        const usesFont = span.resolvedFontAssetIds?.includes(customId) || span.font.families.includes(familyName);
        if (!usesFont) continue;
        span.resolvedFontAssetIds = [NOTO_SANS.id];
        span.font = { ...span.font, families: ["Noto Sans", ...span.font.families.filter((family) => family !== familyName)] };
      }
    }
  }
  next.assets = next.assets.filter((asset) => asset.id !== customId);
  return MotionProtocolV2Schema.parse(next);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ fontId: string }> }) {
  const result = await getAssetRequestContext();
  if (!result.ok) return jsonError(result.message, result.status);
  const { fontId } = await params;
  const { supabase, user, workspaceId } = result.context;
  const { data: faceValue, error: faceError } = await supabase.from("user_font_faces").select("id,asset_id,font_family_id").or(`id.eq.${fontId},asset_id.eq.${fontId}`).maybeSingle();
  if (faceError) return jsonError(faceError.message, 500);
  const face = faceValue;
  if (!face) return jsonError("Font not found", 404);
  const { data: familyValue } = await supabase.from("user_font_families").select("id,family_name").eq("id", face.font_family_id).eq("workspace_id", workspaceId).maybeSingle();
  const family = familyValue;
  if (!family) return jsonError("Font family not found", 404);
  const { data: assetValue } = await supabase.from("assets").select("id,r2_key").eq("id", face.asset_id).eq("workspace_id", workspaceId).eq("created_by", user.id).is("deleted_at", null).maybeSingle();
  const asset = assetValue;
  if (!asset) return jsonError("Font asset not found", 404);

  const { data: projects, error: projectsError } = await supabase.from("projects").select("id").eq("workspace_id", workspaceId).is("deleted_at", null);
  if (projectsError) return jsonError(projectsError.message, 500);
  let replacedProjects = 0;
  for (const projectValue of (projects ?? []) as unknown as Array<{ id: string }>) {
    const { data: revisionValue } = await supabase.from("project_revisions").select("id,revision_no,document_json").eq("project_id", projectValue.id).order("revision_no", { ascending: false }).limit(1).maybeSingle();
    const revision = revisionValue;
    if (!revision) continue;
    const parsed = MotionProtocolV2Schema.safeParse(revision.document_json);
    if (!parsed.success || !parsed.data.assets.some((candidate) => candidate.id === `asset-${asset.id}`)) continue;
    const replacement = replaceFont(parsed.data, asset.id, family.family_name);
    const documentJson = replacement as unknown as Record<string, unknown>;
    const { error: insertError } = await supabase.from("project_revisions").insert({
      project_id: projectValue.id,
      revision_no: revision.revision_no + 1,
      document_json: documentJson,
      content_hash: createHash("sha256").update(JSON.stringify(documentJson)).digest("hex"),
      source_schema_version: replacement.formatVersion,
      reason: "asset_replacement",
      byte_size: Buffer.byteLength(JSON.stringify(documentJson), "utf8"),
      created_by: user.id,
    });
    if (insertError) return jsonError(insertError.message, 500);
    await supabase.from("project_font_families").delete().eq("project_id", projectValue.id).eq("font_family_id", family.id);
    replacedProjects += 1;
  }

  await supabase.from("project_font_families").delete().eq("font_family_id", family.id);
  await supabase.from("user_font_faces").delete().eq("id", face.id);
  await supabase.from("user_font_families").delete().eq("id", family.id);
  await supabase.from("upload_sessions").delete().eq("asset_id", asset.id);
  await supabase.from("assets").update({ status: "deleted", deleted_at: new Date().toISOString() }).eq("id", asset.id).eq("workspace_id", workspaceId);
  await getUserAssetsProvider().deleteObject(asset.r2_key).catch(() => undefined);
  return Response.json({ deleted: true, replacedProjects });
}
