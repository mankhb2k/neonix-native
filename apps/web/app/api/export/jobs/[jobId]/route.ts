import {
  cancelExportJob,
  getExportJob,
  toPublicJob,
} from "@/lib/editor/export/export-job-registry";

export const runtime = "nodejs";

type Params = { params: Promise<{ jobId: string }> };

/** GET /api/export/jobs/[jobId] — poll status / progress. */
export async function GET(
  _request: Request,
  { params }: Params,
): Promise<Response> {
  const { jobId } = await params;
  const job = getExportJob(jobId);
  if (!job) {
    return Response.json({ error: "Job not found" }, { status: 404 });
  }
  return Response.json({ ok: true, job: toPublicJob(job) });
}

/** DELETE /api/export/jobs/[jobId] — cancel in-flight job. */
export async function DELETE(
  _request: Request,
  { params }: Params,
): Promise<Response> {
  const { jobId } = await params;
  const cancelled = cancelExportJob(jobId);
  const job = getExportJob(jobId);
  if (!job) {
    return Response.json({ error: "Job not found" }, { status: 404 });
  }
  return Response.json({ ok: true, cancelled, job: toPublicJob(job) });
}
