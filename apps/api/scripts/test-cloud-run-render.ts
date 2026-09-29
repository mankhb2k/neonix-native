// One-off connectivity check against the real, already-deployed Cloud Run
// export renderer (unrelated to the Supabase->Neon migration - this service
// already runs independently of apps/web/apps/api). Dispatches a minimal
// stub RuntimeProjectV3 (empty scene, no assets) and polls until done/failed.
//
// Usage: EXPORT_RENDERER_URL=... INTERNAL_WORKER_TOKEN=... pnpm exec tsx scripts/test-cloud-run-render.ts
import { orthographicProjectionMatrix, type RuntimeProjectV3 } from "@motionvideo/motion-runtime";
import { RENDER_PRESET_SPECS } from "@motionvideo/render-native/contracts";

function workerBaseUrl(): string {
  const value = process.env.EXPORT_RENDERER_URL?.trim().replace(/\/$/, "");
  if (!value) throw new Error("EXPORT_RENDERER_URL is not configured");
  return value;
}

function workerHeaders(): Record<string, string> {
  const token = process.env.INTERNAL_WORKER_TOKEN?.trim();
  return { "content-type": "application/json", ...(token ? { "x-internal-worker-token": token } : {}) };
}

function buildStubRuntimeProjectV3(projectId: string): RuntimeProjectV3 {
  const spec = RENDER_PRESET_SPECS["export-1080p"];
  const worldToClipMatrix = orthographicProjectionMatrix(spec.width, spec.height, 1, 1, 4000);
  return {
    format: "motion-runtime",
    runtimeVersion: 3,
    projectId,
    durationUs: 500_000,
    visual: {
      composition: { width: spec.width, height: spec.height, fps: spec.fps, background: "#000000", graphId: projectId },
      view: { worldToClipMatrix },
      nodes: [],
    },
    mediaCatalog: { assets: [] },
    videoTimeline: { instances: [] },
    audioTimeline: { sampleRate: 48000, tracks: [] },
  };
}

async function main() {
  const baseUrl = workerBaseUrl();
  const jobId = `api-migration-smoke-${Date.now().toString(36)}`;
  const project = buildStubRuntimeProjectV3(jobId);

  console.log(`[cloud-run-test] dispatching job ${jobId} to ${baseUrl}`);
  const dispatchResponse = await fetch(`${baseUrl}/v1/render-jobs`, {
    method: "POST",
    headers: workerHeaders(),
    body: JSON.stringify({ jobId, project, outputName: `${jobId}.mp4`, attempt: 1 }),
    signal: AbortSignal.timeout(10_000),
  });
  const dispatchPayload = await dispatchResponse.json();
  console.log("[cloud-run-test] dispatch response", dispatchResponse.status, dispatchPayload);
  if (!dispatchResponse.ok) throw new Error(`dispatch failed with HTTP ${dispatchResponse.status}`);

  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const statusResponse = await fetch(`${baseUrl}/v1/render-jobs/${encodeURIComponent(jobId)}`, {
      headers: workerHeaders(),
      signal: AbortSignal.timeout(10_000),
    });
    const statusPayload = await statusResponse.json();
    const status = statusPayload?.job?.status;
    console.log(`[cloud-run-test] poll status=${status} progress=${statusPayload?.job?.progress}`);
    if (status === "done" || status === "failed" || status === "cancelled") {
      console.log("[cloud-run-test] final job payload", JSON.stringify(statusPayload, null, 2));
      process.exit(status === "done" ? 0 : 1);
    }
  }
  console.error("[cloud-run-test] timed out waiting for job completion");
  process.exit(1);
}

void main();
