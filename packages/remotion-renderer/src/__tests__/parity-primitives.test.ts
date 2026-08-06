import { describe, expect, it } from "vitest";
import {
  PAINT_PARITY_FIXTURES,
  paintParityDrawKeys,
} from "@motionvideo/motion-runtime/testing";
import {
  buildRemotionPaintTree,
  flattenRemotionDrawables,
} from "../build-remotion-paint-tree";

describe("primitive paint parity slices (Remotion)", () => {
  for (const fixture of PAINT_PARITY_FIXTURES) {
    it(`${fixture.id}: paint tree drawables match buffer keys`, () => {
      const keys = paintParityDrawKeys(fixture.buffer);
      const tree = buildRemotionPaintTree(fixture.buffer);
      const remotionKeys = flattenRemotionDrawables(tree)
        .map((d) => d.key)
        .sort();
      expect(remotionKeys).toEqual(keys);
    });
  }
});
