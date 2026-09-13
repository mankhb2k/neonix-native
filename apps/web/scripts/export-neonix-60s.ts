import { mkdir, readFile, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { basename, dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { compileDocument } from "@motionvideo/html-compiler";
import { HTML_COMPILER_PREVIEW_FONT_ASSETS } from "../lib/docs/html-compiler-preview";
import { compileAndPrepareRuntimeProjectV3 } from "../lib/server/render/project-runtime";

type WorkerStats = {
  frames: number;
  outputBytes: number;
  renderMilliseconds: number;
  encodeMilliseconds: number;
};

type WorkerResponse = {
  ok: boolean;
  stats?: WorkerStats;
  outputName?: string;
  downloadUrl?: string;
  error?: string;
};

function postJsonWithoutTimeout(urlString: string, body: unknown): Promise<{ statusCode: number; payload: WorkerResponse }> {
  const url = new URL(urlString);
  const encoded = Buffer.from(JSON.stringify(body), "utf8");
  return new Promise((resolve, reject) => {
    const request = httpRequest(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": encoded.length,
      },
      timeout: 0,
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve({
            statusCode: response.statusCode ?? 0,
            payload: JSON.parse(Buffer.concat(chunks).toString("utf8")) as WorkerResponse,
          });
        } catch (error) {
          reject(error);
        }
      });
      response.on("error", reject);
    });
    request.setTimeout(0);
    request.on("error", reject);
    request.end(encoded);
  });
}

function repoRoot(): string {
  const cwd = resolve(process.cwd());
  return basename(cwd).toLowerCase() === "web" ? resolve(cwd, "../..") : cwd;
}

function requiredProtocol(result: ReturnType<typeof compileDocument>): NonNullable<ReturnType<typeof compileDocument>["protocol"]> {
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  if (result.status !== "success" || !result.protocol || errors.length > 0) {
    const details = result.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`).join(" | ");
    throw new Error(`Unable to compile Neonix 60s fixture: ${details || "unknown compiler error"}`);
  }
  return result.protocol;
}

async function main(): Promise<void> {
  const root = repoRoot();
  const sourceFile = join(root, "docs", "preview", "html-compiler", "export-samples", "neonix-overview-60s.html");
  const outputRoot = join(root, "tmp");
  const runtimeFile = join(outputRoot, "neonix-overview-60s.runtime.json");
  const benchmarkFile = join(outputRoot, "neonix-overview-60s.benchmark.json");
  const outputName = process.env.NEONIX_RENDER_OUTPUT ?? "neonix-overview-60s.mp4";
  const rendererUrl = (process.env.NEONIX_RENDERER_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");

  await mkdir(outputRoot, { recursive: true });
  const html = await readFile(sourceFile, "utf8");
  const compileStarted = performance.now();
  const compiled = compileDocument(
    { html, fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS },
    { composition: { durationMs: 60_000, id: "neonix-overview-60s" } },
  );
  const protocol = requiredProtocol(compiled);
  const runtime = await compileAndPrepareRuntimeProjectV3(protocol);
  const compileMilliseconds = performance.now() - compileStarted;
  await writeFile(runtimeFile, `${JSON.stringify(runtime, null, 2)}\n`, "utf8");

  const renderStarted = performance.now();
  const response = await postJsonWithoutTimeout(`${rendererUrl}/v1/renders`, { project: runtime, outputName });
  const payload = response.payload;
  if (response.statusCode < 200 || response.statusCode >= 300 || !payload.ok || !payload.stats || !payload.downloadUrl) {
    throw new Error(`Renderer failed (${response.statusCode}): ${payload.error ?? JSON.stringify(payload)}`);
  }
  const workerResponseReceived = performance.now();

  const downloadStarted = performance.now();
  const artifactResponse = await fetch(`${rendererUrl}${payload.downloadUrl}`);
  if (!artifactResponse.ok || !artifactResponse.body) {
    throw new Error(`Renderer output download failed (${artifactResponse.status})`);
  }
  const artifact = Buffer.from(await artifactResponse.arrayBuffer());
  const artifactFile = join(outputRoot, outputName);
  await writeFile(artifactFile, artifact);

  const benchmark = {
    contract: "HTML -> Protocol V2 -> Runtime V3 -> Docker export renderer -> MP4",
    fixture: sourceFile,
    runtimeFile,
    artifactFile,
    rendererUrl,
    requestedDurationSeconds: 60,
    expectedFrames: Math.ceil((runtime.visual.composition.duration ?? 0) * runtime.visual.composition.fps),
    composition: runtime.visual.composition,
    compileDiagnostics: compiled.diagnostics,
    timings: {
      compileAndPrepareMilliseconds: Math.round(compileMilliseconds),
      workerRequestMilliseconds: Math.round(workerResponseReceived - renderStarted),
      downloadMilliseconds: Math.round(performance.now() - downloadStarted),
      endToEndMilliseconds: Math.round(performance.now() - compileStarted),
      workerRenderMilliseconds: payload.stats.renderMilliseconds,
      workerEncodeMilliseconds: payload.stats.encodeMilliseconds,
    },
    worker: payload.stats,
    artifact: {
      file: artifactFile,
      bytes: artifact.length,
      contentType: artifactResponse.headers.get("content-type"),
    },
  };
  await writeFile(benchmarkFile, `${JSON.stringify(benchmark, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(benchmark, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
