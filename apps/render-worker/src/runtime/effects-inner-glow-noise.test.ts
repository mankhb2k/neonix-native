import { describe, expect, it } from "vitest";
import { compileProjectV1, createNeonEffectsPreviewProject } from "@motionvideo/motion-runtime/testing";
import { drawProjectFrame } from "./draw";

describe("worker canvas inner-glow + noise", () => {
  it("changes pixels versus the same card without effects", async () => {
    const withEffects = createNeonEffectsPreviewProject();
    const withoutEffects = createNeonEffectsPreviewProject();
    const card = withoutEffects.layers[0] as { effects?: unknown[] };
    card.effects = [];

    const withPng = await drawProjectFrame(
      compileProjectV1(withEffects),
      0,
      400,
      240,
    );
    const withoutPng = await drawProjectFrame(
      compileProjectV1(withoutEffects),
      0,
      400,
      240,
    );

    expect(withPng.equals(withoutPng)).toBe(false);
    expect(withPng.length).toBeGreaterThan(800);
  });
});
