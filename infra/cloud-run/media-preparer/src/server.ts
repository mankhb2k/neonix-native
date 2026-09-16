import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { prepareMediaJob, type MediaPrepareRequest } from "../../../../packages/export-renderer/src/media/media-worker";

const port = Number(process.env.PORT ?? process.env.MEDIA_PREPARER_PORT ?? 8080);
const maxBodyBytes = 64 * 1024;

function json(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > maxBodyBytes) throw new Error("request body too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function suppliedToken(request: IncomingMessage): string | undefined {
  const value = request.headers["x-internal-worker-token"];
  return (Array.isArray(value) ? value[0] : value)?.trim();
}

function authorized(request: IncomingMessage): boolean {
  const expected = process.env.INTERNAL_WORKER_TOKEN?.trim();
  return Boolean(expected && suppliedToken(request) === expected);
}

function safePath(value: string, label: string): string {
  const normalized = value.trim().replaceAll("\\", "/");
  const prefix = process.env.MEDIA_SOURCE_PREFIX?.trim().replace(/^\/+|\/+$/g, "") || "media";
  if (!normalized || normalized.startsWith("/") || normalized.includes("..") || !normalized.startsWith(`${prefix}/`)) {
    throw new Error(`${label} must stay under ${prefix}/`);
  }
  return normalized;
}

function callbackUrl(value: string): string {
  const parsed = new URL(value);
  if (!(["http:", "https:"].includes(parsed.protocol))) throw new Error("callback URL must use HTTP(S)");
  const allowedHosts = (process.env.MEDIA_CALLBACK_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (allowedHosts.length > 0 && !allowedHosts.includes(parsed.host.toLowerCase())) {
    throw new Error("callback host is not allow-listed");
  }
  return parsed.toString();
}

function validateRequest(value: unknown): MediaPrepareRequest {
  if (!value || typeof value !== "object") throw new Error("invalid JSON body");
  const body = value as Record<string, unknown>;
  const requiredString = (name: string): string => {
    const field = body[name];
    if (typeof field !== "string" || !field.trim()) throw new Error(`${name} is required`);
    return field.trim();
  };
  const mediaKind = body.mediaKind;
  if (mediaKind !== undefined && mediaKind !== "audio" && mediaKind !== "video") throw new Error("invalid mediaKind");
  const pipelineVersion = body.pipelineVersion;
  if (pipelineVersion !== undefined && (!Number.isInteger(pipelineVersion) || Number(pipelineVersion) < 1)) {
    throw new Error("invalid pipelineVersion");
  }
  const assetId = requiredString("assetId");
  const jobId = requiredString("jobId");
  if (!/^[a-zA-Z0-9._-]+$/.test(assetId) || !/^[a-zA-Z0-9._-]+$/.test(jobId)) throw new Error("invalid job or asset id");
  const sourceKey = safePath(requiredString("sourceKey"), "sourceKey");
  const derivativePrefix = body.derivativePrefix === undefined
    ? sourceKey.slice(0, Math.max(0, sourceKey.lastIndexOf("/")))
    : safePath(String(body.derivativePrefix), "derivativePrefix");
  return {
    jobId,
    assetId,
    sourceKey,
    sourceMimeType: requiredString("sourceMimeType"),
    ...(mediaKind ? { mediaKind } : {}),
    derivativePrefix,
    sourceIntegrity: requiredString("sourceIntegrity"),
    callbackUrl: callbackUrl(requiredString("callbackUrl")),
    ...(pipelineVersion !== undefined ? { pipelineVersion: Number(pipelineVersion) } : {}),
  };
}

async function handlePrepare(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (!authorized(request)) {
    json(response, process.env.INTERNAL_WORKER_TOKEN ? 401 : 503, { ok: false, error: "unauthorized" });
    return;
  }

  let job: MediaPrepareRequest;
  try {
    job = validateRequest(await readJson(request));
  } catch (error) {
    json(response, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
    return;
  }

  const startedAt = performance.now();
  try {
    const result = await prepareMediaJob(job);
    json(response, result.status === "failed" ? 500 : 200, {
      ok: result.status !== "failed",
      jobId: result.jobId,
      assetId: result.assetId,
      status: result.status,
      derivatives: result.derivatives.map((derivative) => ({ kind: derivative.kind, uri: derivative.uri, byteSize: derivative.byteSize })),
      elapsedMilliseconds: Math.round(performance.now() - startedAt),
    });
  } catch (error) {
    console.error("[media-preparer] job failed", { jobId: job.jobId, assetId: job.assetId, error });
    json(response, 503, { ok: false, error: "media_prepare_unavailable", jobId: job.jobId });
  }
}

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`).pathname;
    if (request.method === "GET" && ["/health", "/healthz", "/readyz"].includes(pathname)) {
      json(response, 200, { ok: true, service: "media-preparer", ffmpeg: process.env.FFMPEG_PATH ?? "ffmpeg", pipelineVersion: 1 });
      return;
    }
    if (request.method === "POST" && pathname === "/v1/media/prepare") {
      await handlePrepare(request, response);
      return;
    }
    json(response, 404, { ok: false, error: "not_found" });
  } catch (error) {
    json(response, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

server.headersTimeout = 60_000;
server.requestTimeout = Number(process.env.MEDIA_PREPARER_REQUEST_TIMEOUT_MS ?? 3_600_000);
server.listen(port, "0.0.0.0", () => {
  console.log(JSON.stringify({ service: "media-preparer", port, concurrency: 1, pipelineVersion: 1 }));
});
