import { describe, expect, it } from "vitest";
import { compileProtocolV2ToPaintCommands } from "@motionvideo/motion-compiler";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";
import {
  PREVIEW_LAB_CASES,
  PREVIEW_LAB_DEFAULT_CASE,
  previewLabCaseById,
} from "./preview-lab";

describe("Protocol V2 preview lab fixtures", () => {
  it("contains the certified rectangle atom and its Task 3 property fixtures", () => {
    expect(PREVIEW_LAB_CASES.map((item) => item.id)).toEqual([
      "primitive.shape.rectangle",
      "primitive.shape.ellipse",
      "image.fit.contain",
      "image.fit.cover",
      "image.crop",
      "image.missing-asset",
      "video.frame-seek",
      "text.single-line.alignment",
      "effect.color-adjust",
      "effect.blur",
      "effect.blur.stroke",
      "effect.drop-shadow",
      "effect.drop-shadow.negative-offset",
      "effect.drop-shadow.zero-blur",
      "effect.drop-shadow.alpha-color",
      "effect.drop-shadow.stroke-source",
      "effect.outer-glow",
      "effect.outer-glow.stroke-source",
      "effect.outer-glow.perspective",
      "effect.order",
      "effect.blur-chain",
      "effect.blur.radius-4",
      "effect.blur.radius-40",
      "effect.blur.radius-256",
      "path.closed-fill.perspective",
      "path.fill-rule.nonzero",
      "path.fill-rule.evenodd",
      "path.multiple-contours.donut",
      "path.paint.stroke",
      "path.paint.stroke-cap-dash",
      "path.morph",
      "group.parent-transform",
      "rectangle.paint.stroke",
      "rectangle.paint.stroke-perspective",
      "ellipse.paint.stroke",
      "ellipse.paint.stroke-perspective",
      "rectangle.paint.stroke-width",
      "rectangle.paint.stroke-width-perspective",
      "rectangle.paint.opacity",
      "rectangle.paint.opacity-perspective",
      "rectangle.rounded",
      "rectangle.rounded-perspective",
      "rectangle.gradient.linear",
      "ellipse.gradient.radial",
      "rectangle.gradient.perspective",
      "rectangle.transform.translate",
      "rectangle.transform.scale",
      "rectangle.transform.anchor",
      "rectangle.transform.rotate",
      "rectangle.mat4.anchor-outside-rotate-z",
      "rectangle.mat4.anchor-z-rotate-y-perspective",
      "rectangle.transform.skew",
      "rectangle.mat4.rotate-x-perspective",
      "rectangle.mat4.rotate-y-perspective",
      "rectangle.mat4.translate-z-perspective",
      "rectangle.timing",
      "rectangle.opacity",
      "rectangle.z-index",
      "matrix4.2d.identity",
      "matrix4.2d.rotate-z",
      "matrix4.2d.skew",
      "matrix4.3d.rotate-x",
      "matrix4.3d.rotate-y",
      "matrix4.3d.translate-z",
      "matrix4.3d.anchor-z",
      "matrix4.camera-plane",
    ]);
    expect(PREVIEW_LAB_DEFAULT_CASE).toBe("primitive.shape.rectangle");
    expect(previewLabCaseById(null).id).toBe(PREVIEW_LAB_DEFAULT_CASE);
  });

  it("parses and compiles every V2 fixture without V1", () => {
    for (const fixture of PREVIEW_LAB_CASES) {
      const project = MotionProtocolV2Schema.parse(fixture.project);
      const buffer = compileProtocolV2ToPaintCommands(project, {
        time: fixture.previewTime ?? 0,
      });
      expect(buffer.commands[0]?.op).toBe("beginFrame");
      expect(buffer.commands.at(-1)?.op).toBe("endFrame");
    }
  });
});
