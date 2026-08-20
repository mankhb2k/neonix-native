import { describe, expect, it } from "vitest";
import { compileProtocolV2 } from "@motionvideo/motion-compiler";
import { evaluateRuntimeProjectV2 } from "@motionvideo/motion-runtime";
import { createV2OverlapProject, createV2ShapeProject } from "@motionvideo/motion-runtime/testing";
import { buildRemotionPaintTree, flattenRemotionDrawables } from "../build-remotion-paint-tree";

describe("Remotion Protocol V2 parity", () => {
  it("consumes the same V2 paint command contract as preview", () => {
    const runtime = compileProtocolV2(createV2OverlapProject("remotion-v2"));
    for (const frame of [0, 15, 60]) {
      const evaluated = evaluateRuntimeProjectV2(runtime, frame);
      const tree = buildRemotionPaintTree(evaluated);
      const draws = flattenRemotionDrawables(tree);
      const expected = evaluated.commands.filter((command) => command.op === "drawShape");
      expect(draws).toHaveLength(expected.length);
      expect(draws.map((draw) => draw.key).sort()).toEqual(expected.map((draw) => draw.key).sort());
    }
  });

  it("supports ellipse as a certified V2 atom", () => {
    const runtime = compileProtocolV2(createV2ShapeProject({ id: "remotion-ellipse", shape: "ellipse" }));
    const evaluated = evaluateRuntimeProjectV2(runtime, 0);
    expect(evaluated.commands.some((command) => command.op === "drawShape" && command.shape === "ellipse")).toBe(true);
  });
});
