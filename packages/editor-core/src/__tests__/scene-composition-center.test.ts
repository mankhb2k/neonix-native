import { describe, expect, it } from "vitest";
import {
  sceneFromFrameDraft,
  stageSizeForAspect,
} from "../timeline/internal/scene-utils";

describe("sceneFromFrameDraft composition center", () => {
  for (const aspect of ["16:9", "9:16", "1:1"] as const) {
    it(`centers text node for ${aspect}`, () => {
      const size = stageSizeForAspect(aspect);
      const scene = sceneFromFrameDraft(
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
      const node = scene.layers[0]!;
      expect(node.transform.x).toBe(size.width / 2);
      expect(node.transform.y).toBe(size.height / 2);
    });
  }
});
