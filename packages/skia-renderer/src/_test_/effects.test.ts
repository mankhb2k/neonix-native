import { describe, expect, it } from "vitest";
import type { RuntimeEffectProgram } from "@motionvideo/motion-runtime";
import { cssBlurRadiusToSkiaSigma, effectFilterFor } from "../command/effects";
import type { SkiaCanvasKit } from "../canvas-kit";

describe("Skia CSS effect lowering", () => {
  it("converts CSS blur radius to the Skia sigma contract", () => {
    expect(cssBlurRadiusToSkiaSigma(14)).toBeCloseTo(8.5829, 6);
    expect(cssBlurRadiusToSkiaSigma(0)).toBeCloseTo(0.5, 6);
  });

  it("creates a filter that can be installed in a backdrop saveLayer slot", () => {
    let receivedSigma = 0;
    const filter = { delete() {} };
    const kit = {
      TileMode: { Decal: 1 },
      ImageFilter: {
        MakeBlur(sigmaX: number, sigmaY: number) {
          receivedSigma = sigmaX;
          expect(sigmaY).toBe(sigmaX);
          return filter;
        },
      },
    } as unknown as SkiaCanvasKit;
    const program: RuntimeEffectProgram = {
      input: "source",
      ops: [{ id: "backdrop-blur", kind: "blur", input: "source", output: "effect:backdrop-blur", radius: 12 }],
      output: "effect:backdrop-blur",
      requiresOffscreen: true,
    };

    expect(effectFilterFor(kit, program)).toEqual({ filter, supported: true });
    expect(receivedSigma).toBeCloseTo(cssBlurRadiusToSkiaSigma(12), 8);
  });
});
