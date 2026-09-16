import { describe, expect, it } from "vitest";
import { identityMatrix4 } from "../geometry/matrix4";
import {
  evaluatePreparedRuntimeProjectV3,
  evaluateRuntimeProjectV3,
  prepareRuntimeProjectV3,
} from "./visual";
import type { RuntimeProjectV3 } from "./types";

const project: RuntimeProjectV3 = {
  format: "motion-runtime",
  runtimeVersion: 3,
  projectId: "visual-v3-test",
  durationUs: 0,
  visual: {
    composition: { width: 320, height: 180, fps: 30, graphId: "visual-v3-test" },
    view: { worldToClipMatrix: identityMatrix4() },
    nodes: [],
  },
  mediaCatalog: { assets: [] },
  videoTimeline: { instances: [] },
  audioTimeline: { sampleRate: 48000, tracks: [] },
};

describe("RuntimeProjectV3 visual boundary", () => {
  it("evaluates the reused visual semantics and tags the frame as V3", () => {
    const frame = evaluateRuntimeProjectV3(project, 0);
    expect(frame.runtimeFormat).toBe("motion-runtime");
    expect(frame.runtimeVersion).toBe(3);
    expect(frame.commands.at(0)?.op).toBe("beginFrame");
    expect(frame.commands.at(-1)?.op).toBe("endFrame");
  });
  it("rehydrates Matrix4 values after JSON transport", () => {
    const transported = JSON.parse(JSON.stringify(project)) as RuntimeProjectV3;
    const frame = evaluateRuntimeProjectV3(transported, 0);
    expect(frame.commands.at(0)?.op).toBe("beginFrame");
    expect(frame.commands.at(0)).toMatchObject({ projection: { worldToClipMatrix: expect.arrayContaining([1, 1, 1, 1]) } });
  });

  it("overlays compiler-baked visual frame deltas after JSON transport", () => {
    const node = {
      id: "card",
      parentId: null,
      order: 0,
      timing: { start: 0, duration: 1 },
      opacity: 1,
      visible: true,
      localMatrix: identityMatrix4(),
      worldMatrix: identityMatrix4(),
      content: { kind: "shape" as const, shape: "rectangle" as const, width: 20, height: 20, fill: "#ffffff" },
    };
    const moved = {
      ...node,
      opacity: 0.25,
      localMatrix: new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 40, 0, 0, 1]),
      worldMatrix: new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 40, 0, 0, 1]),
    };
    const animated: RuntimeProjectV3 = {
      ...project,
      durationUs: 1_000_000,
      visual: {
        ...project.visual,
        composition: { ...project.visual.composition, fps: 2, duration: 1 },
        nodes: [node],
      },
      visualTimeline: { frames: [{ nodes: [] }, { nodes: [moved] }] },
    };
    const transported = JSON.parse(JSON.stringify(animated)) as RuntimeProjectV3;
    const first = evaluateRuntimeProjectV3(transported, 0);
    const second = evaluateRuntimeProjectV3(transported, 1);
    expect(first.commands.find((command) => command.op === "setTransform")).toMatchObject({ alpha: 1 });
    expect(second.commands.find((command) => command.op === "setTransform")).toMatchObject({ alpha: 0.25, matrix4: expect.arrayContaining([40]) });
  });

  it("reuses prepared indexes while preserving the legacy evaluation output", () => {
    const node = {
      id: "prepared-card",
      parentId: null,
      order: 0,
      timing: { start: 0, duration: 1 },
      opacity: 1,
      visible: true,
      localMatrix: identityMatrix4(),
      worldMatrix: identityMatrix4(),
      content: { kind: "shape" as const, shape: "rectangle" as const, width: 20, height: 20, fill: "#ffffff" },
    };
    const animated: RuntimeProjectV3 = {
      ...project,
      durationUs: 1_000_000,
      visual: {
        ...project.visual,
        composition: { ...project.visual.composition, fps: 2, duration: 1 },
        nodes: [node],
      },
      visualTimeline: {
        frames: [{ nodes: [] }, { nodes: [{ id: node.id, opacity: 0.5, visible: true }] }],
      },
    };
    const prepared = prepareRuntimeProjectV3(animated);
    expect(prepared.nodeById.get(node.id)).toBeDefined();
    expect(prepared.orderedNodes.map((candidate) => candidate.id)).toEqual([node.id]);
    expect(prepared.timelineFrames).toHaveLength(2);
    expect(prepared.animatedNodeIds).toEqual(new Set([node.id]));

    const preparedFrame = evaluatePreparedRuntimeProjectV3(prepared, 1);
    const legacyFrame = evaluateRuntimeProjectV3(animated, 1);
    expect(preparedFrame).toEqual(legacyFrame);
  });

});

