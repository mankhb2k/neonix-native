import { createSupabaseAdminClient } from "@/lib/server/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEVELOPMENT_STORAGE_QUOTA_BYTES = 1 * 1024 ** 3;

function developmentFallback() {
  return Response.json({
    usedBytes: 0,
    quotaBytes: DEVELOPMENT_STORAGE_QUOTA_BYTES,
    availableBytes: DEVELOPMENT_STORAGE_QUOTA_BYTES,
    usedPercent: 0,
  });
}

export async function GET() {
  let sessionClient;
  try {
    sessionClient = await createSupabaseServerClient();
  } catch {
    if (process.env.NODE_ENV !== "production") return developmentFallback();
    return Response.json(
      { error: { message: "Supabase is not configured" } },
      { status: 503 },
    );
  }

  const {
    data: { user },
    error: userError,
  } = await sessionClient.auth.getUser();

  if (userError || !user) {
    if (process.env.NODE_ENV !== "production") return developmentFallback();
    return Response.json(
      { error: { message: "Authentication required" } },
      { status: 401 },
    );
  }

  try {
    if (
      process.env.NODE_ENV !== "production" &&
      !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    ) {
      return developmentFallback();
    }

    const admin = createSupabaseAdminClient();
    const profileResult = await admin
      .from("profiles")
      .select("storage_quota_bytes")
      .eq("id", user.id)
      .maybeSingle();
    const usageResult = await admin.rpc("account_storage_used_bytes", {
      account_id: user.id,
    });
    const profile = profileResult.data;
    const used = usageResult.data as unknown;
    const profileError = profileResult.error;
    const usedError = usageResult.error;

    if (profileError || usedError || !profile) {
      // eslint-disable-next-line no-console
      console.error("[account/storage] unable to load storage usage", {
        profileError: profileError?.message,
        usedError: usedError?.message,
      });
      return Response.json(
        { error: { message: "Unable to load storage usage" } },
        { status: 500 },
      );
    }

    const usedBytes = Number(used ?? 0);
    const quotaBytes = Number(profile.storage_quota_bytes);
    if (
      !Number.isSafeInteger(usedBytes) ||
      usedBytes < 0 ||
      !Number.isSafeInteger(quotaBytes) ||
      quotaBytes <= 0
    ) {
      return Response.json(
        { error: { message: "Storage usage data is invalid" } },
        { status: 500 },
      );
    }

    return Response.json({
      usedBytes,
      quotaBytes,
      availableBytes: Math.max(0, quotaBytes - usedBytes),
      usedPercent: Math.min(100, (usedBytes / quotaBytes) * 100),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[account/storage] request failed", error);
    return Response.json(
      { error: { message: "Unable to load storage usage" } },
      { status: 500 },
    );
  }
}


