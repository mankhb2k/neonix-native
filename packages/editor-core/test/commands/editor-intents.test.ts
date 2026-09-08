import { describe, expect, it } from "vitest";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import {
  canApplyEditorIntent,
  resolveEditorIntent,
} from "../../src/commands/editor-intents";

function documentFixture(): MotionProtocolV2 {
  return {
    format: "motion-protocol",
    formatVersion: 2,
    id: "editor-intents",
    composition: {
      width: 320,
      height: 180,
      fps: 30,
      background: "#000000",
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
        id: "shape",
        type: "shape",
        parentLayerId: null,
        order: 0,
        frame: { width: 100, height: 100 },
        transform: {
          translate: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          rotate: { x: 0, y: 0, z: 0 },
          skew: { x: 0, y: 0 },
          anchor: { x: 50, y: 50, z: 0 },
        },
        opacity: 1,
        timing: { start: 0, duration: 1000 },
        payload: { shape: "rectangle" },
        style: { fill: "#ffffff" },
      },
    ],
    audio: { sampleRate: 48000, tracks: [] },
  };
}

describe("editor intents", () => {
  it("resolves undo and redo as history operations", () => {
    const context = { document: documentFixture(), selectedLayerIds: [] };
    expect(resolveEditorIntent({ type: "undo" }, context)).toEqual({
      kind: "history",
      operation: "undo",
    });
    expect(resolveEditorIntent({ type: "redo" }, context)).toEqual({
      kind: "history",
      operation: "redo",
    });
  });

  it("creates delete commands only for unlocked selected layers", () => {
    const document = documentFixture();
    const context = { document, selectedLayerIds: ["shape"] };
    expect(canApplyEditorIntent({ type: "delete-selection" }, context)).toBe(true);
    expect(resolveEditorIntent({ type: "delete-selection" }, context)).toEqual({
      kind: "commands",
      commands: [{ type: "remove-layer", layerId: "shape" }],
    });
    expect(
      resolveEditorIntent(
        { type: "delete-selection" },
        { ...context, lockedLayerIds: ["shape"] },
      ),
    ).toBeNull();
  });
});
