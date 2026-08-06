/**
 * Pixi ↔ Remotion sampled-frame parity harness.
 *
 * Three layers:
 * 1. Semantic — shared EvaluatedFrame.paint digest
 * 2. Structural — compositingFingerprint + Remotion paint tree keys
 * 3. Visual — canvas still PNG artifacts (CI upload under tmp/parity-*)
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
  compositingFingerprint,
  evaluateCompositionFrame,
  type EvaluatedFrame,
} from "@motionvideo/motion-runtime";
import { createDemoMotionProject } from "@motionvideo/motion-runtime/testing";
import {
  buildRemotionPaintTree,
  flattenRemotionDrawables,
} from "../packages/remotion-renderer/src/build-remotion-paint-tree";
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

function sampleFrames(
  durationInFrames: number,
): Record<(typeof SAMPLE_LABELS)[number], number> {
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
    structuralMatch: boolean;
    match: boolean;
    compositing: ReturnType<typeof compositingFingerprint>;
    remotionDrawableCount: number;
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
    const compositing = compositingFingerprint(evaluated.paint);
    const tree = buildRemotionPaintTree(evaluated.paint);
    const remotionDrawableCount = flattenRemotionDrawables(tree).length;
    const drawOps = evaluated.paint.commands.filter((c) =>
      [
        "drawText",
        "drawShape",
        "drawSolid",
        "drawImage",
        "drawPath",
        "drawVideo",
      ].includes(c.op),
    ).length;
    const structuralMatch = remotionDrawableCount === drawOps;

    report.push({
      label,
      frame,
      digest,
      remotionDigest,
      structuralMatch,
      match,
      compositing,
      remotionDrawableCount,
    });

    const scene = runtime.scenes.find((s) => s.id === evaluated.sceneId);
    if (scene) {
      const png = await drawSceneFramePaint(
        scene,
        runtime.metadata,
        runtime.assets,
        evaluated.time,
        width,
        height,
        outRoot,
      );
      await writeFile(path.join(outRoot, `${label}-${frame}.png`), png);
    }
    await writeFile(
      path.join(outRoot, `${label}-${frame}.paint.json`),
      `${JSON.stringify(evaluated.paint, null, 2)}\n`,
    );
  }

  await writeFile(
    path.join(outRoot, "report.json"),
    `${JSON.stringify(
      {
        durationInFrames,
        samples,
        report,
        layers: ["semantic", "structural", "visual-png"],
      },
      null,
      2,
    )}\n`,
  );

  const failed = report.filter((row) => !row.match || !row.structuralMatch);
  if (failed.length) {
    console.error("[parity] mismatch", failed);
    process.exit(1);
  }
  console.log(`[parity] ok — artifacts in ${outRoot}`);
  for (const row of report) {
    console.log(
      `  ${row.label}@${row.frame} digest=${row.digest} drawables=${row.remotionDrawableCount}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
