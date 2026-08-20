/** Local V2 render-worker -> PNG sequence -> MP4 smoke test. */
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { compileProtocolV2 } from "@motionvideo/motion-compiler";
import { encodeOutputs, resolveFfmpegPath } from "./ffmpeg";
import {
  renderRuntimeProjectV2,
  runtimeProjectV2Aspect,
} from "./runtime/render-v2";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function smokeProtocol(id: string) {
  return {
    format: "motion-protocol" as const,
    formatVersion: 2 as const,
    id,
    composition: {
      width: 320,
      height: 180,
      fps: 12,
      background: "#101820",
      colorSpace: "srgb" as const,
      audioSampleRate: 48000,
    },
    layers: [
      {
        id: "back",
        type: "shape" as const,
        parentLayerId: null,
        zIndex: 0,
        frame: { width: 220, height: 120 },
        transform: {
          translate: { x: 30, y: 30, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          rotate: { x: 0, y: 0, z: 0 },
          skew: { x: 0, y: 0 },
          anchor: { x: 0, y: 0, z: 0 },
        },
        opacity: 100,
        timing: { start: 0, duration: 2 },
        payload: { shape: "rectangle" as const },
        style: { fill: "#00aa88" },
      },
      {
        id: "front",
        type: "shape" as const,
        parentLayerId: null,
        zIndex: 1,
        frame: { width: 120, height: 80 },
        transform: {
          translate: { x: 120, y: 60, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          rotate: { x: 0, y: 0, z: 0 },
          skew: { x: 0, y: 0 },
          anchor: { x: 0, y: 0, z: 0 },
        },
        opacity: 100,
        timing: { start: 0, duration: 2 },
        payload: { shape: "ellipse" as const },
        style: { fill: "#ff3366" },
      },
    ],
  };
}

function probe(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(resolveFfmpegPath(), ["-i", file], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (data: Buffer) => (stderr += data.toString()));
    child.on("close", () => resolve(stderr));
    child.on("error", reject);
  });
}

async function main(): Promise<void> {
  const runtime = compileProtocolV2(smokeProtocol(`render-worker-v2-${Date.now()}`));
  const outDir = path.join(REPO_ROOT, "tmp", "render-worker-v2-smoke");
  await mkdir(outDir, { recursive: true });
  const rendered = await renderRuntimeProjectV2(runtime, {
    fps: runtime.composition.fps,
    outDir: path.join(outDir, "frames"),
  });
  const files = await encodeOutputs(rendered, runtimeProjectV2Aspect(runtime));
  const mp4 = files[0]!.path;
  const info = await stat(mp4);
  const probeOutput = await probe(mp4);
  if (info.size < 1000 || !/Video:/i.test(probeOutput)) {
    throw new Error("V2 render-worker MP4 smoke failed");
  }
  console.log(`[e2e] V2 render OK: ${mp4} (${(info.size / 1024).toFixed(1)} KB)`);
}

main().catch((error: unknown) => {
  console.error("[e2e] V2 render failed", error);
  process.exit(1);
});
