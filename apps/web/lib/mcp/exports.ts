import "server-only";

import { getProjectAccess, getProtocolRevision } from "@/lib/server/projects/repository";
import { getUserExportsProvider } from "@/lib/server/r2";
import { startRenderOnWorker, syncRenderJob, cancelRenderOnWorker } from "@/lib/server/render/export-worker";
import { assertJobOwner, buildRenderOutputKey, createRenderJob, getRenderJob, type PersistentRenderJob, updateRenderJob } from "@/lib/server/render/job-store";
import { buildIdempotencyKey } from "@/lib/server/render/ownership";
import { compileAndPrepareRuntimeProjectV3 } from "@/lib/server/render/project-runtime";
import { enqueueRenderJob, isRenderQueueEnabled } from "@/lib/server/render/render-queue";
import { validateProjectVideoDurations } from "@/lib/server/render/source-duration";
import { publicRendererMessage } from "@/lib/public-renderer-message";
import { isRenderPresetId } from "@motionvideo/export-renderer/contracts";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";
import { getMcpSupabaseClient } from "./projects";
import type { McpPrincipal } from "./auth";

export class McpExportError extends Error {
  constructor(message: string, readonly code = "EXPORT_ERROR") {
    super(message);
    this.name = "McpExportError";
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
  const outputKey = buildRenderOutputKey(job.userId, job.jobId);
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

async function readAndCompileRevision(principal: McpPrincipal, input: { projectId?: string; publicRef?: string; protocolRevisionNo?: number }) {
  const client = getMcpSupabaseClient(principal);
  const access = await getProjectAccess(client, principal, { projectId: input.projectId, publicRef: input.publicRef });
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
  return { client, access, revision, runtime };
}

export async function createExport(principal: McpPrincipal, input: {
  projectId?: string;
  publicRef?: string;
  protocolRevisionNo?: number;
  preset?: string;
  idempotencyKey?: string;
}) {
  if (process.env.NODE_ENV === "production" && !isRenderQueueEnabled()) {
    throw new McpExportError("Production render entrypoints require Supabase PGMQ", "RENDER_QUEUE_REQUIRED");
  }
  const preset = input.preset ?? "export-1080p";
  if (!isRenderPresetId(preset)) throw new McpExportError("Invalid export preset", "INVALID_PRESET");
  const { access, revision, runtime } = await readAndCompileRevision(principal, input);
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
  return { export: output(refreshed), created: created.created };
}

export async function getExport(principal: McpPrincipal, input: { jobId: string }) {
  const job = await getRenderJob(input.jobId);
  if (!job) throw new McpExportError("Export not found", "NOT_FOUND");
  try { assertJobOwner(job, principal.userId); } catch { throw new McpExportError("Export not found", "NOT_FOUND"); }
  const refreshed = await reconcilePublishedArtifact(await syncRenderJob(job));
  await mirrorJobStatus(principal, refreshed);
  return { export: output(refreshed) };
}

export async function cancelExport(principal: McpPrincipal, input: { jobId: string }) {
  const job = await getRenderJob(input.jobId);
  if (!job) throw new McpExportError("Export not found", "NOT_FOUND");
  try { assertJobOwner(job, principal.userId); } catch { throw new McpExportError("Export not found", "NOT_FOUND"); }
  if (["done", "failed", "cancelled"].includes(job.status)) return { export: output(job) };
  await cancelRenderOnWorker(job);
  const refreshed = (await getRenderJob(job.jobId)) ?? job;
  await mirrorJobStatus(principal, refreshed);
  return { export: output(refreshed) };
}

export async function getExportDownloadUrl(principal: McpPrincipal, input: { jobId: string }) {
  const job = await getRenderJob(input.jobId);
  if (!job) throw new McpExportError("Export not found", "NOT_FOUND");
  try { assertJobOwner(job, principal.userId); } catch { throw new McpExportError("Export not found", "NOT_FOUND"); }
  const refreshed = await reconcilePublishedArtifact(await syncRenderJob(job));
  await mirrorJobStatus(principal, refreshed);
  if (refreshed.status !== "done") throw new McpExportError("Export is not ready", "NOT_READY");
  if (refreshed.outputKey && refreshed.artifactPath?.startsWith("r2://")) {
    const signed = await getUserExportsProvider().presignGet(refreshed.outputKey, 60);
    return { jobId: refreshed.jobId, url: signed.url, expiresAt: signed.expiresAt.toISOString() };
  }
  if (!refreshed.artifactPath) throw new McpExportError("Export artifact is unavailable", "ARTIFACT_MISSING");
  return { jobId: refreshed.jobId, url: refreshed.artifactPath, expiresAt: new Date(Date.now() + 60_000).toISOString() };
}
