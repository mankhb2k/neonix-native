import { describe, expect, it } from "vitest";
import { compositingFingerprint } from "@motionvideo/motion-runtime";
import { COMPOSITING_PARITY_FIXTURES } from "@motionvideo/motion-runtime/testing";
import {
  buildRemotionPaintTree,
  flattenRemotionDrawables,
} from "../build-remotion-paint-tree";

describe("compositing parity (Remotion tree)", () => {
  for (const fixture of COMPOSITING_PARITY_FIXTURES) {
    it(`${fixture.id}: fingerprint + tree stay consistent`, () => {
      const fp = compositingFingerprint(fixture.buffer);
      const tree = buildRemotionPaintTree(fixture.buffer);
      const draws = flattenRemotionDrawables(tree);
      expect(draws.length).toBe(fp.drawables);
      if (fixture.id === "blur-layer") {
        expect(fp.layers).toBeGreaterThanOrEqual(1);
      }
      if (fixture.id === "mask-layer") {
        expect(fp.masks).toBe(1);
      }
    });
  }
});
