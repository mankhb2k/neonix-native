import { describe, expect, it } from "vitest";
import { applyEditorCommand } from "../../src/document/commands";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";
import type { StageTransformValues } from "../../src/interactions/stage/transform-box";
import {
  toStageDocumentCommand,
  toStageLayerPatches,
} from "../../src/interactions/stage/commit";

const base: StageTransformValues = {
  layerId: "node-A",
  x: 10,
  y: 20,
  width: 100,
  height: 50,
  rotation: 0,
};

describe("toStageLayerPatches", () => {
  it("maps the layer id and translate values into a Protocol V2 patch", () => {
    const preview = { ...base, x: 30, y: 25 };
    const patches = toStageLayerPatches(base, preview);
    expect(patches).toHaveLength(1);
    expect(patches[0]?.layerId).toBe("node-A");
    expect(patches[0]?.patch).toEqual({
      transform: { translate: { x: 30, y: 25 } },
    });
  });

  it("emits a frame patch for a size-only change", () => {
    const preview = { ...base, width: 200, height: 90 };
    const patches = toStageLayerPatches(base, preview);
    expect(patches[0]?.patch).toEqual({
      frame: { width: 200, height: 90 },
    });
  });

  it("captures rotation in the Protocol V2 transform", () => {
    const preview = { ...base, rotation: 45 };
    const patches = toStageLayerPatches(base, preview);
    expect(patches[0]?.patch).toEqual({ transform: { rotate: { z: 45 } } });
  });
});

describe("toStageDocumentCommand", () => {
  const document = MotionProtocolV2Schema.parse({
    format: "motion-protocol",
    formatVersion: 2,
    id: "stage-test",
    composition: {
      width: 320,
      height: 180,
      fps: 30,
      background: "#101820",
      colorSpace: "srgb",
      view: {
        projection: { kind: "orthographic", zoom: 1, near: 1, far: 4000 },
        transform: {
          translate: { x: 0, y: 0, z: 0 },
          rotate: { x: 0, y: 0, z: 0 },
        },
      },
    },
    assets: [],
    layers: [
      {
        type: "shape",
        id: "node-A",
        parentLayerId: null,
        order: 0,
        frame: { width: 100, height: 50 },
        transform: {
          translate: { x: 10, y: 20, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          rotate: { x: 0, y: 0, z: 0 },
          skew: { x: 0, y: 0 },
          anchor: { x: 0, y: 0, z: 0 },
        },
        opacity: 1,
        timing: { start: 0, duration: 1000 },
        payload: { shape: "rectangle" },
        style: { fill: "#00aa88" },
      },
    ],
    audio: { sampleRate: 48000, tracks: [] },
  });

  it("produces commands that apply to the same Protocol V2 document", () => {
    const previews = [
      { ...base, x: 42, y: 7 },
      { ...base, width: 220, height: 90 },
      { ...base, rotation: 90 },
    ];
    for (const preview of previews) {
      const command = toStageDocumentCommand(
        toStageLayerPatches(base, preview),
      );
      expect(command).not.toBeNull();
      const result = applyEditorCommand(document, command!);
      expect(result.ok).toBe(true);
    }
  });

  it("builds patch-layer for a transform change", () => {
    const patches = toStageLayerPatches(base, { ...base, x: 42, y: 7 });
    const command = toStageDocumentCommand(patches);
    expect(command).toEqual({
      type: "patch-layer",
      layerId: "node-A",
      patch: { transform: { translate: { x: 42, y: 7 } } },
    });
  });

  it("builds patch-layer for a size-only patch", () => {
    const patches = toStageLayerPatches(base, { ...base, width: 220 });
    expect(toStageDocumentCommand(patches)).toEqual({
      type: "patch-layer",
      layerId: "node-A",
      patch: { frame: { width: 220, height: 50 } },
    });
  });

  it("builds patch-layer for rotation-only", () => {
    const patches = toStageLayerPatches(base, { ...base, rotation: 90 });
    const command = toStageDocumentCommand(patches);
    expect(command).toEqual({
      type: "patch-layer",
      layerId: "node-A",
      patch: { transform: { rotate: { z: 90 } } },
    });
  });

  it("returns null when the preview did not change", () => {
    expect(toStageDocumentCommand(toStageLayerPatches(base, base))).toBeNull();
  });
});
