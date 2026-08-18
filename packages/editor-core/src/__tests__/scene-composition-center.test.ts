import { describe, expect, it } from "vitest";
import {
  layerFromFrameDraft,
  stageSizeForAspect,
} from "../timeline/internal/scene-utils";

describe("layerFromFrameDraft composition center", () => {
  for (const aspect of ["16:9", "9:16", "1:1"] as const) {
    it(`centers text node for ${aspect}`, () => {
      const size = stageSizeForAspect(aspect);
      const scene = layerFromFrameDraft(
        {
          id: "d1",
          name: "Title",
          text: "Title",
          duration: 3,
          kind: "text",
        },
        (p) => `${p}_1`,
        size,
      );
      expect("transform" in scene ? scene.transform.translate.x : null).toBe(
        size.width / 2,
      );
      expect("transform" in scene ? scene.transform.translate.y : null).toBe(
        size.height / 2,
      );
      expect(scene.type).toBe("text");
    });
  }
});
