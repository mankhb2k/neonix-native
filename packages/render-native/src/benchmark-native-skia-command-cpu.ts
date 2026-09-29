import { createHash } from "node:crypto";
import { mkdir, open as openFile, readFile, stat, type FileHandle } from "node:fs/promises";
import { closeSync, existsSync, openSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { evaluateRuntimeProjectV3, type RuntimeProjectV3 } from "@motionvideo/motion-runtime";
import { compileDocument } from "../../html-compiler/src/index";
import { compileAndPrepareRuntimeProjectV3 } from "../../../apps/web/lib/server/render/project-runtime";
import { HTML_COMPILER_PREVIEW_FONT_ASSETS } from "../../../apps/web/lib/docs/html-compiler-preview";
import { createNativeColorCardProject, createNativeColorSuiteProject, createNativeExportSmokeProject } from "./testing";
import { encodeEndOfStream, encodeFrame, encodeProtocolHeader } from "./render/native-protocol";

const requestedDurationSeconds = positiveNumber(process.env.BENCHMARK_DURATION_SECONDS, 60);
const requestedFrameCount = positiveInteger(process.env.BENCHMARK_FRAMES, Math.ceil(requestedDurationSeconds * 30));
const outputPath = resolve(process.env.BENCHMARK_OUTPUT ?? "/tmp/native-skia-command-cpu.mp4");
const nativeBinary = process.env.NATIVE_SKIA_BINARY ?? "/usr/local/bin/neonix-skia-command-cpu-backend";
const ffmpegPath = process.env.FFMPEG_PATH ?? "ffmpeg";
type BenchmarkMode = "pipe" | "render-only" | "raw-file" | "encode-file" | "in-process";
const benchmarkMode = (process.env.BENCHMARK_MODE?.trim() || "pipe") as BenchmarkMode;
if (!["pipe", "render-only", "raw-file", "encode-file", "in-process"].includes(benchmarkMode)) {
  throw new Error(`Unsupported BENCHMARK_MODE: ${benchmarkMode}`);
}
const rawPath = resolve(process.env.BENCHMARK_RAW_OUTPUT ?? "/tmp/native-skia-command-cpu.rgba");
const fixtureId = process.env.BENCHMARK_FIXTURE_ID?.trim();
const runtimeJsonPath = process.env.BENCHMARK_RUNTIME_JSON_PATH?.trim();
type ColorConverterName = "swscale" | "libyuv";
// Native production images are libyuv-only. The sandbox sets this explicitly
// to swscale when it runs the fallback/control binary.
const colorConverter = (process.env.BENCHMARK_COLOR_CONVERTER?.trim() || "libyuv") as ColorConverterName;
if (!["swscale", "libyuv"].includes(colorConverter)) {
  throw new Error(`Unsupported BENCHMARK_COLOR_CONVERTER: ${colorConverter}`);
}
const compareColor = (process.env.BENCHMARK_COMPARE_COLOR?.trim() || "false") === "true";
const swsFilter = (process.env.BENCHMARK_SWS_FILTER?.trim() || "bilinear") as "bilinear" | "area" | "fast-bilinear" | "point";
if (!["bilinear", "area", "fast-bilinear", "point"].includes(swsFilter)) {
  throw new Error(`Unsupported BENCHMARK_SWS_FILTER: ${swsFilter}`);
}
type SurfaceMode = "copy" | "direct-raster";
const surfaceMode = (process.env.BENCHMARK_SURFACE_MODE?.trim() || "copy") as SurfaceMode;
if (!["copy", "direct-raster"].includes(surfaceMode)) {
  throw new Error(`Unsupported BENCHMARK_SURFACE_MODE: ${surfaceMode}`);
}
const benchmarkScene = process.env.BENCHMARK_SCENE?.trim() || "smoke";
if (!["smoke", "color-card", "color-suite"].includes(benchmarkScene)) {
  throw new Error(`Unsupported BENCHMARK_SCENE: ${benchmarkScene}`);
}
const colorSuiteTest = (process.env.BENCHMARK_COLOR_TEST?.trim() || "primary") as "primary" | "memory" | "grayscale" | "alpha" | "chroma" | "stride";
if (!["primary", "memory", "grayscale", "alpha", "chroma", "stride"].includes(colorSuiteTest)) {
  throw new Error(`Unsupported BENCHMARK_COLOR_TEST: ${colorSuiteTest}`);
}
const protocolBatchFrames = positiveInteger(process.env.BENCHMARK_PROTOCOL_BATCH_FRAMES, 1);
type ProtocolTransport = "pipe" | "file";
const protocolTransport = (process.env.BENCHMARK_PROTOCOL_TRANSPORT?.trim() || "pipe") as ProtocolTransport;
if (!["pipe", "file"].includes(protocolTransport)) {
  throw new Error(`Unsupported BENCHMARK_PROTOCOL_TRANSPORT: ${protocolTransport}`);
}
const protocolPath = resolve(process.env.BENCHMARK_PROTOCOL_PATH ?? "/tmp/native-skia-command-cpu.protocol");

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  return Math.max(1, Math.floor(positiveNumber(value, fallback)));
}

function waitForChild(child: ChildProcess, name: string): Promise<number> {
  return new Promise((resolveExit, reject) => {
    child.once("error", (error) => reject(new Error(`${name} failed to start: ${String(error)}`)));
    child.once("close", (code) => resolveExit(code ?? 1));
  });
}

async function writeWithBackpressure(child: ChildProcess, value: Buffer): Promise<number> {
  const stdin = child.stdin;
  if (!stdin) throw new Error("Native Skia stdin is unavailable");
  if (!stdin.write(value)) {
    const started = performance.now();
    await new Promise<void>((resolveDrain, reject) => {
      const onDrain = () => {
        stdin.off("error", onError);
        resolveDrain();
      };
      const onError = (error: Error) => {
        stdin.off("drain", onDrain);
        reject(error);
      };
      stdin.once("drain", onDrain);
      stdin.once("error", onError);
    });
    return performance.now() - started;
  }
  return 0;
}

await mkdir(dirname(outputPath), { recursive: true });
await mkdir(dirname(rawPath), { recursive: true });
await mkdir(dirname(protocolPath), { recursive: true });
let project;
if (runtimeJsonPath) {
  project = JSON.parse(await readFile(resolve(runtimeJsonPath), "utf8")) as RuntimeProjectV3;
} else if (fixtureId) {
  const fixtureRootOverride = process.env.BENCHMARK_FIXTURE_ROOT?.trim();
  const fixtureRootCandidates = fixtureRootOverride
    ? [resolve(fixtureRootOverride)]
    : [
        resolve(process.cwd(), "apps/web/public/docs/benchmark"),
        resolve(process.cwd(), "../../apps/web/public/docs/benchmark"),
        resolve(process.cwd(), "../../../apps/web/public/docs/benchmark"),
      ];
  const fixtureRoot = fixtureRootCandidates.find((candidate) =>
    existsSync(resolve(candidate, "neonix-native-benchmark-fixtures.json")));
  if (!fixtureRoot) {
    throw new Error(`Fixture manifest not found. Checked: ${fixtureRootCandidates.join(", ")}`);
  }
  const manifest = JSON.parse(await readFile(resolve(fixtureRoot, "neonix-native-benchmark-fixtures.json"), "utf8")) as {
    fixtures: Array<{ id: string; source: string; durationMs: number; mediaAssets?: Array<{ uri: string; kind: "image" | "video" | "audio"; width?: number; height?: number; duration?: number; fps?: number; sampleRate?: number; channels?: number; mimeType?: string }> }>;
  };
  const fixture = manifest.fixtures.find((candidate) => candidate.id === fixtureId);
  if (!fixture) throw new Error(`Unknown BENCHMARK_FIXTURE_ID: ${fixtureId}`);
  const html = await readFile(resolve(fixtureRoot, fixture.source), "utf8");
  const compiled = compileDocument(
    { html, fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS, mediaAssets: fixture.mediaAssets },
    { composition: { durationMs: fixture.durationMs, id: fixture.id } },
  );
  if (compiled.status !== "success" || !compiled.protocol || compiled.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new Error(`Fixture compile failed: ${JSON.stringify(compiled.diagnostics)}`);
  }
  project = await compileAndPrepareRuntimeProjectV3(compiled.protocol);
} else {
  project = benchmarkScene === "color-card"
    ? createNativeColorCardProject(requestedDurationSeconds)
    : benchmarkScene === "color-suite"
      ? createNativeColorSuiteProject(colorSuiteTest, requestedDurationSeconds)
      : createNativeExportSmokeProject(requestedDurationSeconds);
}
const fps = project.visual.composition.fps;
const width = project.visual.composition.width;
const height = project.visual.composition.height;
const totalProjectFrames = Math.max(1, Math.ceil((project.visual.composition.duration ?? requestedDurationSeconds) * fps));
const startFrame = Math.max(0, Math.floor(Number(process.env.BENCHMARK_START_FRAME ?? 0)));
const requestedEndFrame = process.env.BENCHMARK_END_FRAME === undefined
  ? undefined
  : Math.floor(Number(process.env.BENCHMARK_END_FRAME));
const endFrameExclusive = requestedEndFrame ?? Math.min(totalProjectFrames, startFrame + requestedFrameCount);
if (!Number.isFinite(startFrame) || !Number.isFinite(endFrameExclusive)
  || startFrame >= endFrameExclusive || endFrameExclusive > totalProjectFrames) {
  throw new Error(`Invalid benchmark frame range ${startFrame}-${endFrameExclusive}; project has ${totalProjectFrames} frames`);
}
const frameCount = endFrameExclusive - startFrame;
const durationSeconds = frameCount / fps;
const appStarted = performance.now();
const nativeStdoutMode = benchmarkMode === "pipe" ? "pipe" : benchmarkMode === "raw-file" || benchmarkMode === "encode-file" ? openSync(rawPath, "w") : "ignore";
let native: ChildProcess | null = null;
let protocolFile: FileHandle | null = null;
let nativeExit: Promise<number> | null = null;
function spawnFfmpeg(input: "pipe" | "file"): ChildProcess {
  return spawn(ffmpegPath, [
    "-y", "-hide_banner", "-loglevel", process.env.FFMPEG_LOG_LEVEL ?? "error",
    "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${width}x${height}`,
    "-r", String(fps), "-i", input === "pipe" ? "pipe:0" : rawPath,
    "-map", "0:v:0", "-an",
    "-c:v", "libx264", "-preset", process.env.FFMPEG_PRESET ?? "veryfast",
    "-threads", process.env.FFMPEG_THREADS ?? "1",
    "-pix_fmt", "yuv420p", "-t", String(durationSeconds), "-movflags", "+faststart", outputPath,
  ], { stdio: [input === "pipe" ? "pipe" : "ignore", "ignore", "pipe"] });
}
let ffmpeg: ChildProcess | null = null;

let nativeStderr = "";
let ffmpegStderr = "";
// If the native Skia binary dies mid-render, the next stdin write fails with
// EPIPE. A Writable's 'error' event crashes the whole Node process when
// nothing is listening for it, bypassing every try/catch up the stack
// (including the caller's job-failure handling) - this listener turns that
// into an ordinary, catchable failure instead. Attached once per spawn,
// independent of writeWithBackpressure's own per-write backpressure wait.
let nativeStdinError: Error | undefined;
function spawnNative(): void {
  const args = [benchmarkMode === "render-only" || benchmarkMode === "in-process" ? "--no-raw" : "--raw"];
  if (benchmarkMode === "in-process") {
    args.push("--in-process", "--output", outputPath, "--converter", colorConverter);
    if (compareColor) args.push("--compare-color");
    if (colorConverter === "swscale") args.push("--sws-filter", swsFilter);
  } else if (benchmarkMode === "render-only") {
    args.push("--output", outputPath);
  }
  args.push("--surface-mode", surfaceMode);
  const nativeEnvironment = { ...process.env };
  const nativeLibraryPath = process.env.BENCHMARK_NATIVE_LD_LIBRARY_PATH?.trim();
  if (nativeLibraryPath) {
    nativeEnvironment.LD_LIBRARY_PATH = [nativeLibraryPath, process.env.LD_LIBRARY_PATH].filter(Boolean).join(":");
  }
  if (protocolTransport === "file") args.push("--input-file", protocolPath);
  native = spawn(nativeBinary, args, {
    stdio: [protocolTransport === "pipe" ? "pipe" : "ignore", nativeStdoutMode, "pipe"],
    env: nativeEnvironment,
  });
  native.stderr?.on("data", (chunk: Buffer) => { nativeStderr += chunk.toString(); });
  native.stdin?.on("error", (error: Error) => { nativeStdinError = error; });
  nativeExit = waitForChild(native, "native Skia");
  if (benchmarkMode === "pipe") {
    ffmpeg = spawnFfmpeg("pipe");
    attachFfmpegStderr(ffmpeg);
    native.stdout?.pipe(ffmpeg.stdin!);
  }
}
function attachFfmpegStderr(process: ChildProcess): void {
  process.stderr?.on("data", (chunk: Buffer) => { ffmpegStderr += chunk.toString(); });
}
if (protocolTransport === "pipe") spawnNative();
const protocolStarted = performance.now();
let protocolEncodeMilliseconds = 0;
let protocolBackpressureMilliseconds = 0;
let protocolFileWriteMilliseconds = 0;
let protocolBytes = 0;
let protocolWrites = 0;
let protocolFrameBytes = 0;
let protocolCommandCount = 0;
const protocolCommandCounts: Record<string, number> = {};
let protocolMinFrameBytes = Number.POSITIVE_INFINITY;
let protocolMaxFrameBytes = 0;
let frameEvaluateMilliseconds = 0;

async function writeProtocolChunk(value: Buffer): Promise<void> {
  protocolBytes += value.byteLength;
  protocolWrites += 1;
  if (protocolTransport === "file") {
    if (!protocolFile) throw new Error("Protocol file is unavailable");
    const started = performance.now();
    await protocolFile.write(value);
    protocolFileWriteMilliseconds += performance.now() - started;
    return;
  }
  if (!native) throw new Error("Native Skia process is unavailable");
  if (nativeStdinError) throw new Error(`Native Skia process closed its input: ${nativeStdinError.message}${nativeStderr.trim() ? ` | stderr: ${nativeStderr.trim()}` : ""}`);
  protocolBackpressureMilliseconds += await writeWithBackpressure(native, value);
}

if (protocolTransport === "file") protocolFile = await openFile(protocolPath, "w");

await writeProtocolChunk(encodeProtocolHeader(width, height, frameCount));

let protocolBatch: Buffer[] = [];
for (let frame = startFrame; frame < endFrameExclusive; frame += 1) {
  const evaluateStarted = performance.now();
  const evaluated = evaluateRuntimeProjectV3(project, frame);
  frameEvaluateMilliseconds += performance.now() - evaluateStarted;
  const encodeStarted = performance.now();
  const encoded = encodeFrame(frame, evaluated);
  protocolEncodeMilliseconds += performance.now() - encodeStarted;
  protocolFrameBytes += encoded.byteLength;
  protocolMinFrameBytes = Math.min(protocolMinFrameBytes, encoded.byteLength);
  protocolMaxFrameBytes = Math.max(protocolMaxFrameBytes, encoded.byteLength);
  protocolCommandCount += evaluated.commands.length;
  for (const command of evaluated.commands) {
    protocolCommandCounts[command.op] = (protocolCommandCounts[command.op] ?? 0) + 1;
  }
  protocolBatch.push(encoded);
  if (protocolBatch.length >= protocolBatchFrames || frame === endFrameExclusive - 1) {
    await writeProtocolChunk(Buffer.concat(protocolBatch));
    protocolBatch = [];
  }
}
await writeProtocolChunk(encodeEndOfStream());
if (protocolFile) {
  await protocolFile.close();
  protocolFile = null;
}
if (protocolTransport === "file") spawnNative();
if (protocolTransport === "pipe" && !nativeStdinError) native!.stdin?.end();

const nativeCode = await (nativeExit ?? Promise.reject(new Error("Native Skia process was not started")));
if (typeof nativeStdoutMode === "number") closeSync(nativeStdoutMode);
const encodeStarted = performance.now();
if (benchmarkMode === "encode-file") {
  ffmpeg = spawnFfmpeg("file");
  attachFfmpegStderr(ffmpeg);
}
const ffmpegCode = ffmpeg ? await waitForChild(ffmpeg, "FFmpeg") : null;
const encodeMilliseconds = ffmpeg ? performance.now() - encodeStarted : 0;
if (nativeCode !== 0 || ffmpegCode !== null && ffmpegCode !== 0 || nativeStdinError) {
  throw new Error(JSON.stringify({
    nativeCode,
    ffmpegCode,
    nativeStdinError: nativeStdinError?.message,
    nativeStderr,
    ffmpegStderr,
  }));
}

const output = ffmpeg || benchmarkMode === "in-process" ? await stat(outputPath) : null;
const rawOutput = benchmarkMode === "raw-file" || benchmarkMode === "encode-file" ? await stat(rawPath) : null;
const outputHash = createHash("sha256");
if (output) {
  const file = await import("node:fs").then(({ createReadStream }) => createReadStream(outputPath));
  await new Promise<void>((resolveHash, rejectHash) => {
    file.on("data", (chunk) => outputHash.update(chunk));
    file.once("error", rejectHash);
    file.once("end", () => resolveHash());
  });
}
const nativeLines = nativeStderr.trim().split(/\r?\n/).filter(Boolean);
let nativeMetrics: {
  timingsMs?: Record<string, number>;
  [key: string]: unknown;
} = {};
for (const line of [...nativeLines].reverse()) {
  if (!line.trimStart().startsWith("{")) continue;
  try {
    nativeMetrics = JSON.parse(line) as typeof nativeMetrics;
    break;
  } catch {
    // FFmpeg/native diagnostic lines can share stderr with the structured record.
  }
}
if (!nativeMetrics.ok) {
  throw new Error(`Native benchmark did not emit a valid metrics record: ${nativeStderr.trim()}`);
}
const finished = performance.now();
const benchmarkResult = {
  benchmark: "native-skia-command-buffer-cpu-cloud-run",
  projectId: project.projectId,
  requestedBackend: "skia-cpu-command-buffer",
  actualBackend: nativeMetrics.actualBackend ?? "unknown",
  softwareRenderer: nativeMetrics.softwareRenderer ?? true,
  width,
  height,
  fps,
  frames: frameCount,
  durationSeconds,
  benchmarkMode,
  colorConverter,
  swsFilter,
  compareColor,
  colorSuiteTest: benchmarkScene === "color-suite" ? colorSuiteTest : null,
  surfaceMode,
  benchmarkScene,
  protocolTransport,
  protocolBatchFrames,
  protocolBytes,
  protocolWrites,
  protocolFrameBytes,
  protocolCommandCount,
  protocolCommandCounts,
  protocolMinFrameBytes: Number.isFinite(protocolMinFrameBytes) ? protocolMinFrameBytes : 0,
  protocolMaxFrameBytes,
  outputPath: ffmpeg || benchmarkMode === "in-process" ? outputPath : null,
  outputBytes: output?.size ?? null,
  outputSha256: output ? outputHash.digest("hex") : null,
  libyuvRevision: process.env.LIBYUV_REVISION ?? null,
  yuvSampleHashFnv1a32: nativeMetrics.yuvSampleHashFnv1a32 ?? null,
  colorComparison: nativeMetrics.colorComparison ?? null,
  rawPath: rawOutput ? rawPath : null,
  rawBytes: rawOutput?.size ?? Number(nativeMetrics.bytesWritten ?? 0),
  timingsMs: {
    applicationWall: finished - appStarted,
    protocolEncode: protocolEncodeMilliseconds,
    protocolBackpressure: protocolBackpressureMilliseconds,
    protocolFileWrite: protocolFileWriteMilliseconds,
    evaluate: frameEvaluateMilliseconds,
    nativeProcess: nativeMetrics.timingsMs?.totalProcess ?? null,
    nativeProtocolOverhead: nativeMetrics.timingsMs?.protocolOverhead ?? null,
    nativeRender: nativeMetrics.timingsMs?.render ?? null,
    nativeComposite: nativeMetrics.timingsMs?.composite ?? null,
    nativeReadback: nativeMetrics.timingsMs?.readback ?? null,
    nativeRawWrite: nativeMetrics.timingsMs?.rawWrite ?? null,
    encode: benchmarkMode === "in-process" ? nativeMetrics.timingsMs?.encode ?? null : encodeMilliseconds,
    colorConvert: nativeMetrics.timingsMs?.colorConvert ?? null,
    mux: nativeMetrics.timingsMs?.mux ?? null,
    finalize: nativeMetrics.timingsMs?.finalize ?? null,
    ffmpegPipeline: finished - protocolStarted,
  },
  nativeMetrics,
};
const benchmarkResultJson = JSON.stringify(benchmarkResult);
console.log(benchmarkResultJson);
// Keep a plain text copy on stderr as well. Cloud Run's beta log reader can
// omit structured stdout lines, while stderr remains directly queryable.
console.error(`BENCHMARK_RESULT ${benchmarkResultJson}`);

if ((process.env.BENCHMARK_KEEP_RAW ?? "false") !== "true" && rawOutput) {
  try { unlinkSync(rawPath); } catch { /* best-effort cleanup of a benchmark artifact */ }
}
