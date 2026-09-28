import "server-only";

import { publicRendererMessage } from "@/lib/public-renderer-message";
import { getProjectAccess, getProjectHtml, getProtocolRevision } from "@/lib/server/projects/repository";
import { getUserExportsProvider } from "@/lib/server/r2";
import { startRenderOnWorker, syncRenderJob, cancelRenderOnWorker } from "@/lib/server/render/export-worker";
import {
  createHtmlRenderJob,
  getHtmlRenderJob,
  isHtmlRenderJobRef,
  type HtmlRenderJob,
} from "@/lib/server/render/html-job-store";
import { dispatchHtmlRenderInBackground } from "@/lib/server/render/html-render-worker";
import { assertJobAccess, buildRenderOutputKey, createRenderJob, getRenderJob, type PersistentRenderJob, updateRenderJob } from "@/lib/server/render/job-store";
import { buildIdempotencyKey } from "@/lib/server/render/ownership";
import { compileAndPrepareRuntimeProjectV3 } from "@/lib/server/render/project-runtime";
import { enqueueRenderJob, isRenderQueueEnabled } from "@/lib/server/render/render-queue";
import { validateProjectVideoDurations } from "@/lib/server/render/source-duration";
import { createSupabaseAdminClient } from "@/lib/server/supabase/admin";
import { parseRawHtmlComposition } from "@/lib/server/validate-raw-html";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";
import { isRenderPresetId } from "@motionvideo/render-native/contracts";
import { getMcpSupabaseClient } from "./projects";
import type { McpPrincipal } from "./auth";

export class McpExportError extends Error {
  constructor(message: string, readonly code = "EXPORT_ERROR", readonly details?: Record<string, unknown>) {
    super(message);
    this.name = "McpExportError";
  }
}

const CREATE_EXPORT_RATE_LIMIT_WINDOW_SECONDS = 300;
const CREATE_EXPORT_RATE_LIMIT_MAX_REQUESTS = 10;

/** The rate limit bucket is a fixed window aligned to the epoch (see check_and_increment_rate_limit), so the reset time is derivable without another DB round-trip. */
function secondsUntilRateLimitReset(windowSeconds: number): number {
  const nowSeconds = Date.now() / 1000;
  const windowStart = Math.floor(nowSeconds / windowSeconds) * windowSeconds;
  return Math.max(1, Math.ceil(windowStart + windowSeconds - nowSeconds));
}

async function enforceCreateExportRateLimit(principal: McpPrincipal): Promise<void> {
  try {
    const allowed = await createSupabaseAdminClient().rpc("check_and_increment_rate_limit", {
      p_bucket_key: `mcp-export-create:${principal.userId}`,
      p_window_seconds: CREATE_EXPORT_RATE_LIMIT_WINDOW_SECONDS,
      p_max_requests: CREATE_EXPORT_RATE_LIMIT_MAX_REQUESTS,
    });
    if (allowed.error) throw allowed.error;
    if (allowed.data !== true) {
      const retryAfterSeconds = secondsUntilRateLimitReset(CREATE_EXPORT_RATE_LIMIT_WINDOW_SECONDS);
      throw new McpExportError(
        `Too many export requests. Try again in ${retryAfterSeconds}s.`,
        "RATE_LIMITED",
        { retryAfterSeconds },
      );
    }
  } catch (error) {
    if (error instanceof McpExportError) throw error;
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[mcp.exports] rate limiting unavailable in this environment, allowing request", error);
      return;
    }
    // eslint-disable-next-line no-console
    console.error("[mcp.exports] rate limit check failed", error);
    throw new McpExportError("Unable to verify request rate, please try again shortly", "RATE_LIMIT_UNAVAILABLE");
  }
}

async function audit(principal: McpPrincipal, workspaceId: string, action: string, targetId: string, metadata: Record<string, unknown> = {}) {
  const { error } = await getMcpSupabaseClient(principal).from("audit_events").insert({
    workspace_id: workspaceId,
    actor_user_id: principal.userId,
    actor_client_id: principal.clientId,
    action,
    target_type: "render_job",
    target_id: targetId,
    metadata_json: metadata,
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[mcp.exports] audit event failed", error.message);
  }
}

function output(job: PersistentRenderJob) {
  return {
    jobId: job.jobId,
    projectId: job.projectId,
    protocolRevisionNo: job.projectRevision,
    status: job.status,
    progress: job.progress,
    stage: job.stage,
    error: job.error ? publicRendererMessage(job.error) : job.error,
    outputKey: job.outputKey,
    metrics: job.metrics,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

async function mirrorJobToDatabase(principal: McpPrincipal, job: PersistentRenderJob, revisionId: string, workspaceId: string, preset: string, runtime?: unknown) {
  const client = getMcpSupabaseClient(principal);
  const state = await client.from("render_jobs").upsert({
    public_ref: job.jobId,
    workspace_id: workspaceId,
    project_id: job.projectId,
    revision_id: revisionId,
    status: job.status,
    preset_json: { preset, projectRevision: job.projectRevision },
    ...(runtime ? { runtime_json: runtime } : {}),
    idempotency_key: job.idempotencyKey,
    provider_render_id: job.jobId,
    output_key: job.outputKey ?? null,
    error_code: job.error ?? null,
    created_by: principal.userId,
    created_at: new Date(job.createdAt).toISOString(),
    finished_at: ["done", "failed", "cancelled"].includes(job.status) ? new Date(job.updatedAt).toISOString() : null,
  }, { onConflict: "workspace_id,idempotency_key" });
  if (state.error) throw new McpExportError(state.error.message, "DATABASE_ERROR");
}

async function mirrorJobStatus(principal: McpPrincipal, job: PersistentRenderJob) {
  const client = getMcpSupabaseClient(principal);
  const result = await client.from("render_jobs").update({
    status: job.status,
    output_key: job.outputKey ?? null,
    error_code: job.error ?? null,
    finished_at: ["done", "failed", "cancelled"].includes(job.status) ? new Date(job.updatedAt).toISOString() : null,
  }).eq("public_ref", job.jobId).eq("created_by", principal.userId);
  if (result.error) throw new McpExportError(result.error.message, "DATABASE_ERROR");
}

/**
 * A renderer can finish publishing the MP4 before the control-plane observes
 * the final row update. Reconcile only the unambiguous state where the worker
 * already reported stage=done/progress=1 and the deterministic artifact exists.
 */
async function reconcilePublishedArtifact(job: PersistentRenderJob): Promise<PersistentRenderJob> {
  if (job.status !== "publishing" || job.stage !== "done" || job.progress < 1 || job.outputKey) return job;
  const outputKey = buildRenderOutputKey(job, job.jobId);
  const object = await getUserExportsProvider().headObject(outputKey);
  if (!object) return job;
  return (await updateRenderJob(job.jobId, {
    status: "done",
    stage: "done",
    progress: 1,
    outputKey,
    artifactPath: `r2://${outputKey}`,
  })) ?? job;
}

function outputHtmlJob(job: HtmlRenderJob) {
  return {
    jobId: job.publicRef,
    projectId: job.projectId,
    // No Neonix JSON V2 revision applies to a Kiến trúc B job — 0 signals
    // that, matching current_revision_no's own meaning elsewhere.
    protocolRevisionNo: 0,
    status: job.status,
    progress: job.status === "done" ? 1 : job.status === "failed" || job.status === "cancelled" ? 0 : undefined,
    stage: job.status,
    error: job.errorMessage ? publicRendererMessage(job.errorMessage) : undefined,
    outputKey: job.outputKey ?? undefined,
    createdAt: new Date(job.createdAt).getTime(),
    updatedAt: new Date(job.updatedAt).getTime(),
  };
}

/**
 * Kiến trúc B (HTML Frame Render) export — see ARCHITECHTURE.md "Hai kiến
 * trúc render độc lập". Shells out to packages/render-html's headless-
 * Chromium script in the background; the caller polls get_export. Requires
 * fps and durationMs in the project's own neonix-document composition —
 * durationMs isn't required for creation/editing (see validate-raw-html.ts),
 * only for export, since the render script has no other way to know how
 * long to render.
 */
async function createHtmlExport(
  principal: McpPrincipal,
  access: Awaited<ReturnType<typeof getProjectAccess>>,
) {
  const client = getMcpSupabaseClient(principal);
  const source = await getProjectHtml(client, { userId: principal.userId, clientId: principal.clientId }, { projectId: access.project.id });
  if (!source.html) throw new McpExportError("Project has no HTML source", "NOT_FOUND");
  const composition = parseRawHtmlComposition(source.html);
  if (!composition) throw new McpExportError("Project's neonix-document composition is invalid", "INVALID_DOCUMENT");
  if (!composition.fps) {
    throw new McpExportError("neonix-document composition.fps is required to export this project", "MISSING_COMPOSITION_FIELD");
  }
  if (!composition.durationMs) {
    throw new McpExportError(
      "neonix-document composition.durationMs is required to export this project — add it (in milliseconds) with update_project_html, then try again. It isn't required to create or edit the project, only to export it, since the render script has no other way to know how long to render.",
      "MISSING_COMPOSITION_FIELD",
    );
  }

  const job = await createHtmlRenderJob(client, {
    workspaceId: access.project.workspaceId,
    projectId: access.project.id,
    htmlRevisionNo: source.htmlRevision.revision_no,
    createdBy: principal.userId,
  });
  dispatchHtmlRenderInBackground({
    jobId: job.publicRef,
    workspaceId: access.project.workspaceId,
    html: source.html,
    composition: { width: composition.width, height: composition.height, fps: composition.fps, durationMs: composition.durationMs },
  });
  await audit(principal, access.project.workspaceId, "mcp.export.create", job.publicRef, { projectId: access.project.id, track: "html" });
  return { export: outputHtmlJob(job), created: true };
}

async function readAndCompileRevision(
  principal: McpPrincipal,
  access: Awaited<ReturnType<typeof getProjectAccess>>,
  input: { protocolRevisionNo?: number },
) {
  const client = getMcpSupabaseClient(principal);
  const revisionNo = input.protocolRevisionNo ?? access.project.currentRevisionNo;
  const revision = await getProtocolRevision(client, principal, { projectId: access.project.id, revisionNo });
  const parsed = MotionProtocolV2Schema.safeParse(revision.revision.document);
  if (!parsed.success) throw new McpExportError("Stored Neonix JSON V2 revision is invalid", "INVALID_REVISION");
  const durationIssues = validateProjectVideoDurations(parsed.data);
  if (durationIssues.length > 0) throw new McpExportError("Video source duration validation failed", "VIDEO_SOURCE_DURATION_MISMATCH");
  let runtime;
  try {
    runtime = await compileAndPrepareRuntimeProjectV3(parsed.data);
  } catch (error) {
    throw new McpExportError(error instanceof Error ? error.message : String(error), "RUNTIME_COMPILE_FAILED");
  }
  return { client, revision, runtime };
}

export async function createExport(principal: McpPrincipal, input: {
  projectId?: string;
  publicRef?: string;
  protocolRevisionNo?: number;
  preset?: string;
  idempotencyKey?: string;
}) {
  await enforceCreateExportRateLimit(principal);
  const client = getMcpSupabaseClient(principal);
  const access = await getProjectAccess(client, principal, { projectId: input.projectId, publicRef: input.publicRef });
  // Kiến trúc B (raw HTML, no Neonix JSON V2 revision) branches off entirely
  // here — its own job table/renderer, no preset, no render queue.
  if (access.project.currentRevisionNo === 0) {
    return createHtmlExport(principal, access);
  }
  if (process.env.NODE_ENV === "production" && !isRenderQueueEnabled()) {
    throw new McpExportError("Production render entrypoints require Supabase PGMQ", "RENDER_QUEUE_REQUIRED");
  }
  const preset = input.preset ?? "export-1080p";
  if (!isRenderPresetId(preset)) throw new McpExportError("Invalid export preset", "INVALID_PRESET");
  const { revision, runtime } = await readAndCompileRevision(principal, access, input);
  const idempotencyKey = buildIdempotencyKey({
    userId: principal.userId,
    projectId: access.project.id,
    projectRevision: revision.revision.revision_no,
    preset,
    clientKey: input.idempotencyKey,
  });
  const existingDb = await getMcpSupabaseClient(principal).from("render_jobs").select("public_ref").eq("workspace_id", access.project.workspaceId).eq("idempotency_key", idempotencyKey).maybeSingle();
  if (existingDb.error) throw new McpExportError(existingDb.error.message, "DATABASE_ERROR");
  if (existingDb.data?.public_ref) {
    const existing = await getRenderJob(String(existingDb.data.public_ref));
    if (existing) return { export: output(await syncRenderJob(existing)), created: false };
  }
  const created = await createRenderJob({
    userId: principal.userId,
    projectId: access.project.id,
    projectRevision: revision.revision.revision_no,
    idempotencyKey,
    database: {
      workspaceId: access.project.workspaceId,
      revisionId: revision.revision.id,
      preset,
      runtime,
    },
  });
  await mirrorJobToDatabase(principal, created.job, revision.revision.id, access.project.workspaceId, preset, runtime);
  if (created.created) {
    try {
      if (isRenderQueueEnabled()) {
        await enqueueRenderJob({ jobId: created.job.jobId });
      } else {
        await startRenderOnWorker({ job: created.job, runtime });
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await mirrorJobToDatabase(principal, (await getRenderJob(created.job.jobId)) ?? { ...created.job, status: "failed", error: detail, updatedAt: Date.now() }, revision.revision.id, access.project.workspaceId, preset, runtime);
      throw new McpExportError(detail, "WORKER_DISPATCH_FAILED");
    }
  }
  const refreshed = (await getRenderJob(created.job.jobId)) ?? created.job;
  await mirrorJobToDatabase(principal, refreshed, revision.revision.id, access.project.workspaceId, preset, runtime);
  if (created.created) {
    await audit(principal, access.project.workspaceId, "mcp.export.create", refreshed.jobId, { projectId: access.project.id, preset });
  }
  return { export: output(refreshed), created: created.created };
}

async function getHtmlJobOrThrow(principal: McpPrincipal, jobId: string): Promise<HtmlRenderJob> {
  const job = await getHtmlRenderJob(getMcpSupabaseClient(principal), jobId);
  if (!job) throw new McpExportError("Export not found", "NOT_FOUND");
  return job;
}

export async function getExport(principal: McpPrincipal, input: { jobId: string }) {
  if (isHtmlRenderJobRef(input.jobId)) {
    return { export: outputHtmlJob(await getHtmlJobOrThrow(principal, input.jobId)) };
  }
  const job = await getRenderJob(input.jobId);
  if (!job) throw new McpExportError("Export not found", "NOT_FOUND");
  try { await assertJobAccess(job, principal.userId); } catch { throw new McpExportError("Export not found", "NOT_FOUND"); }
  const refreshed = await reconcilePublishedArtifact(await syncRenderJob(job));
  await mirrorJobStatus(principal, refreshed);
  return { export: output(refreshed) };
}

export async function cancelExport(principal: McpPrincipal, input: { jobId: string }) {
  if (isHtmlRenderJobRef(input.jobId)) {
    const job = await getHtmlJobOrThrow(principal, input.jobId);
    // Best-effort only: marks the job cancelled but does not kill the
    // spawned python/ffmpeg process, which isn't tracked anywhere by pid —
    // a real cancel would need that. Fine for now since the caller only
    // sees the job as cancelled and its output is never referenced again.
    if (["done", "failed", "cancelled"].includes(job.status)) return { export: outputHtmlJob(job) };
    const client = getMcpSupabaseClient(principal);
    await client.from("html_render_jobs").update({ status: "cancelled", finished_at: new Date().toISOString() }).eq("public_ref", job.publicRef);
    const refreshed = await getHtmlJobOrThrow(principal, input.jobId);
    await audit(principal, job.workspaceId, "mcp.export.cancel", job.publicRef);
    return { export: outputHtmlJob(refreshed) };
  }
  const job = await getRenderJob(input.jobId);
  if (!job) throw new McpExportError("Export not found", "NOT_FOUND");
  try { await assertJobAccess(job, principal.userId); } catch { throw new McpExportError("Export not found", "NOT_FOUND"); }
  if (["done", "failed", "cancelled"].includes(job.status)) return { export: output(job) };
  await cancelRenderOnWorker(job);
  const refreshed = (await getRenderJob(job.jobId)) ?? job;
  await mirrorJobStatus(principal, refreshed);
  await audit(principal, job.workspaceId ?? "unknown", "mcp.export.cancel", job.jobId);
  return { export: output(refreshed) };
}

export async function getExportDownloadUrl(principal: McpPrincipal, input: { jobId: string }) {
  if (isHtmlRenderJobRef(input.jobId)) {
    const job = await getHtmlJobOrThrow(principal, input.jobId);
    if (job.status !== "done") throw new McpExportError("Export is not ready", "NOT_READY");
    if (!job.outputKey) throw new McpExportError("Export artifact is unavailable", "ARTIFACT_MISSING");
    const signed = await getUserExportsProvider().presignGet(job.outputKey, 60);
    await audit(principal, job.workspaceId, "mcp.export.download_url", job.publicRef);
    return { jobId: job.publicRef, url: signed.url, expiresAt: signed.expiresAt.toISOString() };
  }
  const job = await getRenderJob(input.jobId);
  if (!job) throw new McpExportError("Export not found", "NOT_FOUND");
  try { await assertJobAccess(job, principal.userId); } catch { throw new McpExportError("Export not found", "NOT_FOUND"); }
  const refreshed = await reconcilePublishedArtifact(await syncRenderJob(job));
  await mirrorJobStatus(principal, refreshed);
  if (refreshed.status !== "done") throw new McpExportError("Export is not ready", "NOT_READY");
  if (refreshed.outputKey && refreshed.artifactPath?.startsWith("r2://")) {
    const signed = await getUserExportsProvider().presignGet(refreshed.outputKey, 60);
    await audit(principal, refreshed.workspaceId ?? "unknown", "mcp.export.download_url", refreshed.jobId);
    return { jobId: refreshed.jobId, url: signed.url, expiresAt: signed.expiresAt.toISOString() };
  }
  if (!refreshed.artifactPath) throw new McpExportError("Export artifact is unavailable", "ARTIFACT_MISSING");
  await audit(principal, refreshed.workspaceId ?? "unknown", "mcp.export.download_url", refreshed.jobId);
  return { jobId: refreshed.jobId, url: refreshed.artifactPath, expiresAt: new Date(Date.now() + 60_000).toISOString() };
}
