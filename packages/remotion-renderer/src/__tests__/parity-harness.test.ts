import {
  compositionDurationInFrames,
  evaluateCompositionFrame,
} from "@motionvideo/motion-runtime";
import {
  createDemoMotionProject,
  compileProjectV1,
} from "@motionvideo/motion-runtime/testing";
import { describe, expect, it } from "vitest";

const LABELS = ["before", "start", "middle", "end", "after"] as const;

function paintFingerprint(commands: unknown): string {
  return JSON.stringify(commands);
}

describe("Pixi vs Remotion sampled-frame paint parity", () => {
  it("shares EvaluatedFrame.paint digests across sample points", () => {
    const runtime = compileProjectV1(createDemoMotionProject());
    const fps = 30;
    const duration = compositionDurationInFrames(runtime, undefined, fps);
    const last = Math.max(0, duration - 1);
    const frames = {
      before: 0,
      start: Math.min(1, last),
      middle: Math.floor(last / 2),
      end: last,
      after: last,
    };

    for (const label of LABELS) {
      const frame = frames[label];
      const a = evaluateCompositionFrame(runtime, frame, fps, 640, 360);
      const b = evaluateCompositionFrame(runtime, frame, fps, 640, 360);
      expect(a).toBeTruthy();
      expect(paintFingerprint(a!.paint.commands)).toBe(
        paintFingerprint(b!.paint.commands),
      );
      expect(a!.paint.commands.length).toBeGreaterThan(0);
    }
  });
});
