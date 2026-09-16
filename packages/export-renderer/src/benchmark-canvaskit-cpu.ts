import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createNativeExportSmokeProject } from "./testing";
import { renderRuntimeProjectV3 } from "./render/render";

const durationSeconds = Number(process.env.BENCHMARK_DURATION_SECONDS ?? 60);
const fps = 30;
const frameCount = Number(process.env.BENCHMARK_FRAMES ?? Math.ceil(durationSeconds * fps));
const outputPath = resolve(process.env.BENCHMARK_OUTPUT ?? "/tmp/canvaskit-cpu.mp4");
const sampleFrames = new Set([0, Math.floor(frameCount / 2), frameCount - 1]);
const rawSampleHashes: Record<string, string> = {};
function hashRawFrame(pixels: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (const byte of pixels) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  return hash.toString(16).padStart(8, "0");
}
function updateRawFrameHash(pixels: Uint8Array, frame: number): void {
  if (sampleFrames.has(frame)) rawSampleHashes[String(frame)] = hashRawFrame(pixels);
}
await mkdir(dirname(outputPath), { recursive: true });

const stats = await renderRuntimeProjectV3(
  createNativeExportSmokeProject(durationSeconds),
  {
    outputPath,
    renderer: "skia",
    frameCount,
    parallelism: 1,
    ffmpegPreset: process.env.FFMPEG_PRESET ?? "veryfast",
    ffmpegLogLevel: "error",
    onFrameReadback: updateRawFrameHash,
  },
);
const outputSha256 = createHash("sha256").update(await readFile(outputPath)).digest("hex");
console.log(JSON.stringify({ benchmark: "canvaskit-wasm-cpu-cloud-run", outputSha256, rawSampleHashFnv1a32: rawSampleHashes, ...stats }));
