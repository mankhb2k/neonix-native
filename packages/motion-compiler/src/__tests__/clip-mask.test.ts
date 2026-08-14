import { describe, expect, it } from "vitest";
import { parseMotionProjectV1 } from "@motionvideo/motion-protocol";
import { compileMotionProjectV1 } from "../index";
import { clipMaskComponentInternalProject } from "../../../motion-protocol/src/v1/__fixtures__/masks/clip-mask-projects";

describe("clip mask component expand", () => {
  it("prefixes internal mask.sourceLayerId", () => {
    const project = parseMotionProjectV1(clipMaskComponentInternalProject());
    const result = compileMotionProjectV1(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const fill = result.project.layers.find((layer) => layer.id === "cta__comp-fill");
    expect(
      fill && "compositing" in fill
        ? fill.compositing?.mask?.sourceLayerId
        : undefined,
    ).toBe("cta__comp-clip");
  });
});
