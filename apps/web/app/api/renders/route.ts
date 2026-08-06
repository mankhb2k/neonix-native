import { NextResponse } from "next/server";
import { buildStubRenderManifest } from "@/lib/server/render/build-manifest";
import {
  buildIdempotencyKey,
  resolveRequestUserId,
} from "@/lib/server/render/ownership";
import { createRenderJob } from "@/lib/server/render/job-store";
import { startRenderOnLambda } from "@/lib/server/render/remotion-lambda";
import {
  CreateRenderJobRequestSchema,
  isRenderPresetId,
} from "@motionvideo/render-contracts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userId = resolveRequestUserId(request);
  const body = CreateRenderJobRequestSchema.parse(await request.json());
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
    await startRenderOnLambda({ job, manifest });
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
