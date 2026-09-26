import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { HtmlCompilerFontAsset } from "@motionvideo/html-compiler";
import { closeSharedBrowser, runLayoutProbeJob, type LayoutProbeJobRequest } from "./probe-worker";

const port = Number(process.env.PORT ?? process.env.LAYOUT_PROBE_PORT ?? 8080);
const maxBodyBytes = 8 * 1024 * 1024; // real HTML documents, larger than media-preparer's small job payloads

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

function validateFontAsset(value: unknown, index: number): HtmlCompilerFontAsset {
  if (!value || typeof value !== "object") throw new Error(`fontAssets[${index}] must be an object`);
  const asset = value as Record<string, unknown>;
  const requiredString = (name: string): string => {
    const field = asset[name];
    if (typeof field !== "string" || !field.trim()) throw new Error(`fontAssets[${index}].${name} is required`);
    return field;
  };
  const weight = asset.weight;
  if (typeof weight !== "number" || !Number.isFinite(weight)) throw new Error(`fontAssets[${index}].weight must be a number`);
  const style = asset.style;
  if (style !== "normal" && style !== "italic" && style !== "oblique") throw new Error(`fontAssets[${index}].style is invalid`);
  return {
    id: requiredString("id"),
    kind: "font",
    uri: requiredString("uri"),
    weight,
    style,
    family: requiredString("family"),
    integrity: requiredString("integrity"),
    ...(typeof asset.stretch === "string" ? { stretch: asset.stretch as HtmlCompilerFontAsset["stretch"] } : {}),
    ...(typeof asset.mimeType === "string" ? { mimeType: asset.mimeType as HtmlCompilerFontAsset["mimeType"] } : {}),
  };
}

function validateRequest(value: unknown): LayoutProbeJobRequest {
  if (!value || typeof value !== "object") throw new Error("invalid JSON body");
  const body = value as Record<string, unknown>;
  const jobId = body.jobId;
  if (typeof jobId !== "string" || !jobId.trim()) throw new Error("jobId is required");
  const html = body.html;
  if (typeof html !== "string" || !html.trim()) throw new Error("html is required");
  const rawFontAssets = body.fontAssets;
  const fontAssets = rawFontAssets === undefined ? undefined : (Array.isArray(rawFontAssets) ? rawFontAssets : (() => { throw new Error("fontAssets must be an array"); })()).map((item, index) => validateFontAsset(item, index));
  return { jobId, html, ...(fontAssets ? { fontAssets } : {}) };
}

async function handleProbe(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (!authorized(request)) {
    json(response, process.env.INTERNAL_WORKER_TOKEN ? 401 : 503, { ok: false, error: "unauthorized" });
    return;
  }

  let job: LayoutProbeJobRequest;
  try {
    job = validateRequest(await readJson(request));
  } catch (error) {
    json(response, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
    return;
  }

  try {
    const result = await runLayoutProbeJob(job);
    json(response, 200, { ok: true, jobId: result.jobId, snapshot: result.snapshot, elapsedMilliseconds: result.elapsedMilliseconds });
  } catch (error) {
    console.error("[layout-probe] job failed", { jobId: job.jobId, error });
    json(response, 503, { ok: false, error: "layout_probe_unavailable", jobId: job.jobId });
  }
}

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`).pathname;
    if (request.method === "GET" && ["/health", "/healthz", "/readyz"].includes(pathname)) {
      json(response, 200, { ok: true, service: "layout-probe" });
      return;
    }
    if (request.method === "POST" && pathname === "/v1/layout/probe") {
      await handleProbe(request, response);
      return;
    }
    json(response, 404, { ok: false, error: "not_found" });
  } catch (error) {
    json(response, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

server.headersTimeout = 60_000;
server.requestTimeout = Number(process.env.LAYOUT_PROBE_REQUEST_TIMEOUT_MS ?? 30_000);
server.listen(port, "0.0.0.0", () => {
  console.log(JSON.stringify({ service: "layout-probe", port, concurrency: 1 }));
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close(() => {
      void closeSharedBrowser().finally(() => process.exit(0));
    });
  });
}
