/**
 * V2 compiler/runtime -> Remotion paint-tree parity harness.
 *
 * The filename is retained for the existing root command, but this harness
 * intentionally has no Pixi or Protocol V1 dependency.
 * Usage: pnpm test:parity
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileProtocolV2 } from "@motionvideo/motion-compiler";
import {
  evaluateRuntimeProjectV2,
  type RuntimeFrameV2,
} from "@motionvideo/motion-runtime";
import {
  createV2OverlapProject,
  createV2ShapeProject,
} from "@motionvideo/motion-compiler/testing";
import {
  buildRemotionPaintTree,
  flattenRemotionDrawables,
} from "../packages/remotion-renderer/src/build-remotion-paint-tree";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const outRoot = path.join(repoRoot, "tmp", "parity-v2-remotion");

function paintDigest(frame: RuntimeFrameV2): string {
  return JSON.stringify(frame.commands);
}

async function main() {
  await mkdir(outRoot, { recursive: true });
  const cases = [
    compileProtocolV2(createV2OverlapProject("parity-v2-overlap")),
    compileProtocolV2(createV2ShapeProject({ id: "parity-v2-ellipse", shape: "ellipse" })),
  ];
  const report = cases.flatMap((runtime) =>
    [0, 15, 60].map((frame) => {
      const evaluated = evaluateRuntimeProjectV2(runtime, frame);
      const tree = buildRemotionPaintTree(evaluated);
      const drawables = flattenRemotionDrawables(tree);
      const expected = evaluated.commands.filter((command) => command.op === "drawShape");
      const structuralMatch = drawables.length === expected.length;
      return {
        id: runtime.id,
        frame,
        digest: paintDigest(evaluated),
        drawableCount: drawables.length,
        expectedCount: expected.length,
        structuralMatch,
      };
    }),
  );
  await writeFile(
    path.join(outRoot, "report.json"),
    `${JSON.stringify({ protocol: 2, report }, null, 2)}\n`,
    "utf8",
  );
  const failed = report.filter((row) => !row.structuralMatch);
  if (failed.length) {
    throw new Error(`V2 Remotion parity mismatch: ${JSON.stringify(failed)}`);
  }
  console.log(`[parity:v2] ok - ${report.length} samples in ${outRoot}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
