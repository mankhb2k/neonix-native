import { describe, expect, it } from "vitest";
import { compileProtocolV2 } from "@motionvideo/motion-compiler";
import { evaluateRuntimeProjectV2 } from "@motionvideo/motion-runtime";
import { createV2OverlapProject, createV2ShapeProject } from "@motionvideo/motion-compiler/testing";
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

  it("preserves Runtime Effect Operator IR for the shared native canvas export path", () => {
    const project = createV2ShapeProject({ id: "remotion-effect-program" });
    const layer = project.layers[0];
    if (!layer || layer.type !== "shape") throw new Error("Expected shape fixture layer");
    const runtime = compileProtocolV2({
      ...project,
      layers: [{
        ...layer,
        effects: [
          { id: "grade", type: "color-adjust", brightness: 0, contrast: 1.4, saturation: 0.7, hueRotate: 0 },
          { id: "soften", type: "blur", radius: 24 },
        ],
      }],
    });

    const evaluated = evaluateRuntimeProjectV2(runtime, 0);
    const commandScope = evaluated.commands.find((command) => command.op === "beginLayer");
    if (!commandScope || commandScope.op !== "beginLayer") throw new Error("Expected effect layer scope");
    const tree = buildRemotionPaintTree(evaluated);
    const treeScope = tree.roots.find((node) => node.kind === "layer");
    if (!treeScope || treeScope.kind !== "layer") throw new Error("Expected Remotion effect layer scope");

    expect(commandScope.effectProgram).toBeDefined();
    expect(treeScope.effectProgram).toBe(commandScope.effectProgram);
    expect(treeScope.effectProgram?.ops.map((op) => op.kind)).toEqual(["color-adjust", "blur"]);
    expect(treeScope.offscreen).toBe(true);
  });
});
