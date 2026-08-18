import { describe, expect, it } from "vitest";
import type { StageTransformValues } from "../stage/transform-box";
import {
  toSingleSetNodeTransformCommand,
  toStagePropertyPatches,
} from "../stage/commit";

const base: StageTransformValues = {
  rootLayerId: "root-A",
  layerId: "node-A",
  x: 10,
  y: 20,
  width: 100,
  height: 50,
  rotation: 0,
};

describe("toStagePropertyPatches", () => {
  it("maps rootLayerId/layerId into the target ref", () => {
    const preview = { ...base, x: 30, y: 25 };
    const patches = toStagePropertyPatches(base, preview);
    expect(patches).toHaveLength(1);
    expect(patches[0]?.target).toEqual({
      rootLayerId: "root-A",
      layerId: "node-A",
    });
  });

  it("emits an empty transformPatch for a size-only change", () => {
    const preview = { ...base, width: 200, height: 90 };
    const patches = toStagePropertyPatches(base, preview);
    expect(patches[0]?.transformPatch).toEqual({});
    expect(patches[0]?.sizePatch).toEqual({ width: 200, height: 90 });
  });

  it("captures rotation in the transformPatch", () => {
    const preview = { ...base, rotation: 45 };
    const patches = toStagePropertyPatches(base, preview);
    expect(patches[0]?.transformPatch).toEqual({ rotation: 45 });
    expect(patches[0]?.sizePatch).toBeUndefined();
  });
});

describe("toSingleSetNodeTransformCommand", () => {
  it("builds set-node-transform for a transform change", () => {
    const patches = toStagePropertyPatches(base, { ...base, x: 42, y: 7 });
    const command = toSingleSetNodeTransformCommand(patches[0]!);
    expect(command).toEqual({
      type: "set-node-transform",
      targets: [{ rootLayerId: "root-A", layerId: "node-A" }],
      patch: { x: 42, y: 7 },
    });
  });

  it("returns null for a size-only patch", () => {
    const patches = toStagePropertyPatches(base, { ...base, width: 220 });
    expect(patches[0]?.sizePatch).toEqual({ width: 220, height: 50 });
    expect(toSingleSetNodeTransformCommand(patches[0]!)).toBeNull();
  });

  it("builds set-node-transform for rotation-only", () => {
    const patches = toStagePropertyPatches(base, { ...base, rotation: 90 });
    const command = toSingleSetNodeTransformCommand(patches[0]!);
    expect(command).toEqual({
      type: "set-node-transform",
      targets: [{ rootLayerId: "root-A", layerId: "node-A" }],
      patch: { rotation: 90 },
    });
  });
});
