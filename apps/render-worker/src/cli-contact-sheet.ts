/** Protocol V2 contact sheet renderer for AI critic and local inspection. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileProtocolV2 } from "@motionvideo/motion-compiler";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";
import {
  evaluateRuntimeProjectV2,
  frameIndexAtTime,
} from "@motionvideo/motion-runtime";
import {
  rasterRuntimeFrameV2,
  runtimeProjectV2Duration,
} from "./runtime/render-v2";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function contactSheetSize(composition: { width: number; height: number }): {
  width: number;
  height: number;
} {
  const maxDim = Math.max(composition.width, composition.height);
  if (maxDim <= 640) return composition;
  const scale = 640 / maxDim;
  return {
    width: Math.round(composition.width * scale),
    height: Math.round(composition.height * scale),
  };
}

async function main(): Promise<void> {
  const mtPath = process.argv[2];
  if (!mtPath) {
    console.log(JSON.stringify({ ok: false, error: "Usage: cli-contact-sheet <protocol-v2.json> [outDir]" }));
    process.exitCode = 1;
    return;
  }
  const outDir = resolve(process.argv[3] ?? resolve(REPO_ROOT, "tmp", "ai-contact-sheets", String(Date.now())));
  await mkdir(outDir, { recursive: true });

  const protocol = MotionProtocolV2Schema.parse(JSON.parse(await readFile(resolve(mtPath), "utf8")) as unknown);
  const runtime = compileProtocolV2(protocol);
  const duration = runtimeProjectV2Duration(runtime);
  if (!(duration > 0)) {
    console.log(JSON.stringify({ ok: false, error: "No V2 layers with positive timing" }));
    process.exitCode = 1;
    return;
  }

  const { width, height } = contactSheetSize(runtime.composition);
  const fractions = [0, 0.1, 0.5, 0.85, Math.max(0, 1 - 1 / Math.max(1, runtime.composition.fps))];
  const frames: Array<{ time: number; path: string }> = [];
  for (const fraction of fractions) {
    const time = Math.min(Math.max(0, duration - 1e-4), Math.max(0, duration * fraction));
    const frameIndex = frameIndexAtTime(time, runtime.composition.fps);
    const frame = evaluateRuntimeProjectV2(runtime, frameIndex, { time });
    const png = rasterRuntimeFrameV2(frame, width, height);
    const file = resolve(outDir, `t${time.toFixed(3).replace(".", "_")}.png`);
    await writeFile(file, png);
    frames.push({ time, path: file });
  }
  console.log(JSON.stringify({ ok: true, outDir, frames, graphId: runtime.id, runtimeVersion: 2 }));
}

main().catch((error: unknown) => {
  console.log(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
