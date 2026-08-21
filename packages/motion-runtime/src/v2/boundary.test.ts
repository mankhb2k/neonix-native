import { describe, expect, it } from "vitest";
import {
  assertRuntimeFrameV2,
  assertRuntimeProjectV2,
} from "./validate";
import type { RuntimeProjectV2 } from "./types";

const identity = new Float64Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]);

const project: RuntimeProjectV2 = {
  format: "motion-runtime",
  formatVersion: 2,
  id: "runtime-boundary",
  composition: {
    width: 320,
    height: 180,
    fps: 30,
    graphId: "runtime-boundary",
  },
  view: {
    viewMatrix: identity,
    projectionMatrix: identity,
    viewProjectionMatrix: identity,
  },
  nodes: [],
};

describe("Runtime V2 consumer boundaries", () => {
  it("accepts a valid RuntimeProjectV2", () => {
    expect(assertRuntimeProjectV2(project)).toBe(project);
  });

  it("rejects a V1 or malformed runtime project", () => {
    expect(() =>
      assertRuntimeProjectV2({ ...project, formatVersion: 1 }),
    ).toThrow(/RuntimeProjectV2/);
    expect(() => assertRuntimeProjectV2({ format: "motion-runtime" })).toThrow(
      /RuntimeProjectV2/,
    );
  });

  it("rehydrates matrices after JSON transport", () => {
    const transported = JSON.parse(JSON.stringify(project)) as unknown;
    const restored = assertRuntimeProjectV2(transported);
    expect(restored.view.viewMatrix).toBeInstanceOf(Float64Array);
    expect(Array.from(restored.view.viewMatrix)).toEqual(Array.from(identity));
  });

  it("accepts only a RuntimeFrameV2 paint envelope", () => {
    const frame = {
      runtimeFormat: "motion-runtime" as const,
      runtimeVersion: 2 as const,
      frame: 0,
      time: 0,
      version: 1 as const,
      diagnostics: [],
      commands: [
        {
          op: "beginFrame" as const,
          width: 320,
          height: 180,
          graphId: "runtime-boundary",
          frame: 0,
          time: 0,
        },
        { op: "endFrame" as const },
      ],
    };
    expect(() => assertRuntimeFrameV2(frame)).not.toThrow();
    expect(() =>
      assertRuntimeFrameV2({ ...frame, runtimeVersion: 1 }),
    ).toThrow(/RuntimeFrameV2/);
  });
});
