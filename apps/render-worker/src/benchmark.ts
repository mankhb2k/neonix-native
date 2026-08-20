import { stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { compileProtocolV2 } from "@motionvideo/motion-compiler";
import { encodeOutputs, resolveFfmpegPath } from "./ffmpeg";
import { createSmokeProtocolV2 } from "./fixtures/smoke-project";
import {
  renderRuntimeProjectV2,
  runtimeProjectV2Aspect,
} from "./runtime/render-v2";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

function probe(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(resolveFfmpegPath(), ["-i", file], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (data: Buffer) => (stderr += data.toString()));
    child.on("close", () => resolve(stderr));
    child.on("error", reject);
  });
}

async function main() {
  const runtime = compileProtocolV2(createSmokeProtocolV2(String(Date.now())));
  const outDir = path.join(REPO_ROOT, "tmp", "frames", runtime.id);

  const renderStart = performance.now();
  const rendered = await renderRuntimeProjectV2(runtime, {
    outDir,
    fps: runtime.composition.fps,
  });
  const renderMs = performance.now() - renderStart;

  const encodeStart = performance.now();
  const files = await encodeOutputs(rendered, runtimeProjectV2Aspect(runtime));
  const encodeMs = performance.now() - encodeStart;
  const mp4 = files[0]!.path;
  const info = await stat(mp4);
  const probeOut = await probe(mp4);
  const videoMatch = probeOut.match(/Video:\s*([^\n]+)/);
  const totalMs = renderMs + encodeMs;
  const duration = rendered.durationSec;

  console.log("=== V2 RENDER BENCHMARK ===");
  console.log(`Resolution: ${rendered.width}x${rendered.height} @ ${rendered.fps}fps`);
  console.log(`Frames: ${rendered.frameCount} | Duration: ${duration}s`);
  console.log(`MP4: ${(info.size / 1024).toFixed(1)} KB`);
  console.log(`Codec: ${videoMatch?.[1]?.trim() ?? "?"}`);
  console.log(`Raster: ${(renderMs / 1000).toFixed(2)}s`);
  console.log(`Encode: ${(encodeMs / 1000).toFixed(2)}s`);
  console.log(`Realtime factor: ${(totalMs / 1000 / duration).toFixed(2)}x`);
}

main().catch((error) => {
  console.error("[bench] FAILED", error);
  process.exit(1);
});
