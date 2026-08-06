import { NextResponse } from "next/server";
import {
  assertJobOwner,
  getRenderJob,
} from "@/lib/server/render/job-store";
import { resolveRequestUserId } from "@/lib/server/render/ownership";
import { cancelLambdaRender } from "@/lib/server/render/remotion-lambda";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  const { id } = await context.params;
  const userId = resolveRequestUserId(request);
  const job = await getRenderJob(id);
  if (!job) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  try {
    assertJobOwner(job, userId);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json({
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    stage: job.stage,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
}

export async function DELETE(request: Request, context: Ctx) {
  const { id } = await context.params;
  const userId = resolveRequestUserId(request);
  const job = await getRenderJob(id);
  if (!job) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  try {
    assertJobOwner(job, userId);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (job.status === "done" || job.status === "failed" || job.status === "cancelled") {
    return NextResponse.json({ jobId: job.jobId, status: job.status });
  }
  await cancelLambdaRender(job);
  const updated = await getRenderJob(id);
  return NextResponse.json({
    jobId: id,
    status: updated?.status ?? "cancelled",
  });
}
