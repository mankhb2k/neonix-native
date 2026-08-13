/**
 * Phase 3 — v1 fixture parity (Remotion side).
 *
 * The F3 multi-asset fixture is compiled and evaluated at three key frames.
 * The Remotion paint tree must consume the same evaluated `PaintCommandBuffer`
 * and produce exactly the draw keys defined by the buffer — the same keys the
 * Pixi painter produces, guaranteeing both painters render the same plan.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { compileMotionProjectV1 } from "@motionvideo/motion-compiler";
import {
  parseMotionProjectV1,
  type MotionRuntimeProject,
} from "@motionvideo/motion-protocol";
import {
  evaluateCompositionFrameV1,
  timelineTotalDuration,
} from "@motionvideo/motion-runtime";
import { paintParityDrawKeys } from "@motionvideo/motion-runtime/testing";
import {
  buildRemotionPaintTree,
  flattenRemotionDrawables,
} from "../build-remotion-paint-tree";

const projectFixtureDir = fileURLToPath(
  new URL("../../../motion-protocol/src/__fixtures__/v1", import.meta.url),
);

function loadMultiAsset(): MotionRuntimeProject {
  const file = path.join(projectFixtureDir, "multi-asset.project.json");
  const project = parseMotionProjectV1(JSON.parse(readFileSync(file, "utf8")));
  const result = compileMotionProjectV1(project);
  if (!result.ok) {
    throw new Error(
      result.diagnostics.map((diagnostic) => diagnostic.message).join("; "),
    );
  }
  return result.project;
}

function keyFrames(totalDuration: number, fps: number): number[] {
  const lastFrame = Math.max(0, Math.floor(totalDuration * fps) - 1);
  const middleFrame = Math.floor((totalDuration / 2) * fps);
  return [0, middleFrame, lastFrame];
}

describe("v3 fixture parity (Remotion)", () => {
  it("builds Remotion paint tree for multi-asset evaluated frames", () => {
    const runtime = loadMultiAsset();
    const fps = 30;
    const frames = keyFrames(timelineTotalDuration(runtime), fps);

    for (const frame of frames) {
      const evaluated = evaluateCompositionFrameV1(
        runtime,
        frame,
        fps,
        1920,
        1080,
      );
      expect(evaluated, `frame ${frame} should evaluate`).toBeTruthy();

      const tree = buildRemotionPaintTree(evaluated!.paint);
      const draws = flattenRemotionDrawables(tree);
      const expectedKeys = paintParityDrawKeys(evaluated!.paint);
      expect(
        draws.length,
        `frame ${frame} drawable count should match buffer`,
      ).toBe(expectedKeys.length);

      const treeKeys = draws.map((drawable) => drawable.key).sort();
      expect(treeKeys).toEqual(expectedKeys);
    }
  });
});
