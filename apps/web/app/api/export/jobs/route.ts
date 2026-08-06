import { parseMotionProject } from "@motionvideo/motion-schema";
import { validateMotionProjectPresets } from "@motionvideo/motion-compiler";
import {
  startExportJob,
  toPublicJob,
} from "@/lib/editor/export/export-job-registry";

export const runtime = "nodejs";
export const maxDuration = 300;

/** POST /api/export/jobs — enqueue persistent export job, return jobId. */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let project;
  try {
    project = parseMotionProject(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid Motion project";
    return Response.json({ error: message }, { status: 400 });
  }

  const presetCheck = validateMotionProjectPresets(project);
  if (!presetCheck.ok) {
    const detail = presetCheck.unknown
      .map((u) => `${u.sceneId}/${u.nodeId}:${u.preset}`)
      .join(", ");
    return Response.json(
      { error: `Unknown animation presets: ${detail}` },
      { status: 400 },
    );
  }

  const job = await startExportJob(project);
  return Response.json({ ok: true, job: toPublicJob(job) }, { status: 202 });
}
