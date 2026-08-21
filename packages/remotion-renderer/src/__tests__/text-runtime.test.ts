import { describe, expect, it } from "vitest";
import { identityMatrix4, orthographicProjectionMatrix, type RuntimeProjectV2 } from "@motionvideo/motion-runtime";
import { assertRemotionTextPrepared } from "../text-runtime";

const runtime: RuntimeProjectV2 = {
  format: "motion-runtime",
  formatVersion: 2,
  id: "remotion-text",
  composition: { width: 320, height: 180, fps: 30, graphId: "remotion-text" },
  view: { worldToClipMatrix: orthographicProjectionMatrix(320, 180, 1, 1, 4000) },
  nodes: [{
    id: "text",
    parentId: null,
    zIndex: 0,
    timing: { start: 0, duration: 1 },
    opacity: 1,
    visible: true,
    localMatrix: identityMatrix4(),
    worldMatrix: identityMatrix4(),
    content: {
      kind: "text",
      text: "Text",
      fontAssetId: "font",
      fontUri: "https://cdn.example.test/font.ttf",
      fontIntegrity: "sha256:15256405ecb0d880678833a582760efad538ab2932318b52c8105b267d159459",
      fontSize: 32,
      lineHeight: 40,
      letterSpacing: 0,
      align: "left",
      verticalAlign: "top",
      wrap: "none",
      overflow: "visible",
      direction: "ltr",
      language: "en",
      fill: "#ffffff",
      width: 320,
      height: 180,
    },
  }],
};

describe("Remotion Runtime V2 text boundary", () => {
  it("fails closed when Runtime text has not been shaped", () => {
    expect(() => assertRemotionTextPrepared(runtime)).toThrow("text glyph layouts");
  });
});
