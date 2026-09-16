import { z } from "zod";
import { verifyMediaEventSignature } from "@/lib/server/media/event-signature";
import { dispatchMediaJob, MEDIA_PIPELINE_VERSION } from "@/lib/server/media/worker";
import { createSupabaseAdminClient } from "@/lib/server/supabase/admin";

export const runtime = "nodejs";

const eventSchema = z.object({
  version: z.literal(1),
  messageId: z.string().min(1),
  action: z.string().min(1),
  bucket: z.string().min(1),
  eventTime: z.string().min(1),
  object: z.object({
    key: z.string().min(1),
    size: z.number().int().nonnegative(),
    eTag: z.string().min(1).optional(),
  }),
});

type MediaJob = {
  id: string;
  asset_id: string;
  workspace_id: string;
  status: "queued" | "processing" | "retryable" | "ready" | "partial" | "failed";
  source_integrity: string;
  media_kind: "audio" | "video";
  attempt_count: number;
};

type Asset = {
  id: string;
  workspace_id: string;
  status: string;
  kind: string;
  mime_type: string;
  byte_size: number;
  r2_key: string | null;
  deleted_at: string | null;
};

function asAsset(value: unknown): Asset | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string"
    && typeof record.workspace_id === "string"
    && typeof record.status === "string"
    && typeof record.kind === "string"
    && typeof record.mime_type === "string"
    && typeof record.byte_size === "number"
    && (record.r2_key === null || typeof record.r2_key === "string")
    && (record.deleted_at === null || typeof record.deleted_at === "string")
    ? {
        id: record.id,
        workspace_id: record.workspace_id,
        status: record.status,
        kind: record.kind,
        mime_type: record.mime_type,
        byte_size: record.byte_size,
        r2_key: record.r2_key,
        deleted_at: record.deleted_at,
      }
    : null;
}

function expectedBucket(): string | null {
  return process.env.R2_USER_ASSETS_BUCKET?.trim()
    || process.env.R2_BUCKET?.trim()
    || null;
}

function parseOriginKey(key: string): { workspaceId: string; assetId: string } | null {
  const match = /^media\/([^/]+)\/([^/]+)\/origin\.[a-zA-Z0-9]+$/.exec(key);
  return match ? { workspaceId: match[1], assetId: match[2] } : null;
}

function sourceIntegrity(size: number, eTag: string | undefined, key: string): string {
  return `r2:${eTag || size}:${key}`;
}

function mediaKindForAsset(asset: Asset): "audio" | "video" | null {
  if (asset.kind === "audio" || asset.mime_type.startsWith("audio/")) return "audio";
  if (asset.kind === "video" || asset.mime_type.startsWith("video/")) return "video";
  return null;
}

function retryableStatus(status: MediaJob["status"]): boolean {
  return status === "queued" || status === "retryable";
}

function authorized(request: Request, rawBody: string): boolean {
  const secret = process.env.MEDIA_EVENT_HMAC_SECRET?.trim();
  const timestamp = request.headers.get("x-media-event-timestamp")?.trim() || "";
  const signature = request.headers.get("x-media-event-signature")?.trim() || "";
  return Boolean(secret && timestamp && signature
    && verifyMediaEventSignature(secret, timestamp, signature, rawBody));
}

async function findOrCreateJob(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  asset: Asset,
  kind: "audio" | "video",
  sourceIdentity: string,
): Promise<{ job: MediaJob | null; error: string | null }> {
  const { data: existing, error: existingError } = await supabase
    .from("media_jobs")
    .select("id, asset_id, workspace_id, status, source_integrity, media_kind, attempt_count")
    .eq("asset_id", asset.id)
    .maybeSingle();
  if (existingError) return { job: null, error: existingError.message };
  if (existing) return { job: existing, error: null };

  const idempotencyKey = `${asset.id}:${sourceIdentity}:v${MEDIA_PIPELINE_VERSION}`;
  const { data: created, error: createError } = await supabase
    .from("media_jobs")
    .insert({
      workspace_id: asset.workspace_id,
      asset_id: asset.id,
      status: "queued",
      media_kind: kind,
      idempotency_key: idempotencyKey,
      source_integrity: sourceIdentity,
      pipeline_version: MEDIA_PIPELINE_VERSION,
    })
    .select("id, asset_id, workspace_id, status, source_integrity, media_kind, attempt_count")
    .single();
  if (!createError && created) return { job: created, error: null };
  if (createError?.code !== "23505") return { job: null, error: createError?.message ?? "Unable to create media job" };

  const { data: raced, error: raceError } = await supabase
    .from("media_jobs")
    .select("id, asset_id, workspace_id, status, source_integrity, media_kind, attempt_count")
    .eq("asset_id", asset.id)
    .maybeSingle();
  return { job: raced ?? null, error: raceError?.message ?? null };
}

async function claimJob(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  job: MediaJob,
): Promise<MediaJob | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("media_jobs")
    .update({
      status: "processing",
      started_at: new Date().toISOString(),
      attempt_count: job.attempt_count + 1,
      last_error: null,
      last_error_code: null,
      lease_owner: `cloudflare-media-events:${crypto.randomUUID()}`,
      lease_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      completed_at: null,
    })
    .eq("id", job.id)
    .in("status", ["queued", "retryable"])
    .or(`lease_expires_at.is.null,lease_expires_at.lte.${now}`)
    .select("id, asset_id, workspace_id, status, source_integrity, media_kind, attempt_count")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? data : null;
}

async function reReadJob(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  jobId: string,
): Promise<MediaJob | null> {
  const { data, error } = await supabase
    .from("media_jobs")
    .select("id, asset_id, workspace_id, status, source_integrity, media_kind, attempt_count")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? data : null;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!authorized(request, rawBody)) return Response.json({ error: "unauthorized" }, { status: 401 });

  let event: z.infer<typeof eventSchema>;
  try {
    event = eventSchema.parse(JSON.parse(rawBody));
  } catch (error) {
    return Response.json({ error: "invalid_media_event", detail: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }

  if (!event.action || !event.object.key.startsWith("media/")) {
    return Response.json({ ok: true, ignored: true });
  }

  const parsedKey = parseOriginKey(event.object.key);
  if (!parsedKey) return Response.json({ ok: true, ignored: true });
  const configuredBucket = expectedBucket();
  if (configuredBucket && event.bucket !== configuredBucket) {
    return Response.json({ error: "media_event_bucket_mismatch" }, { status: 422 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, workspace_id, status, kind, mime_type, byte_size, r2_key, deleted_at")
    .eq("id", parsedKey.assetId)
    .eq("workspace_id", parsedKey.workspaceId)
    .maybeSingle();
  if (assetError) return Response.json({ error: assetError.message }, { status: 500 });
  if (!asset) return Response.json({ error: "asset_not_committed" }, { status: 409 });
  const assetRow = asAsset(asset);
  if (!assetRow) return Response.json({ error: "asset_invalid" }, { status: 500 });
  if (assetRow.deleted_at) return Response.json({ ok: true, ignored: true, reason: "asset_deleted" });
  if (assetRow.status !== "ready") return Response.json({ error: "asset_not_ready" }, { status: 409 });
  if (assetRow.r2_key !== event.object.key || event.object.size !== assetRow.byte_size) {
    return Response.json({ error: "media_event_identity_mismatch" }, { status: 422 });
  }

  const mediaKind = mediaKindForAsset(assetRow);
  if (!mediaKind) return Response.json({ ok: true, ignored: true, reason: "no_media_derivative" });

  const identity = sourceIntegrity(event.object.size, event.object.eTag, event.object.key);
  const result = await findOrCreateJob(supabase, assetRow, mediaKind, identity);
  if (result.error) return Response.json({ error: result.error }, { status: 500 });
  if (!result.job) return Response.json({ error: "media_job_not_found" }, { status: 500 });
  if (!retryableStatus(result.job.status)) {
    return Response.json({ ok: true, jobId: result.job.id, status: result.job.status, duplicate: true });
  }

  const claimed = await claimJob(supabase, result.job);
  if (!claimed) {
    const current = await reReadJob(supabase, result.job.id);
    if (!current || retryableStatus(current.status)) return Response.json({ error: "media_job_claim_race" }, { status: 503 });
    return Response.json({ ok: true, jobId: current.id, status: current.status, duplicate: true });
  }

  const { error: assetStateError } = await supabase
    .from("assets")
    .update({ media_status: "processing" })
    .eq("id", assetRow.id)
    .eq("workspace_id", assetRow.workspace_id);
  if (assetStateError) {
    await supabase.from("media_jobs").update({ status: "retryable", lease_owner: null, lease_expires_at: null, last_error_code: "asset_state_update_failed", last_error: assetStateError.message }).eq("id", claimed.id);
    return Response.json({ error: assetStateError.message }, { status: 500 });
  }

  try {
    await dispatchMediaJob({
      jobId: claimed.id,
      assetId: assetRow.id,
      sourceKey: event.object.key,
      sourceMimeType: assetRow.mime_type,
      mediaKind,
      derivativePrefix: event.object.key.slice(0, Math.max(0, event.object.key.lastIndexOf("/"))),
      sourceIntegrity: claimed.source_integrity,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await supabase.from("media_jobs").update({
      status: "retryable",
      last_error_code: "dispatch_failed",
      last_error: detail,
      lease_owner: null,
      lease_expires_at: null,
    }).eq("id", claimed.id);
    await supabase.from("assets").update({ media_status: "queued" }).eq("id", assetRow.id).eq("workspace_id", assetRow.workspace_id);
    return Response.json({ error: "media_dispatch_failed", detail }, { status: 503 });
  }

  return Response.json({ ok: true, jobId: claimed.id, status: "processing", messageId: event.messageId }, { status: 202 });
}
