import { NextResponse } from "next/server";
import {
  buildStubRenderManifest,
  buildStubRuntimeProjectV3,
} from "@/lib/server/render/build-manifest";
import { createRenderJob } from "@/lib/server/render/job-store";
import {
  buildIdempotencyKey,
  resolveRequestUserId,
} from "@/lib/server/render/ownership";
import { preflightRenderManifest } from "@/lib/server/render/paint-preflight";
import { startRenderOnLambda } from "@/lib/server/render/remotion-lambda";
import { validateProjectVideoDurations } from "@/lib/server/render/source-duration";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";
import {
  CreateRenderJobRequestSchema,
  isRenderPresetId,
} from "@motionvideo/render-contracts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userId = resolveRequestUserId(request);
  const body = CreateRenderJobRequestSchema.parse(await request.json());
  if (body.document !== undefined) {
    const parsedProject = MotionProtocolV2Schema.safeParse(body.document);
    if (!parsedProject.success) {
      return NextResponse.json({ error: "invalid_project_document" }, { status: 400 });
    }
    const durationIssues = validateProjectVideoDurations(parsedProject.data);
    if (durationIssues.length > 0) {
      return NextResponse.json(
        { error: "video_source_duration_mismatch", issues: durationIssues },
        { status: 422 },
      );
    }
  }
  const presetRaw = body.preset ?? "export-1080p";
  if (!isRenderPresetId(presetRaw)) {
    return NextResponse.json({ error: "invalid_preset" }, { status: 400 });
  }
  const projectRevision = body.projectRevision ?? 0;
  const idempotencyKey = buildIdempotencyKey({
    userId,
    projectId: body.projectId,
    projectRevision,
    preset: presetRaw,
    clientKey: body.idempotencyKey,
  });

  const { job, created } = await createRenderJob({
    userId,
    projectId: body.projectId,
    projectRevision,
    idempotencyKey,
  });

  if (created) {
    const manifest = buildStubRenderManifest({
      projectId: body.projectId,
      projectRevision,
      preset: presetRaw,
    });
    const runtime = buildStubRuntimeProjectV3({
      projectId: body.projectId,
      preset: presetRaw,
    });
    const gate = preflightRenderManifest(manifest, {
      requireProductionGate: process.env.MOTICLIP_EXPORT_PRODUCTION_GATE === "1",
    });
    if (!gate.ok) {
      return NextResponse.json(
        {
          error: "preflight_failed",
          issues: gate.issues,
          jobId: job.jobId,
        },
        { status: 422 },
      );
    }
    await startRenderOnLambda({ job, manifest, runtime });
  }

  return NextResponse.json(
    {
      jobId: job.jobId,
      status: job.status,
      created,
    },
    { status: created ? 201 : 200 },
  );
}
