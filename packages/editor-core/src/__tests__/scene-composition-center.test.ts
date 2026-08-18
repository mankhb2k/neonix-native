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
      const node = scene.type === "group" ? scene.children[0] : undefined;
      expect(
        node && "transform" in node ? node.transform.translate.x : null,
      ).toBe(size.width / 2);
      expect(
        node && "transform" in node ? node.transform.translate.y : null,
      ).toBe(size.height / 2);
    });
  }
});
