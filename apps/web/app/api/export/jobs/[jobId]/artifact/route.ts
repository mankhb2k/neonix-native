import {
  getExportJob,
} from "@/lib/editor/export/export-job-registry";

export const runtime = "nodejs";

type Params = { params: Promise<{ jobId: string }> };

/** GET /api/export/jobs/[jobId]/artifact — download MP4 when ready. */
export async function GET(
  _request: Request,
  { params }: Params,
): Promise<Response> {
  const { jobId } = await params;
  const job = getExportJob(jobId);
  if (!job) {
    return Response.json({ error: "Job not found" }, { status: 404 });
  }
  if (job.status !== "done" || !job.artifactBytes?.length) {
    return Response.json(
      { error: "Artifact not ready", status: job.status },
      { status: 409 },
    );
  }
  return new Response(new Uint8Array(job.artifactBytes), {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${job.projectId}.mp4"`,
      "Cache-Control": "no-store",
    },
  });
}
