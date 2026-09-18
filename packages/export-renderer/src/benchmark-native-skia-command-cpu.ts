import { createHash } from "node:crypto";
import { mkdir, open as openFile, readFile, stat, type FileHandle } from "node:fs/promises";
import { closeSync, existsSync, openSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { evaluateRuntimeProjectV3, type PaintCommand, type PaintCommandBuffer, type PaintFill, type RuntimeProjectV3 } from "@motionvideo/motion-runtime";
import { compileDocument } from "../../html-compiler/src/index";
import { compileAndPrepareRuntimeProjectV3 } from "../../../apps/web/lib/server/render/project-runtime";
import { HTML_COMPILER_PREVIEW_FONT_ASSETS } from "../../../apps/web/lib/docs/html-compiler-preview";
import { createNativeColorCardProject, createNativeColorSuiteProject, createNativeExportSmokeProject } from "./testing";

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

class BinaryWriter {
  private readonly chunks: Buffer[] = [];

  u8(value: number): void {
    const buffer = Buffer.allocUnsafe(1);
    buffer.writeUInt8(value, 0);
    this.chunks.push(buffer);
  }

  u32(value: number): void {
    const buffer = Buffer.allocUnsafe(4);
    buffer.writeUInt32LE(value >>> 0, 0);
    this.chunks.push(buffer);
  }

  f64(value: number): void {
    const buffer = Buffer.allocUnsafe(8);
    buffer.writeDoubleLE(value, 0);
    this.chunks.push(buffer);
  }

  bytes(value: Uint8Array): void {
    this.chunks.push(Buffer.from(value));
  }

  string(value: string): void {
    const encoded = Buffer.from(value, "utf8");
    this.u32(encoded.byteLength);
    this.bytes(encoded);
  }

  finish(): Buffer {
    return Buffer.concat(this.chunks);
  }
}

function color(value: string): [number, number, number, number] {
  const hex = value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [
      Number.parseInt(hex.slice(0, 2), 16) / 255,
      Number.parseInt(hex.slice(2, 4), 16) / 255,
      Number.parseInt(hex.slice(4, 6), 16) / 255,
      1,
    ];
  }
  if (/^[0-9a-f]{8}$/i.test(hex)) {
    return [
      Number.parseInt(hex.slice(0, 2), 16) / 255,
      Number.parseInt(hex.slice(2, 4), 16) / 255,
      Number.parseInt(hex.slice(4, 6), 16) / 255,
      Number.parseInt(hex.slice(6, 8), 16) / 255,
    ];
  }
  throw new Error(`Native benchmark protocol only supports hex colors: ${value}`);
}

function writeColor(writer: BinaryWriter, value: string): void {
  for (const channel of color(value)) writer.f64(channel);
}

/** Versioned native subset for text paints. Solid/none are represented by the
 * existing color field; gradients carry their geometry and stops explicitly. */
function writePaint(writer: BinaryWriter, paint: PaintFill | undefined): void {
  if (!paint || paint.type === "none" || paint.type === "solid") {
    writer.u8(0);
    return;
  }
  if (paint.type === "pattern") {
    throw new Error("Native text export does not support pattern paints yet");
  }
  writer.u8(paint.type === "linear-gradient" ? 1 : paint.type === "radial-gradient" ? 2 : 3);
  const values = [paint.x1, paint.y1, paint.x2, paint.y2, paint.angle, paint.from, paint.cx, paint.cy, paint.radius, paint.radiusX, paint.radiusY, paint.fx, paint.fy, paint.fr];
  for (const value of values) writer.f64(value ?? Number.NaN);
  writer.u8(paint.spreadMethod === "reflect" ? 1 : paint.spreadMethod === "repeat" ? 2 : 0);
  writer.u8(paint.gradientUnits === "userSpaceOnUse" ? 1 : 0);
  const transform = paint.gradientTransform;
  writer.u8(transform ? 1 : 0);
  if (transform) for (const value of [transform.a, transform.b, transform.c, transform.d, transform.e, transform.f]) writer.f64(value);
  writer.u32(paint.stops.length);
  for (const stop of paint.stops) {
    writer.f64(stop.offset);
    writeColor(writer, stop.color);
    writer.f64(stop.stopOpacity ?? 1);
  }
}

function writeMatrix(writer: BinaryWriter, matrix: readonly number[]): void {
  if (matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value))) {
    throw new Error("Native benchmark protocol requires a finite Matrix4");
  }
  for (const value of matrix) writer.f64(value);
}

function writePath(writer: BinaryWriter, contours: Extract<PaintCommand, { op: "drawPath" }>["contours"]): void {
  writer.u32(contours.length);
  for (const contour of contours) {
    writer.f64(contour.start.x);
    writer.f64(contour.start.y);
    writer.u32(contour.segments.length);
    writer.u8(contour.closed ? 1 : 0);
    for (const segment of contour.segments) {
      if (segment.kind === "line") {
        writer.u8(1); writer.f64(segment.to.x); writer.f64(segment.to.y);
      } else if (segment.kind === "quadratic") {
        writer.u8(2); writer.f64(segment.control.x); writer.f64(segment.control.y); writer.f64(segment.to.x); writer.f64(segment.to.y);
      } else if (segment.kind === "cubic") {
        writer.u8(3); writer.f64(segment.control1.x); writer.f64(segment.control1.y); writer.f64(segment.control2.x); writer.f64(segment.control2.y); writer.f64(segment.to.x); writer.f64(segment.to.y);
      } else {
        writer.u8(4); writer.f64(segment.radii.x); writer.f64(segment.radii.y); writer.f64(segment.rotation);
        writer.u8(segment.largeArc ? 1 : 0); writer.u8(segment.sweep ? 1 : 0);
        writer.f64(segment.to.x); writer.f64(segment.to.y);
      }
    }
  }
}

function writeCommand(writer: BinaryWriter, command: PaintCommand): void {
  if (command.op === "beginFrame") {
    writer.u8(1);
    writer.u32(command.width);
    writer.u32(command.height);
    writer.u8(command.background === undefined ? 0 : 1);
    if (command.background !== undefined) writeColor(writer, command.background);
    writeMatrix(writer, command.projection.worldToClipMatrix);
    return;
  }
  if (command.op === "setTransform") {
    writer.u8(2);
    writeMatrix(writer, command.matrix4);
    writer.f64(command.alpha);
    writer.u8(command.visible ? 1 : 0);
    return;
  }
  if (command.op === "drawShape") {
    writer.u8(3);
    writer.u8(command.shape === "rectangle" ? 1 : command.shape === "ellipse" ? 2 : 3);
    writer.f64(command.width);
    writer.f64(command.height);
    writer.u8(1);
    writeColor(writer, command.fill);
    writer.f64(command.fillOpacity ?? 1);
    writer.u8(command.cornerRadius === undefined ? 0 : 1);
    if (command.cornerRadius !== undefined) writer.f64(command.cornerRadius);
    writer.u8(command.stroke === undefined ? 0 : 1);
    if (command.stroke !== undefined) writeColor(writer, command.stroke);
    writer.f64(command.strokeWidth ?? 0);
    writer.f64(command.strokeOpacity ?? 1);
    writer.u32(command.points?.length ?? 0);
    for (const point of command.points ?? []) { writer.f64(point.x); writer.f64(point.y); }
    return;
  }
  if (command.op === "drawSolid") {
    writer.u8(10);
    writeColor(writer, command.fill);
    writer.f64(command.width);
    writer.f64(command.height);
    return;
  }
  if (command.op === "drawPath") {
    writer.u8(5);
    writePath(writer, command.contours);
    writer.u8(command.fill === undefined ? 0 : 1);
    if (command.fill !== undefined) writeColor(writer, command.fill);
    writer.f64(command.fillOpacity ?? 1);
    writer.u8(command.stroke === undefined ? 0 : 1);
    if (command.stroke !== undefined) writeColor(writer, command.stroke);
    writer.f64(command.strokeWidth ?? 0);
    writer.f64(command.strokeOpacity ?? 1);
    writer.u8(command.fillRule === "evenodd" ? 1 : 0);
    return;
  }
  if (command.op === "drawText") {
    writer.u8(7);
    writer.u32(command.glyphs?.length ?? 0);
    writeColor(writer, command.fill);
    writePaint(writer, command.fillPaint);
    for (const glyph of command.glyphs ?? []) {
      writer.string(glyph.path);
      writer.f64(glyph.x); writer.f64(glyph.y); writer.f64(glyph.pathScale);
      writer.f64(glyph.outline.x); writer.f64(glyph.outline.y);
      writer.f64(glyph.rotation ?? 0); writer.f64(glyph.scaleX ?? 1);
      writer.u8(glyph.fill === undefined ? 0 : 1);
      if (glyph.fill !== undefined) writeColor(writer, glyph.fill);
      writePaint(writer, glyph.fillPaint);
      writer.u8(glyph.stroke === undefined ? 0 : 1);
      if (glyph.stroke !== undefined) writeColor(writer, glyph.stroke);
      writer.f64(glyph.strokeWidth ?? 0); writer.f64(glyph.strokeOpacity ?? 1);
    }
    return;
  }
  if (command.op === "beginGroup") { writer.u8(4); return; }
  if (command.op === "endGroup") { writer.u8(6); return; }
  if (command.op === "beginLayer") {
    writer.u8(8);
    writer.u8(command.offscreen || command.isolation ? 1 : 0);
    writer.f64(command.compositeAlpha ?? 1);
    return;
  }
  if (command.op === "endLayer") {
    writer.u8(9);
    return;
  }
  if (command.op === "endFrame") {
    writer.u8(0xff);
    return;
  }
  throw new Error(`Native benchmark protocol does not support ${command.op}`);
}

function encodeFrame(frame: number, buffer: PaintCommandBuffer): Buffer {
  const writer = new BinaryWriter();
  writer.u8(0xf1);
  writer.u32(frame);
  writer.u32(buffer.commands.length);
  for (const command of buffer.commands) writeCommand(writer, command);
  return writer.finish();
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
  protocolBackpressureMilliseconds += await writeWithBackpressure(native, value);
}

if (protocolTransport === "file") protocolFile = await openFile(protocolPath, "w");

const header = new BinaryWriter();
  // NXSKIA02 adds versioned text fill-paint payloads after command/glyph fill colors.
  header.bytes(Buffer.from("NXSKIA02", "ascii"));
header.u32(width);
header.u32(height);
header.u32(frameCount);
await writeProtocolChunk(header.finish());

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
const endStream = new BinaryWriter();
endStream.u8(0);
await writeProtocolChunk(endStream.finish());
if (protocolFile) {
  await protocolFile.close();
  protocolFile = null;
}
if (protocolTransport === "file") spawnNative();
if (protocolTransport === "pipe") native!.stdin?.end();

const nativeCode = await (nativeExit ?? Promise.reject(new Error("Native Skia process was not started")));
if (typeof nativeStdoutMode === "number") closeSync(nativeStdoutMode);
const encodeStarted = performance.now();
if (benchmarkMode === "encode-file") {
  ffmpeg = spawnFfmpeg("file");
  attachFfmpegStderr(ffmpeg);
}
const ffmpegCode = ffmpeg ? await waitForChild(ffmpeg, "FFmpeg") : null;
const encodeMilliseconds = ffmpeg ? performance.now() - encodeStarted : 0;
if (nativeCode !== 0 || ffmpegCode !== null && ffmpegCode !== 0) {
  throw new Error(JSON.stringify({
    nativeCode,
    ffmpegCode,
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
