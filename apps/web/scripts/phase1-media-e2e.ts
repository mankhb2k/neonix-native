import { createHash } from "node:crypto";
import { execFile as nodeExecFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  createFfprobeMediaProbeV3,
  prepareMediaJob,
  type MediaObjectStore,
  type MediaPrepareResult,
} from "@motionvideo/render-native";

const execFile = promisify(nodeExecFile);
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, "..", "..", "..");
const sourcePath = join(repoRoot, "apps", "web", "public", "preview", "video", "demo-video.mp4");
const outputDirectory = join(repoRoot, "tmp", "phase1-media-e2e");
const reportPath = join(repoRoot, "tmp", "phase1-media-e2e.json");

function sha256(body: Buffer): string {
  return `sha256:${createHash("sha256").update(body).digest("hex")}`;
}

async function probeFile(path: string): Promise<Record<string, unknown>> {
  const result = await execFile(process.env.FFPROBE_PATH?.trim() || "ffprobe", [
    "-v", "error", "-show_streams", "-show_format", "-of", "json", path,
  ], { maxBuffer: 4 * 1024 * 1024 });
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

function now(): number {
  return performance.now();
}

async function main(): Promise<void> {
const source = await readFile(sourcePath);
const objects = new Map<string, Buffer>([["media/phase1/video/origin.mp4", source]]);
const storeTimings: Array<{ operation: string; key: string; milliseconds: number; bytes: number }> = [];
const ffmpegTimings: Array<{ milliseconds: number; args: string[] }> = [];
const store: MediaObjectStore = {
  async getObject(key) {
    const started = now();
    const body = objects.get(key) ?? null;
    storeTimings.push({ operation: "get", key, milliseconds: now() - started, bytes: body?.byteLength ?? 0 });
    return body;
  },
  async putObject(input) {
    const started = now();
    objects.set(input.key, input.body);
    storeTimings.push({ operation: "put", key: input.key, milliseconds: now() - started, bytes: input.body.byteLength });
  },
};

let probeMilliseconds = 0;
let callbackPayload: MediaPrepareResult | undefined;
const probe = createFfprobeMediaProbeV3({
  run: async (args) => {
    const started = now();
    const result = await execFile(process.env.FFPROBE_PATH?.trim() || "ffprobe", args, { maxBuffer: 4 * 1024 * 1024 });
    probeMilliseconds += now() - started;
    return result.stdout;
  },
});

const startedAt = now();
const result = await prepareMediaJob({
  jobId: "phase1-public-video",
  assetId: "phase1-public-video",
  sourceKey: "media/phase1/video/origin.mp4",
  sourceMimeType: "video/mp4",
  mediaKind: "video",
  derivativePrefix: "media/phase1/video",
  sourceIntegrity: sha256(source),
  callbackUrl: "https://example.invalid/internal/media-jobs/callback",
}, {
  store,
  probe,
  runFfmpeg: async (args) => {
    const started = now();
    await execFile(process.env.FFMPEG_PATH?.trim() || "ffmpeg", args, { maxBuffer: 4 * 1024 * 1024 });
    ffmpegTimings.push({ milliseconds: now() - started, args: [...args] });
  },
  callback: async (_url, payload) => { callbackPayload = payload; },
});

await mkdir(outputDirectory, { recursive: true });
const derivativeProbes: Record<string, unknown> = {};
for (const derivative of result.derivatives) {
  const body = objects.get(derivative.uri);
  if (!body) throw new Error(`Derivative was not written to the object store: ${derivative.uri}`);
  const path = join(outputDirectory, derivative.uri.split("/").at(-1) ?? "derivative.bin");
  await writeFile(path, body);
  derivativeProbes[derivative.kind] = await probeFile(path);
}

const report = {
  fixture: "apps/web/public/preview/video/demo-video.mp4",
  sourceBytes: source.byteLength,
  sourceIntegrity: sha256(source),
  elapsedMilliseconds: now() - startedAt,
  probeMilliseconds,
  ffmpegTimings,
  storeTimings,
  result,
  callbackStatus: callbackPayload?.status,
  derivativeProbes,
  generatedAt: new Date().toISOString(),
};
await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

if (result.status !== "ready" || callbackPayload?.status !== "ready") {
  throw new Error(`Phase 1 media E2E failed: ${result.status}`);
}

console.log(JSON.stringify({
  ok: true,
  fixture: report.fixture,
  sourceBytes: report.sourceBytes,
  elapsedMilliseconds: Math.round(report.elapsedMilliseconds),
  probeMilliseconds: Math.round(report.probeMilliseconds),
  ffmpegMilliseconds: Math.round(report.ffmpegTimings.reduce((sum, item) => sum + item.milliseconds, 0)),
  streams: result.streams.map((stream) => stream.kind),
  derivatives: result.derivatives.map((derivative) => ({ kind: derivative.kind, uri: derivative.uri, bytes: derivative.byteSize })),
  reportPath,
}, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
