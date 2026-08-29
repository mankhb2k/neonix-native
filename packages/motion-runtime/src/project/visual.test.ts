import { describe, expect, it } from "vitest";
import { identityMatrix4 } from "../geometry/matrix4";
import { evaluateRuntimeProjectV3 } from "./visual";
import type { RuntimeProjectV3 } from "./types";

const project: RuntimeProjectV3 = {
  format: "motion-runtime",
  runtimeVersion: 3,
  projectId: "visual-v3-test",
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

});

