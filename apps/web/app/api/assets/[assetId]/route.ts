import { getAssetRequestContext, jsonError } from "@/lib/server/asset-context";
import { getUserAssetsProvider } from "@/lib/server/r2";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const result = await getAssetRequestContext();
  if (!result.ok) return jsonError(result.message, result.status);

  const { assetId } = await params;
  const { supabase, user, workspaceId } = result.context;
  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, r2_key, preview_key, status")
    .eq("id", assetId)
    .eq("workspace_id", workspaceId)
    .eq("created_by", user.id)
    .maybeSingle();

  if (assetError) return jsonError(assetError.message, 500);
  const assetRow = asset;
  if (!assetRow) return jsonError("Asset not found", 404);
  const storageKey = typeof assetRow.r2_key === "string" ? assetRow.r2_key : null;
  if (!storageKey) return jsonError("Asset storage key is invalid", 500);

  let replaceReferences = false;
  if (request.headers.get("content-type")?.includes("application/json")) {
    try {
      const body = (await request.json()) as { replaceReferences?: unknown };
      replaceReferences = body.replaceReferences === true;
    } catch {
      return jsonError("Invalid JSON body");
    }
  }

  const { data: projectLinks, error: projectLinksError } = await supabase
    .from("project_assets")
    .select("project_id")
    .eq("asset_id", assetId);
  if (projectLinksError) return jsonError(projectLinksError.message, 500);
  const projectLinkRows = (projectLinks ?? []) as Array<{ project_id?: unknown }>;
  const projectIds = [...new Set(projectLinkRows.map((link) => link.project_id).filter((id): id is string => typeof id === "string"))];
  if (projectIds.length > 0 && !replaceReferences) {
    return Response.json(
      { error: { message: "Asset is used by one or more projects" }, code: "ASSET_IN_USE", projectIds },
      { status: 409 },
    );
  }

  const { data: variants, error: variantsError } = await supabase
    .from("asset_variants")
    .select("r2_key")
    .eq("asset_id", assetId);
  if (variantsError) return jsonError(variantsError.message, 500);

  try {
    const keys = new Set<string>([
      storageKey,
      ...(typeof assetRow.preview_key === "string" ? [assetRow.preview_key] : []),
      ...((variants ?? []) as Array<{ r2_key?: unknown }>)
        .map((variant) => variant.r2_key)
        .filter((key): key is string => typeof key === "string" && key.length > 0),
    ]);
    const provider = getUserAssetsProvider();
    await Promise.all([...keys].map((key) => provider.deleteObject(key)));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to delete R2 object", 502);
  }

  const deletionResponse = await supabase.rpc(
    "delete_asset_with_system_fallback",
    { target_asset_id: assetId },
  );
  if (deletionResponse.error) return jsonError(deletionResponse.error.message, 500);
  return Response.json({ ok: true, deletion: deletionResponse.data as unknown });
}
