/**
 * Phase 3 — v1 fixture parity (Pixi side).
 *
 * The F3 multi-asset fixture is compiled and evaluated at three key frames.
 * The Pixi painter must be able to consume the evaluated `PaintCommandBuffer`
 * headless-safely and produce exactly the draw keys defined by the buffer.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Container } from "pixi.js";
import { compileMotionProjectV1 } from "@motionvideo/motion-compiler";
import {
  parseMotionProjectV1,
} from "@motionvideo/motion-protocol";
import {
  type MotionRuntimeProject,
} from "@motionvideo/motion-protocol/runtime";
import {
  evaluateCompositionFrameV1,
  timelineTotalDuration,
} from "@motionvideo/motion-runtime";
import { paintParityDrawKeys } from "@motionvideo/motion-runtime/testing";
import { createPixiFramePainter } from "../PixiFramePainter";

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

describe("v3 fixture parity (Pixi)", () => {
  it("paints multi-asset evaluated frames headless-safely with matching draw keys", () => {
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

      const expectedKeys = paintParityDrawKeys(evaluated!.paint);
      expect(
        expectedKeys.length,
        `frame ${frame} should have drawables`,
      ).toBeGreaterThan(0);

      const root = new Container({ sortableChildren: true });
      const painter = createPixiFramePainter({ root });
      painter.paintCommands(evaluated!.paint);
      expect([...painter.getLiveKeys()].sort()).toEqual(expectedKeys);
      painter.dispose();
    }
  });

  it("multi-asset evaluated frames are deterministic across evaluations", () => {
    const runtime = loadMultiAsset();
    const fps = 30;
    const frames = keyFrames(timelineTotalDuration(runtime), fps);

    for (const frame of frames) {
      const a = evaluateCompositionFrameV1(runtime, frame, fps, 1920, 1080);
      const b = evaluateCompositionFrameV1(runtime, frame, fps, 1920, 1080);
      expect(JSON.stringify(a?.paint.commands)).toBe(
        JSON.stringify(b?.paint.commands),
      );
    }
  });
});
