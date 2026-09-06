import { z } from "zod";
import { derivativeObjectKey, getUserAssetsProvider } from "@/lib/server/r2";
import { createSupabaseAdminClient } from "@/lib/server/supabase/admin";

export const runtime = "nodejs";

const streamSchema = z.object({
  streamId: z.string(),
  kind: z.enum(["video", "audio"]),
  codec: z.string().optional(),
  codecConfig: z.string().optional(),
  durationUs: z.number().optional(),
  durationSamples: z.number().optional(),
  sampleRate: z.number().optional(),
  channels: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  frameRate: z.number().optional(),
  timeBase: z.string().optional(),
}).passthrough();

const derivativeSchema = z.object({
  derivativeId: z.string(),
  kind: z.enum(["audio", "poster", "video-proxy"]),
  uri: z.string(),
  mimeType: z.string(),
  integrity: z.string().optional(),
  byteSize: z.number().int().nonnegative().optional(),
  version: z.number().int().positive(),
}).passthrough();

const callbackSchema = z.object({
  jobId: z.string().min(1),
  assetId: z.string().min(1),
  status: z.enum(["ready", "partial", "failed"]),
  sourceIntegrity: z.string().min(1),
  sourceContentHash: z.string().optional(),
  pipelineVersion: z.number().int().positive(),
  streams: z.array(streamSchema),
  derivatives: z.array(derivativeSchema),
  error: z.string().optional(),
});

function authorized(request: Request): boolean {
  const expected = process.env.INTERNAL_WORKER_TOKEN?.trim();
  const supplied = request.headers.get("x-internal-worker-token")?.trim();
  return Boolean(expected && supplied && expected === supplied);
}

function firstStream(streams: Array<z.infer<typeof streamSchema>>, kind: "video" | "audio") {
  return streams.find((stream) => stream.kind === kind);
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });

  let payload: z.infer<typeof callbackSchema>;
  try {
    payload = callbackSchema.parse(await request.json());
  } catch (error) {
    return Response.json({ error: "invalid_callback", detail: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: job, error: jobError } = await supabase
    .from("media_jobs")
    .select("id, asset_id, source_integrity, workspace_id, status")
    .eq("id", payload.jobId)
    .maybeSingle();
  if (jobError) return Response.json({ error: jobError.message }, { status: 500 });
  if (!job) return Response.json({ error: "media_job_not_found" }, { status: 404 });
  if (job.asset_id !== payload.assetId || job.source_integrity !== payload.sourceIntegrity) {
    return Response.json({ error: "media_job_identity_mismatch" }, { status: 409 });
  }
  const workspaceId = typeof job.workspace_id === "string" ? job.workspace_id : "";
  if (!workspaceId) return Response.json({ error: "media_job_workspace_missing" }, { status: 500 });

  const { data: asset, error: assetLookupError } = await supabase
    .from("assets")
    .select("id, deleted_at")
    .eq("id", payload.assetId)
    .eq("workspace_id", job.workspace_id)
    .maybeSingle();
  if (assetLookupError) return Response.json({ error: assetLookupError.message }, { status: 500 });
  if (!asset || asset.deleted_at) return Response.json({ error: "asset_deleted" }, { status: 409 });
  if (job.status === "failed") return Response.json({ error: "media_job_closed" }, { status: 409 });

  const provider = getUserAssetsProvider();
  const verifiedDerivatives: Array<{
    asset_id: string;
    variant_kind: "poster" | "audio";
    r2_key: string;
    mime_type: string;
    byte_size: number;
    content_hash: string;
    metadata_json: Record<string, unknown>;
  }> = [];
  const verificationErrors: string[] = [];

  for (const derivative of payload.derivatives) {
    if (derivative.kind === "video-proxy") continue;
    const variantKind = derivative.kind;
    const expectedKey = derivativeObjectKey(workspaceId, payload.assetId, variantKind, variantKind === "poster" ? "poster.webp" : "audio.m4a");
    if (derivative.uri !== expectedKey) {
      verificationErrors.push(`${variantKind}: unexpected object key`);
      continue;
    }
    const head = await provider.headObject(expectedKey);
    if (!head) {
      verificationErrors.push(`${variantKind}: object not found`);
      continue;
    }
    if (derivative.byteSize !== undefined && head.sizeBytes !== derivative.byteSize) {
      verificationErrors.push(`${variantKind}: byte size mismatch`);
      continue;
    }
    if (head.contentType && head.contentType !== derivative.mimeType) {
      verificationErrors.push(`${variantKind}: MIME type mismatch`);
      continue;
    }
    verifiedDerivatives.push({
      asset_id: payload.assetId,
      variant_kind: variantKind,
      r2_key: expectedKey,
      mime_type: derivative.mimeType,
      byte_size: head.sizeBytes,
      content_hash: derivative.integrity ?? `r2:${head.sizeBytes}:${expectedKey}`,
      metadata_json: { pipelineVersion: payload.pipelineVersion, kind: variantKind },
    });
  }

  const poster = verifiedDerivatives.find((item) => item.variant_kind === "poster");
  const video = firstStream(payload.streams, "video");
  const audio = firstStream(payload.streams, "audio");
  const finalStatus = verificationErrors.length > 0 && payload.status === "ready" ? "partial" : payload.status;
  const finalError = [...(payload.error ? [payload.error] : []), ...verificationErrors].join("; ") || null;
  const { error: variantError } = verifiedDerivatives.length
    ? await supabase.from("asset_variants").upsert(verifiedDerivatives, { onConflict: "asset_id,variant_kind" })
    : { error: null };
  if (variantError) return Response.json({ error: variantError.message }, { status: 500 });

  const { error: assetError } = await supabase
    .from("assets")
    .update({
      ...(poster ? { preview_key: poster.r2_key } : {}),
      preview_status: poster ? "ready" : "failed",
      preview_error: finalError,
      source_duration_ms: video?.durationUs ? Math.round(video.durationUs / 1000) : null,
      source_width: video?.width ?? null,
      source_height: video?.height ?? null,
      has_audio: Boolean(audio),
      metadata_json: {
        media: {
          pipelineVersion: payload.pipelineVersion,
          sourceContentHash: payload.sourceContentHash ?? null,
          streams: payload.streams,
        },
      },
    })
    .eq("id", payload.assetId)
    .eq("workspace_id", job.workspace_id);
  if (assetError) return Response.json({ error: assetError.message }, { status: 500 });

  const { error: updateJobError } = await supabase
    .from("media_jobs")
    .update({
      status: finalStatus,
      streams_json: payload.streams,
      derivatives_json: verifiedDerivatives,
      last_error: finalError,
      completed_at: new Date().toISOString(),
    })
    .eq("id", payload.jobId);
  if (updateJobError) return Response.json({ error: updateJobError.message }, { status: 500 });

  return Response.json({ ok: true, jobId: payload.jobId, status: finalStatus });
}
