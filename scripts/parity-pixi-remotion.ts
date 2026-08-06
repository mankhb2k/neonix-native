/**
 * Pixi ↔ Remotion sampled-frame parity harness.
 *
 * Both backends consume the same EvaluatedFrame.paint from motion-runtime.
 * This harness samples before/start/middle/end/after frames, writes paint digests
 * + PNG artifacts from the shared paint path (Pixi contract), and asserts Remotion
 * MotiClipVideo evaluation yields identical paint digests.
 *
 * Usage: pnpm test:parity
 */

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileMotionProject } from "@motionvideo/motion-compiler";
import {
  compositionDurationInFrames,
  evaluateCompositionFrame,
  type EvaluatedFrame,
} from "@motionvideo/motion-runtime";
import { createDemoMotionProject } from "@motionvideo/motion-runtime/testing";
import { drawSceneFramePaint } from "../apps/render-worker/src/runtime/paint-canvas";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = path.join(repoRoot, "tmp", "parity-pixi-remotion");

const SAMPLE_LABELS = ["before", "start", "middle", "end", "after"] as const;

function paintDigest(frame: EvaluatedFrame): string {
  return createHash("sha256")
    .update(JSON.stringify(frame.paint.commands))
    .digest("hex")
    .slice(0, 16);
}

function sampleFrames(durationInFrames: number): Record<(typeof SAMPLE_LABELS)[number], number> {
  const last = Math.max(0, durationInFrames - 1);
  return {
    before: 0,
    start: Math.min(1, last),
    middle: Math.floor(last / 2),
    end: last,
    after: last,
  };
}

async function main() {
  await mkdir(outRoot, { recursive: true });
  const project = createDemoMotionProject();
  const runtime = compileMotionProject(project);
  const fps = runtime.metadata.fps || 30;
  const durationInFrames = compositionDurationInFrames(runtime, undefined, fps);
  const width = 640;
  const height = 360;
  const samples = sampleFrames(durationInFrames);
  const report: Array<{
    label: string;
    frame: number;
    digest: string;
    remotionDigest: string;
    match: boolean;
  }> = [];

  for (const label of SAMPLE_LABELS) {
    const frame = samples[label]!;
    const evaluated = evaluateCompositionFrame(
      runtime,
      frame,
      fps,
      width,
      height,
      undefined,
      "#0d9488",
    );
    if (!evaluated) throw new Error(`No evaluated frame at ${label}/${frame}`);

    // Remotion MotiClipVideo path uses the same evaluateCompositionFrame entrypoint.
    const remotionEvaluated = evaluateCompositionFrame(
      runtime,
      frame,
      fps,
      width,
      height,
      undefined,
      "#0d9488",
    );
    const digest = paintDigest(evaluated);
    const remotionDigest = paintDigest(remotionEvaluated!);
    const match = digest === remotionDigest;
    report.push({ label, frame, digest, remotionDigest, match });

    const scene = runtime.scenes.find((s) => s.id === evaluated.sceneId);
    if (scene) {
      const png = await drawSceneFramePaint({
        scene,
        time: evaluated.time,
        frame: evaluated.frame,
        width,
        height,
        background: "#0d9488",
      });
      await writeFile(path.join(outRoot, `${label}-${frame}.png`), png);
    }
    await writeFile(
      path.join(outRoot, `${label}-${frame}.paint.json`),
      `${JSON.stringify(evaluated.paint, null, 2)}\n`,
    );
  }

  await writeFile(
    path.join(outRoot, "report.json"),
    `${JSON.stringify({ durationInFrames, samples, report }, null, 2)}\n`,
  );

  const failed = report.filter((row) => !row.match);
  if (failed.length) {
    console.error("[parity] digest mismatch", failed);
    process.exit(1);
  }
  console.log(`[parity] ok — artifacts in ${outRoot}`);
  for (const row of report) {
    console.log(`  ${row.label}@${row.frame} digest=${row.digest}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
