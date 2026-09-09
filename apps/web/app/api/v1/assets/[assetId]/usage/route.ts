import { getAssetRequestContext, jsonError } from "@/lib/server/asset-context";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const result = await getAssetRequestContext();
  if (!result.ok) return jsonError(result.message, result.status);

  const { assetId } = await params;
  const { supabase, user, workspaceId } = result.context;
  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id")
    .eq("id", assetId)
    .eq("workspace_id", workspaceId)
    .eq("created_by", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (assetError) return jsonError(assetError.message, 500);
  if (!asset) return jsonError("Asset not found", 404);

  const { data: links, error: linksError } = await supabase
    .from("project_assets")
    .select("project_id")
    .eq("asset_id", assetId);
  if (linksError) return jsonError(linksError.message, 500);

  const linkRows = (links ?? []) as Array<{ project_id?: unknown }>;
  const projectIds = [...new Set(linkRows.map((link) => link.project_id).filter((id): id is string => typeof id === "string"))];
  if (projectIds.length === 0) return Response.json({ assetId, projects: [] });

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, title, public_ref")
    .in("id", projectIds)
    .is("deleted_at", null)
    .order("title", { ascending: true });
  if (projectsError) return jsonError(projectsError.message, 500);

  const projectRows = (projects ?? []) as Array<{ id: string; title: string; public_ref: string }>;
  return Response.json({
    assetId,
    projects: projectRows.map((project) => ({
      id: project.id,
      title: project.title,
      publicRef: project.public_ref,
    })),
  });
}

