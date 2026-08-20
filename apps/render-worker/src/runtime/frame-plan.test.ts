import { describe, expect, it } from "vitest";
import {
  buildFramePlan,
  chunkFramePlan,
  projectDuration,
  projectFrameLayers,
} from "./frame-plan";
import type { CompiledProject } from "../compiler";

function compiled(duration: number): CompiledProject {
  return {
    timeline: { duration },
    layers: [],
    tracks: [],
  } as unknown as CompiledProject;
}

describe("projectDuration", () => {
  it("reads timeline.duration from the layer-graph IR", () => {
    expect(projectDuration(compiled(10))).toBe(10);
  });
});

describe("projectFrameLayers", () => {
  it("returns one window for the whole duration", () => {
    const c = compiled(8);
    expect(projectFrameLayers(c, 4)).toEqual([
      { sceneIndex: 0, localTime: 4, opacity: 1 },
    ]);
  });

  it("returns no layer outside the timeline", () => {
    const c = compiled(8);
    expect(projectFrameLayers(c, -0.1)).toEqual([]);
    expect(projectFrameLayers(c, 8)).toEqual([]);
  });
});

describe("buildFramePlan", () => {
  it("emits frames through the timeline duration", () => {
    const plan = buildFramePlan(compiled(10), 1);
    expect(plan).toHaveLength(10);
    expect(plan[8]!.globalTime).toBe(8);
    expect(plan[8]!.layers).toEqual([
      { sceneIndex: 0, localTime: 8, opacity: 1 },
    ]);
  });

  it("keeps sceneIndex/localTime deterministic", () => {
    const plan = buildFramePlan(compiled(3), 1);
    expect(plan[1]!.sceneIndex).toBe(0);
    expect(plan[1]!.localTime).toBe(1);
  });

  it("emits exactly duration*fps frames for a frame-grid-aligned duration", () => {
    // Regression: 12s @ 24fps must be 288 frames (not 289 from float drift).
    // The frame-count policy here is Math.round(duration * fps), which is
    // correct when duration is already snapped to the frame grid.
    const plan = buildFramePlan(compiled(12), 24);
    expect(plan).toHaveLength(288);
    expect(plan[287]!.frameIndex).toBe(287);
    expect(plan[287]!.globalTime).toBeCloseTo(287 / 24, 9);
    // The last frame must stay inside the [0, duration) window.
    expect(plan[287]!.globalTime).toBeLessThan(12);
  });
});

describe("chunkFramePlan", () => {
  it("splits frames into contiguous chunks", () => {
    const plan = buildFramePlan(compiled(3), 1);
    const chunks = chunkFramePlan(plan, 2);
    expect(chunks).toHaveLength(2);
    expect(chunks.flat()).toHaveLength(plan.length);
  });
});
