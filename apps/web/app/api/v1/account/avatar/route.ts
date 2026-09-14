import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function jsonError(message: string, status = 400) {
  return Response.json({ error: { message } }, { status });
}

async function getAuthenticatedClient() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return { supabase, user: null };
  return { supabase, user };
}

export async function POST(request: Request) {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return jsonError("Authentication required", 401);

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return jsonError("An avatar image is required.");
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    return jsonError("Use a JPEG, PNG, WebP, or GIF image.");
  }
  if (file.size < 1 || file.size > MAX_AVATAR_BYTES) {
    return jsonError("Avatar images must be smaller than 5 MB.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("avatar_path, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) return jsonError(profileError.message, 500);
  if (!profile) return jsonError("Profile not found", 404);

  const avatarPath = `${user.id}/${crypto.randomUUID()}`;
  const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(avatarPath, file, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) return jsonError(uploadError.message, 502);

  const { data: publicUrlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(avatarPath);
  const avatarUrl = publicUrlData.publicUrl;
  const avatarUpdatedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      avatar_url: avatarUrl,
      avatar_path: avatarPath,
      avatar_mime_type: file.type,
      avatar_size_bytes: file.size,
      avatar_updated_at: avatarUpdatedAt,
    })
    .eq("id", user.id);

  if (updateError) {
    await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath]);
    return jsonError(updateError.message, 500);
  }

  const previousAvatarPath = typeof profile?.avatar_path === "string" ? profile.avatar_path : null;
  if (previousAvatarPath && previousAvatarPath !== avatarPath) {
    const { error: cleanupError } = await supabase.storage.from(AVATAR_BUCKET).remove([previousAvatarPath]);
    if (cleanupError) {
      // eslint-disable-next-line no-console
      console.warn("[account/avatar] unable to remove previous avatar", cleanupError.message);
    }
  }

  return Response.json({
    avatarUrl,
    avatarPath,
    avatarMimeType: file.type,
    avatarSizeBytes: file.size,
    avatarUpdatedAt,
  });
}

export async function DELETE() {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return jsonError("Authentication required", 401);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("avatar_path, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) return jsonError(profileError.message, 500);

  const profileRecord = profile as { avatar_path?: unknown; avatar_url?: unknown } | null;
  const avatarPath = typeof profileRecord?.avatar_path === "string" ? profileRecord.avatar_path : null;
  const avatarUrl = typeof profileRecord?.avatar_url === "string" ? profileRecord.avatar_url : null;
  if (!avatarPath) return Response.json({ avatarUrl });

  const { error: removeError } = await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath]);
  if (removeError) return jsonError(removeError.message, 502);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      avatar_url: null,
      avatar_path: null,
      avatar_mime_type: null,
      avatar_size_bytes: null,
      avatar_updated_at: null,
    })
    .eq("id", user.id);
  if (updateError) return jsonError(updateError.message, 500);

  return Response.json({ avatarUrl: null });
}
