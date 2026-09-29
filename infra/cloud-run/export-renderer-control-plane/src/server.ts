import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { GoogleAuth } from "google-auth-library";
import { prepareMediaJob, type MediaPrepareRequest } from "@motionvideo/render-native";

// The Cloud Run **Service** role for export-renderer: a thin control plane
// with no rendering of its own. It only (1) triggers a real Cloud Run Job
// execution (the actual render happens in packages/render-worker, deployed
// separately from infra/cloud-run/export-renderer/skia-command-cpu-bench),
// and (2) proxies media-prepare requests into render-native's media worker.
// This used to be one route among many inside packages/render-native/src/
// api/server.ts, which also had a whole legacy in-process render/job-store
// path (FileRenderJobStore, local MP4 rendering, /v1/render-jobs, /v1/outputs)
// - that path was already permanently disabled in production
// (EXPORT_RENDERER_CONTROL_PLANE_ONLY=1 made every one of those routes
// return 410) and has been deleted rather than moved, along with the
// abandoned distributed chunk-render feature (render-chunk-job.ts/
// render-finalizer-job.ts/runtime-manifest.ts/chunk-manifest.ts - gated by
// RENDER_CHUNK_EXECUTION_ENABLED=false in every environment).

const port = Number(process.env.PORT ?? 8080);

function readJson(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolveJson, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      try {
        resolveJson(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body));
}

function authorizeWorker(request: IncomingMessage): boolean {
  const expected = process.env.INTERNAL_WORKER_TOKEN?.trim();
  const supplied = request.headers["x-internal-worker-token"];
  const token = (Array.isArray(supplied) ? supplied[0] : supplied)?.trim();
  return Boolean(expected && token && token === expected);
}

async function submitCloudRunRenderJob(jobId: string): Promise<{ name?: string; uid?: string }> {
  const project = process.env.CLOUD_RUN_PROJECT_ID?.trim();
  const region = process.env.CLOUD_RUN_REGION?.trim();
  const jobName = process.env.CLOUD_RUN_JOB_NAME?.trim();
  if (!project || !region || !jobName) throw new Error("Cloud Run Job configuration is incomplete");
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  const endpoint = `https://run.googleapis.com/v2/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(region)}/jobs/${encodeURIComponent(jobName)}:run`;
  const response = await client.request<{ name?: string; uid?: string }>({
    url: endpoint,
    method: "POST",
    data: { overrides: { containerOverrides: [{ env: [{ name: "RENDER_JOB_ID", value: jobId }] }] } },
  });
  return response.data;
}

export function createControlPlaneServer(options: {
  mediaPrepare?: (input: MediaPrepareRequest) => Promise<unknown>;
} = {}) {
  const mediaPrepare = options.mediaPrepare ?? prepareMediaJob;
  return createServer({ requestTimeout: 0, headersTimeout: 0 }, async (request, response) => {
    try {
      if (request.method === "GET" && ["/health", "/healthz", "/readyz"].includes(request.url ?? "")) {
        json(response, 200, { ok: true, service: "export-renderer-control-plane" });
        return;
      }
      const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

      if (request.method === "POST" && requestUrl.pathname === "/v1/media/prepare") {
        if (!authorizeWorker(request)) {
          json(response, process.env.INTERNAL_WORKER_TOKEN?.trim() ? 401 : 503, {
            ok: false,
            error: process.env.INTERNAL_WORKER_TOKEN?.trim() ? "unauthorized" : "worker_auth_not_configured",
          });
          return;
        }
        const body = (await readJson(request)) as Partial<MediaPrepareRequest>;
        if (!body.jobId || !body.assetId || !body.sourceKey || !body.sourceMimeType || !body.sourceIntegrity || !body.callbackUrl) {
          json(response, 400, { ok: false, error: "invalid_media_prepare_request" });
          return;
        }
        let callbackUrl: URL;
        try {
          callbackUrl = new URL(body.callbackUrl);
          if (!["http:", "https:"].includes(callbackUrl.protocol)) throw new Error("unsupported callback protocol");
        } catch {
          json(response, 400, { ok: false, error: "invalid_callback_url" });
          return;
        }
        const job = {
          jobId: body.jobId,
          assetId: body.assetId,
          sourceKey: body.sourceKey,
          sourceMimeType: body.sourceMimeType,
          ...(body.mediaKind ? { mediaKind: body.mediaKind } : {}),
          ...(body.derivativePrefix ? { derivativePrefix: body.derivativePrefix } : {}),
          sourceIntegrity: body.sourceIntegrity,
          callbackUrl: callbackUrl.toString(),
          ...(body.pipelineVersion ? { pipelineVersion: body.pipelineVersion } : {}),
        } satisfies MediaPrepareRequest;
        void mediaPrepare(job).catch((error) => {
          // The worker reports normal media failures through the callback. This
          // log only covers a callback or infrastructure failure after dispatch.
          console.error("[export-renderer-control-plane] media job failed", { jobId: job.jobId, error });
        });
        json(response, 202, { ok: true, jobId: job.jobId, status: "processing" });
        return;
      }

      if (request.method === "POST" && requestUrl.pathname === "/v1/render-job-executions") {
        if (!authorizeWorker(request)) {
          json(response, 401, { ok: false, error: "unauthorized" });
          return;
        }
        const body = (await readJson(request)) as { jobId?: string };
        if (!body.jobId || !/^[a-zA-Z0-9._-]+$/.test(body.jobId)) {
          json(response, 400, { ok: false, error: "job_id_required" });
          return;
        }
        const execution = await submitCloudRunRenderJob(body.jobId);
        json(response, 202, { ok: true, jobId: body.jobId, execution });
        return;
      }

      json(response, 404, { ok: false, error: "not_found" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      json(response, 500, { ok: false, error: message });
    }
  });
}

if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  createControlPlaneServer().listen(port, "0.0.0.0", () => {
    console.log(`export-renderer-control-plane listening on http://0.0.0.0:${port}`);
  });
}
