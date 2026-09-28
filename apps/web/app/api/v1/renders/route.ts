import { NextResponse } from "next/server";
import { publicRendererMessage } from "@/lib/public-renderer-message";
import { getProjectAccess, getProtocolRevision } from "@/lib/server/projects/repository";
import { buildStubRuntimeProjectV3 } from "@/lib/server/render/build-manifest";
import { startRenderOnWorker, syncRenderJob } from "@/lib/server/render/export-worker";
import {
  createRenderJob,
  getRenderJob,
  listRenderJobs,
  updateRenderJob,
} from "@/lib/server/render/job-store";
import {
  buildIdempotencyKey,
  resolveRequestUserId,
} from "@/lib/server/render/ownership";
import { compileAndPrepareRuntimeProjectV3 } from "@/lib/server/render/project-runtime";
import { enqueueRenderJob, isRenderQueueEnabled } from "@/lib/server/render/render-queue";
import { validateProjectVideoDurations } from "@/lib/server/render/source-duration";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CreateRenderJobRequestSchema,
  isRenderPresetId,
} from "@motionvideo/render-native/contracts";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";

export const runtime = "nodejs";

function productionQueueIsMisconfigured(): boolean {
  return process.env.NODE_ENV === "production" && !isRenderQueueEnabled();
}

function responseJob(job: Awaited<ReturnType<typeof listRenderJobs>>[number]) {
  return {
    jobId: job.jobId,
    projectId: job.projectId,
    projectRevision: job.projectRevision,
    status: job.status,
    progress: job.progress,
    stage: job.stage,
    error: job.error ? publicRendererMessage(job.error) : job.error,
    artifactPath: job.artifactPath,
    outputKey: job.outputKey,
    metrics: job.metrics,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export async function GET(request: Request) {
  const userId = await resolveRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  const jobs = await listRenderJobs();
  const owned = jobs.filter((job) => job.userId === userId);
  const refreshed = await Promise.all(owned.map((job) => syncRenderJob(job)));
  return NextResponse.json({ jobs: refreshed.sort((a, b) => b.createdAt - a.createdAt).map(responseJob) });
}

export async function POST(request: Request) {
  if (productionQueueIsMisconfigured()) {
    return NextResponse.json({ error: "render_queue_required", detail: "Production render entrypoints require Supabase PGMQ." }, { status: 503 });
  }
  const userId = await resolveRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  const body = CreateRenderJobRequestSchema.parse(await request.json());
  const presetRaw = body.preset ?? "export-1080p";
  if (!isRenderPresetId(presetRaw)) return NextResponse.json({ error: "invalid_preset" }, { status: 400 });
  const projectRevision = body.projectRevision ?? 0;
  let runtime;
  if (body.document !== undefined) {
    const parsedProject = MotionProtocolV2Schema.safeParse(body.document);
    if (!parsedProject.success) return NextResponse.json({ error: "invalid_project_document" }, { status: 400 });
    const durationIssues = validateProjectVideoDurations(parsedProject.data);
    if (durationIssues.length > 0) return NextResponse.json({ error: "video_source_duration_mismatch", issues: durationIssues }, { status: 422 });
    try { runtime = await compileAndPrepareRuntimeProjectV3(parsedProject.data); }
    catch (error) { return NextResponse.json({ error: "runtime_compile_failed", detail: publicRendererMessage(error instanceof Error ? error.message : String(error)) }, { status: 422 }); }
  } else {
    runtime = buildStubRuntimeProjectV3({ projectId: body.projectId, preset: presetRaw });
  }
  const idempotencyKey = buildIdempotencyKey({ userId, projectId: body.projectId, projectRevision, preset: presetRaw, clientKey: body.idempotencyKey });
  let database: Parameters<typeof createRenderJob>[0]["database"];
  if (process.env.NODE_ENV === "production" || isRenderQueueEnabled()) {
    try {
      const client = await createSupabaseServerClient();
      const access = await getProjectAccess(client, { userId }, { projectId: body.projectId });
      const revisionNo = projectRevision > 0 ? projectRevision : access.project.currentRevisionNo;
      const revision = await getProtocolRevision(client, { userId }, { projectId: access.project.id, revisionNo });
      database = {
        workspaceId: access.project.workspaceId,
        revisionId: revision.revision.id,
        preset: presetRaw,
        runtime,
      };
    } catch (error) {
      return NextResponse.json({ error: "render_persistence_failed", detail: publicRendererMessage(error instanceof Error ? error.message : String(error)) }, { status: 500 });
    }
  }

  const { job, created } = await createRenderJob({ userId, projectId: body.projectId, projectRevision, idempotencyKey, ...(database ? { database } : {}) });
  if (created) {
    try {
      if (isRenderQueueEnabled()) {
        await enqueueRenderJob({ jobId: job.jobId });
        await updateRenderJob(job.jobId, { status: "queued", progress: 0.01, stage: "queued" });
      } else {
        await startRenderOnWorker({ job, runtime });
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await updateRenderJob(job.jobId, { status: "failed", stage: "failed", error: detail });
      return NextResponse.json({ error: "worker_dispatch_failed", detail: publicRendererMessage(detail), jobId: job.jobId }, { status: 502 });
    }
  }
  const current = (await getRenderJob(job.jobId)) ?? job;
  return NextResponse.json({ jobId: current.jobId, status: current.status, created }, { status: created ? 202 : 200 });
}
