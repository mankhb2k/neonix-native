import { createSupabaseServerClient } from "@/lib/supabase/server";

export const MAX_ASSET_UPLOAD_BYTES = 500 * 1024 * 1024;

export type AssetRequestContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  user: { id: string };
  workspaceId: string;
  maxUploadBytes: number;
};

export async function getAssetRequestContext(): Promise<
  | { ok: true; context: AssetRequestContext }
  | { ok: false; status: number; message: string }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, status: 401, message: "Authentication required" };
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id")
    .eq("created_by", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const workspaceRow = workspace;
  const workspaceId = typeof workspaceRow?.id === "string" ? workspaceRow.id : null;
  if (workspaceError || !workspaceId) {
    return { ok: false, status: 400, message: "No workspace found for account" };
  }

  const { data: profile } = await supabase
    .from("account_plans")
    .select("max_upload_bytes")
    .eq("id", user.id)
    .maybeSingle();

  const configuredLimit = Number(profile?.max_upload_bytes);
  const maxUploadBytes = Number.isFinite(configuredLimit) && configuredLimit > 0
    ? Math.min(configuredLimit, MAX_ASSET_UPLOAD_BYTES)
    : MAX_ASSET_UPLOAD_BYTES;

  return {
    ok: true,
    context: {
      supabase,
      user: { id: user.id },
      workspaceId,
      maxUploadBytes,
    },
  };
}

export function assetKindForMime(mimeType: string): "image" | "video" | "audio" | "other" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "other";
}

export function userAssetsBucketName(): string {
  return (
    process.env.R2_USER_ASSETS_BUCKET?.trim() ||
    process.env.R2_BUCKET?.trim() ||
    "neonix-user-assets"
  );
}

export function jsonError(message: string, status = 400): Response {
  return Response.json({ error: { message } }, { status });
}
