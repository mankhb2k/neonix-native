import { NextResponse } from "next/server";
import { buildStubRuntimeProjectV3 } from "@/lib/server/render/build-manifest";
import { startRenderOnWorker, syncRenderJob } from "@/lib/server/render/export-worker";
import {
  createRenderJob,
  listRenderJobs,
} from "@/lib/server/render/job-store";
import {
  buildIdempotencyKey,
  resolveRequestUserId,
} from "@/lib/server/render/ownership";
import { compileAndPrepareRuntimeProjectV3 } from "@/lib/server/render/project-runtime";
import { validateProjectVideoDurations } from "@/lib/server/render/source-duration";
import {
  CreateRenderJobRequestSchema,
  isRenderPresetId,
} from "@motionvideo/export-renderer/contracts";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";

export const runtime = "nodejs";

function responseJob(job: Awaited<ReturnType<typeof listRenderJobs>>[number]) {
  return {
    jobId: job.jobId,
    projectId: job.projectId,
    projectRevision: job.projectRevision,
    status: job.status,
    progress: job.progress,
    stage: job.stage,
    error: job.error,
    artifactPath: job.artifactPath,
    outputKey: job.outputKey,
    metrics: job.metrics,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export async function GET(request: Request) {
  const userId = resolveRequestUserId(request);
  const jobs = await listRenderJobs();
  const owned = jobs.filter((job) => job.userId === userId);
  const refreshed = await Promise.all(owned.map((job) => syncRenderJob(job)));
  return NextResponse.json({ jobs: refreshed.sort((a, b) => b.createdAt - a.createdAt).map(responseJob) });
}

export async function POST(request: Request) {
  const userId = resolveRequestUserId(request);
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
    catch (error) { return NextResponse.json({ error: "runtime_compile_failed", detail: error instanceof Error ? error.message : String(error) }, { status: 422 }); }
  } else {
    runtime = buildStubRuntimeProjectV3({ projectId: body.projectId, preset: presetRaw });
  }
  const idempotencyKey = buildIdempotencyKey({ userId, projectId: body.projectId, projectRevision, preset: presetRaw, clientKey: body.idempotencyKey });
  const { job, created } = await createRenderJob({ userId, projectId: body.projectId, projectRevision, idempotencyKey });
  if (created) {
    try { await startRenderOnWorker({ job, runtime }); }
    catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: "worker_dispatch_failed", detail, jobId: job.jobId }, { status: 502 });
    }
  }
  return NextResponse.json({ jobId: job.jobId, status: job.status, created }, { status: created ? 201 : 200 });
}


