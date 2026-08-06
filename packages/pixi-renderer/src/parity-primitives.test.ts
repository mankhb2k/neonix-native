import { describe, expect, it } from "vitest";
import { Container } from "pixi.js";
import {
  PAINT_PARITY_FIXTURES,
  paintParityDrawKeys,
} from "@motionvideo/motion-runtime/testing";
import { syncPaintBufferToCache } from "./display-cache";
import { createPixiFramePainter } from "./PixiFramePainter";

describe("primitive paint parity slices (Pixi)", () => {
  for (const fixture of PAINT_PARITY_FIXTURES) {
    it(`${fixture.id}: cache keys match draw keys`, () => {
      const keys = paintParityDrawKeys(fixture.buffer);
      expect(keys.length).toBeGreaterThan(0);

      const cache = new Map();
      syncPaintBufferToCache(cache, fixture.buffer);
      expect([...cache.keys()].sort()).toEqual(keys);
    });

    it(`${fixture.id}: painter live keys (headless-safe ops)`, () => {
      // FillGradient needs DOM canvas; skip painter paint for gradient-only fixtures.
      if (fixture.id === "gradient-fill") return;
      const keys = paintParityDrawKeys(fixture.buffer);
      const root = new Container({ sortableChildren: true });
      const painter = createPixiFramePainter({ root });
      painter.paintCommands(fixture.buffer);
      expect(painter.getLiveKeys()).toEqual(keys);
      painter.dispose();
    });
  }
});
