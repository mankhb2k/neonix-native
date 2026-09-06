import { describe, expect, it } from "vitest";
import { createMatrix4, identityMatrix4, matrix4ToArray } from "@motionvideo/motion-runtime";
import { applyStagePreviewOverrides } from "./runtime-preview";

describe("applyStagePreviewOverrides", () => {
  it("translates every runtime transform for the selected layer", () => {
    const frame = {
      runtimeFormat: "motion-runtime" as const,
      runtimeVersion: 3 as const,
      frame: 0,
      time: 0,
      version: 1 as const,
      diagnostics: [],
      commands: [
        {
          op: "setTransform" as const,
          key: "layer:fill",
          layerId: "layer",
          matrix4: matrix4ToArray(createMatrix4([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 0, 1])),
          alpha: 1,
          visible: true,
          order: 0,
        },
        {
          op: "drawShape" as const,
          key: "layer",
          layerId: "layer",
          shape: "rectangle" as const,
          fill: "#fff",
          width: 20,
          height: 10,
        },
      ],
    };
    const original = frame.commands[0];
    const result = applyStagePreviewOverrides(
      frame,
      new Map([["layer", { translateDelta: { x: 5, y: -7 } }]]),
    );
    const transform = result.commands[0];
    expect(transform).toMatchObject({ op: "setTransform", layerId: "layer" });
    if (transform.op !== "setTransform") throw new Error("expected transform command");
    expect(transform.matrix4[12]).toBe(15);
    expect(transform.matrix4[13]).toBe(13);
    expect(original).not.toBe(transform);
  });

  it("returns the same frame when no override exists", () => {
    const frame = {
      runtimeFormat: "motion-runtime" as const,
      runtimeVersion: 3 as const,
      frame: 0,
      time: 0,
      version: 1 as const,
      diagnostics: [],
      commands: [],
    };
    expect(applyStagePreviewOverrides(frame, new Map())).toBe(frame);
    expect(identityMatrix4()).toHaveLength(16);
  });

  it("applies a transient scale around the requested origin", () => {
    const frame = {
      runtimeFormat: "motion-runtime" as const,
      runtimeVersion: 3 as const,
      frame: 0,
      time: 0,
      version: 1 as const,
      diagnostics: [],
      commands: [{
        op: "setTransform" as const,
        key: "layer:fill",
        layerId: "layer",
        matrix4: matrix4ToArray(identityMatrix4()),
        alpha: 1,
        visible: true,
        order: 0,
      }],
    };
    const result = applyStagePreviewOverrides(
      frame,
      new Map([[
        "layer",
        {
          translateDelta: { x: 0, y: 0 },
          scaleMultiplier: { x: 2, y: 2 },
          scaleOrigin: { x: 10, y: 10 },
        },
      ]]),
    );
    const transform = result.commands[0];
    if (transform.op !== "setTransform") throw new Error("expected transform command");
    expect(transform.matrix4[0]).toBe(2);
    expect(transform.matrix4[5]).toBe(2);
    expect(transform.matrix4[12]).toBe(-10);
    expect(transform.matrix4[13]).toBe(-10);
  });
});
