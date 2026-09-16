import { createHash } from "node:crypto";
import { mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { evaluateRuntimeProjectV3, type PaintCommand, type PaintCommandBuffer } from "@motionvideo/motion-runtime";
import { createNativeExportSmokeProject } from "./testing";

const fps = 30;
const durationSeconds = positiveNumber(process.env.BENCHMARK_DURATION_SECONDS, 60);
const frameCount = positiveInteger(process.env.BENCHMARK_FRAMES, Math.ceil(durationSeconds * fps));
const width = 1920;
const height = 1080;
const outputPath = resolve(process.env.BENCHMARK_OUTPUT ?? "/tmp/native-skia-command-cpu.mp4");
const nativeBinary = process.env.NATIVE_SKIA_BINARY ?? "/usr/local/bin/neonix-skia-command-cpu-backend";
const ffmpegPath = process.env.FFMPEG_PATH ?? "ffmpeg";

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

function writeMatrix(writer: BinaryWriter, matrix: readonly number[]): void {
  if (matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value))) {
    throw new Error("Native benchmark protocol requires a finite Matrix4");
  }
  for (const value of matrix) writer.f64(value);
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
    if (command.shape === "polygon") throw new Error(`Native benchmark protocol does not support polygon ${command.key}`);
    writer.u8(3);
    writer.u8(command.shape === "rectangle" ? 1 : 2);
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
const project = createNativeExportSmokeProject(durationSeconds);
const appStarted = performance.now();
const native = spawn(nativeBinary, ["--raw"], { stdio: ["pipe", "pipe", "pipe"] });
const ffmpeg = spawn(ffmpegPath, [
  "-y", "-hide_banner", "-loglevel", process.env.FFMPEG_LOG_LEVEL ?? "error",
  "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${width}x${height}`,
  "-r", String(fps), "-i", "pipe:0",
  "-map", "0:v:0", "-an",
  "-c:v", "libx264", "-preset", process.env.FFMPEG_PRESET ?? "veryfast",
  "-threads", process.env.FFMPEG_THREADS ?? "1",
  "-pix_fmt", "yuv420p", "-t", String(durationSeconds), "-movflags", "+faststart", outputPath,
], { stdio: ["pipe", "ignore", "pipe"] });

let nativeStderr = "";
let ffmpegStderr = "";
native.stderr?.on("data", (chunk: Buffer) => { nativeStderr += chunk.toString(); });
ffmpeg.stderr?.on("data", (chunk: Buffer) => { ffmpegStderr += chunk.toString(); });
native.stdout?.pipe(ffmpeg.stdin!);

const nativeExit = waitForChild(native, "native Skia");
const ffmpegExit = waitForChild(ffmpeg, "FFmpeg");
const protocolStarted = performance.now();
let protocolEncodeMilliseconds = 0;
let protocolBackpressureMilliseconds = 0;
let frameEvaluateMilliseconds = 0;

const header = new BinaryWriter();
header.bytes(Buffer.from("NXSKIA01", "ascii"));
header.u32(width);
header.u32(height);
header.u32(frameCount);
protocolBackpressureMilliseconds += await writeWithBackpressure(native, header.finish());

for (let frame = 0; frame < frameCount; frame += 1) {
  const evaluateStarted = performance.now();
  const evaluated = evaluateRuntimeProjectV3(project, frame);
  frameEvaluateMilliseconds += performance.now() - evaluateStarted;
  const encodeStarted = performance.now();
  const encoded = encodeFrame(frame, evaluated);
  protocolEncodeMilliseconds += performance.now() - encodeStarted;
  protocolBackpressureMilliseconds += await writeWithBackpressure(native, encoded);
}
const endStream = new BinaryWriter();
endStream.u8(0);
protocolBackpressureMilliseconds += await writeWithBackpressure(native, endStream.finish());
native.stdin?.end();

const [nativeCode, ffmpegCode] = await Promise.all([nativeExit, ffmpegExit]);
if (nativeCode !== 0 || ffmpegCode !== 0) {
  throw new Error(JSON.stringify({
    nativeCode,
    ffmpegCode,
    nativeStderr,
    ffmpegStderr,
  }));
}

const output = await stat(outputPath);
const outputHash = createHash("sha256");
const file = await import("node:fs").then(({ createReadStream }) => createReadStream(outputPath));
await new Promise<void>((resolveHash, rejectHash) => {
  file.on("data", (chunk) => outputHash.update(chunk));
  file.once("error", rejectHash);
  file.once("end", () => resolveHash());
});
const nativeLines = nativeStderr.trim().split(/\r?\n/).filter(Boolean);
const nativeMetrics = JSON.parse(nativeLines.at(-1) ?? "{}") as {
  timingsMs?: Record<string, number>;
  [key: string]: unknown;
};
const finished = performance.now();
console.log(JSON.stringify({
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
  outputPath,
  outputBytes: output.size,
  outputSha256: outputHash.digest("hex"),
  timingsMs: {
    applicationWall: finished - appStarted,
    protocolEncode: protocolEncodeMilliseconds,
    protocolBackpressure: protocolBackpressureMilliseconds,
    evaluate: frameEvaluateMilliseconds,
    nativeProcess: nativeMetrics.timingsMs?.totalProcess ?? null,
    nativeProtocolDecode: nativeMetrics.timingsMs?.protocolDecode ?? null,
    nativeRender: nativeMetrics.timingsMs?.render ?? null,
    nativeReadback: nativeMetrics.timingsMs?.readback ?? null,
    nativeRawWrite: nativeMetrics.timingsMs?.rawWrite ?? null,
    ffmpegPipeline: finished - protocolStarted,
  },
  nativeMetrics,
}));
