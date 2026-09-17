import { NextResponse } from "next/server";
import { cancelRenderOnWorker, syncRenderJob } from "@/lib/server/render/export-worker";
import { assertJobOwner, getRenderJob } from "@/lib/server/render/job-store";
import { resolveRequestUserId } from "@/lib/server/render/ownership";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  const { id } = await context.params;
  const userId = await resolveRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  const job = await getRenderJob(id);
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try { assertJobOwner(job, userId); } catch { return NextResponse.json({ error: "forbidden" }, { status: 403 }); }
  const refreshed = await syncRenderJob(job);
  return NextResponse.json({ jobId: refreshed.jobId, status: refreshed.status, progress: refreshed.progress, stage: refreshed.stage, error: refreshed.error, artifactPath: refreshed.artifactPath, outputKey: refreshed.outputKey, metrics: refreshed.metrics, createdAt: refreshed.createdAt, updatedAt: refreshed.updatedAt });
}

export async function DELETE(request: Request, context: Ctx) {
  const { id } = await context.params;
  const userId = await resolveRequestUserId(request);
  if (!userId) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  const job = await getRenderJob(id);
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try { assertJobOwner(job, userId); } catch { return NextResponse.json({ error: "forbidden" }, { status: 403 }); }
  if (job.status === "done" || job.status === "failed" || job.status === "cancelled") return NextResponse.json({ jobId: job.jobId, status: job.status });
  await cancelRenderOnWorker(job);
  const updated = await getRenderJob(id);
  return NextResponse.json({ jobId: id, status: updated?.status ?? "cancelled" });
}

