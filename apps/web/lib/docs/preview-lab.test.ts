import { describe, expect, it } from "vitest";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";
import { compileProtocolV2ToPaintCommands } from "@motionvideo/motion-compiler";
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
