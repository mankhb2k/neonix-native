import { getAssetRequestContext, jsonError } from "@/lib/server/asset-context";
import { getUserAssetsProvider } from "@/lib/server/r2";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
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

  const { error: updateError } = await supabase
    .from("assets")
    .update({ status: "deleted" })
    .eq("id", assetId)
    .eq("workspace_id", workspaceId);

  if (updateError) return jsonError(updateError.message, 400);
  if (variants?.length) {
    const { error: variantsDeleteError } = await supabase
      .from("asset_variants")
      .delete()
      .eq("asset_id", assetId);
    if (variantsDeleteError) return jsonError(variantsDeleteError.message, 500);
  }
  return new Response(null, { status: 204 });
}
