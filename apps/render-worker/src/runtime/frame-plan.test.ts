import { describe, expect, it } from "vitest";
import {
  buildFramePlan,
  chunkFramePlan,
  projectDuration,
  projectFrameLayers,
} from "./frame-plan";
import type { CompiledProject } from "../compiler";

type Clip =
  CompiledProject["timeline"]["visualTracks"][number]["clips"][number];
type Track = CompiledProject["timeline"]["visualTracks"][number];
type Scene = CompiledProject["scenes"][number];

function scene(id: string, duration = 10): Scene {
  return { id, duration, layers: [], tracks: [] } as Scene;
}

function clip(
  id: string,
  sceneId: string,
  start: number,
  duration: number,
  extra: Partial<Clip> = {},
): Clip {
  return {
    id,
    source: { kind: "scene", sceneId },
    start,
    duration,
    ...extra,
  } as Clip;
}

function track(role: Track["role"], clips: Clip[], order = 0): Track {
  return { id: `t-${role}-${order}`, role, order, clips } as Track;
}

function compiled(overrides: {
  duration?: number;
  tracks?: Track[];
  scenes?: Scene[];
}): CompiledProject {
  return {
    timeline: {
      duration: overrides.duration ?? 0,
      visualTracks: overrides.tracks ?? [],
      audioTracks: [],
      captionTracks: [],
    },
    scenes: overrides.scenes ?? [],
  } as unknown as CompiledProject;
}

describe("projectDuration", () => {
  it("prefers explicit timeline.duration over derived clip end", () => {
    const c = compiled({
      duration: 10,
      tracks: [track("primary", [clip("a", "s1", 0, 8)])],
      scenes: [scene("s1")],
    });
    expect(projectDuration(c)).toBe(10);
  });

  it("falls back to max clip end across all tracks", () => {
    const c = compiled({
      tracks: [
        track("primary", [clip("a", "s1", 0, 3)]),
        track("overlay", [clip("o", "s2", 5, 3)]),
      ],
      scenes: [scene("s1"), scene("s2")],
    });
    expect(projectDuration(c)).toBe(8);
  });
});

describe("projectFrameLayers", () => {
  it("renders no layer during a gap between clips", () => {
    const c = compiled({
      duration: 8,
      tracks: [
        track("primary", [clip("a", "s1", 0, 3), clip("b", "s2", 5, 3)]),
      ],
      scenes: [scene("s1"), scene("s2")],
    });
    expect(projectFrameLayers(c, 4)).toEqual([]);
    expect(projectFrameLayers(c, 1).map((l) => l.sceneIndex)).toEqual([0]);
    expect(projectFrameLayers(c, 6).map((l) => l.sceneIndex)).toEqual([1]);
  });

  it("produces no layer before a non-zero first clip", () => {
    const c = compiled({
      duration: 6,
      tracks: [track("primary", [clip("a", "s1", 2, 3)])],
      scenes: [scene("s1")],
    });
    expect(projectFrameLayers(c, 1)).toEqual([]);
    expect(projectFrameLayers(c, 2).map((l) => l.sceneIndex)).toEqual([0]);
  });

  it("renders an overlay clip above a primary clip", () => {
    const c = compiled({
      duration: 8,
      tracks: [
        track("primary", [clip("p", "s1", 0, 8)], 0),
        track("overlay", [clip("o", "s2", 2, 2)], 0),
      ],
      scenes: [scene("s1"), scene("s2")],
    });
    expect(projectFrameLayers(c, 3).map((l) => l.sceneIndex)).toEqual([0, 1]);
    expect(projectFrameLayers(c, 1).map((l) => l.sceneIndex)).toEqual([0]);
  });

  it("computes local time relative to absolute clip start", () => {
    const c = compiled({
      duration: 6,
      tracks: [
        track("primary", [clip("a", "s1", 0, 3), clip("b", "s2", 3, 3)]),
      ],
      scenes: [scene("s1"), scene("s2")],
    });
    expect(projectFrameLayers(c, 1)).toEqual([
      { sceneIndex: 0, localTime: 1, opacity: 1 },
    ]);
    expect(projectFrameLayers(c, 4)).toEqual([
      { sceneIndex: 1, localTime: 1, opacity: 1 },
    ]);
  });

  it("applies crossfade opacity ramps around overlapping clip starts", () => {
    const c = compiled({
      duration: 5.5,
      tracks: [
        track("primary", [
          clip("a", "s1", 0, 3, {
            transitionOut: { type: "crossfade", duration: 0.5 },
          }),
          clip("b", "s2", 2.5, 3, {
            transitionIn: { type: "crossfade", duration: 0.5 },
          }),
        ]),
      ],
      scenes: [scene("s1"), scene("s2")],
    });
    const layers = projectFrameLayers(c, 2.75);
    expect(layers.map((l) => l.sceneIndex)).toEqual([0, 1]);
    expect(layers[0]!.opacity).toBeCloseTo(0.5);
    expect(layers[1]!.opacity).toBeCloseTo(0.5);
  });

  it("applies a static clip opacity", () => {
    const c = compiled({
      duration: 3,
      tracks: [track("primary", [clip("a", "s1", 0, 3, { opacity: 0.4 })])],
      scenes: [scene("s1")],
    });
    expect(projectFrameLayers(c, 1)[0]!.opacity).toBeCloseTo(0.4);
  });

  it("applies trimStart and playbackRate to scene localTime", () => {
    const c = compiled({
      duration: 4,
      tracks: [
        track("primary", [
          clip("a", "s1", 0, 4, { trimStart: 1, playbackRate: 2 }),
        ]),
      ],
      scenes: [scene("s1")],
    });
    // compositionLocal=1 → media = 1*2 + 1 = 3
    expect(projectFrameLayers(c, 1, 30)[0]!.localTime).toBeCloseTo(3);
  });

  it("uses scene duration as sourceDuration so trimStart can exceed clip window", () => {
    const c = compiled({
      duration: 4,
      tracks: [
        track("primary", [
          clip("a", "s1", 0, 4, { trimStart: 3, playbackRate: 1 }),
        ]),
      ],
      // Scene is longer than the clip composition window.
      scenes: [scene("s1", 10)],
    });
    // compositionLocal=0 → media = 0*1 + 3 = 3 (not clamped to ~4)
    // compositionLocal=3.9 → media ≈ 6.9
    expect(projectFrameLayers(c, 0, 30)[0]!.localTime).toBeCloseTo(3);
    expect(projectFrameLayers(c, 3.9, 30)[0]!.localTime).toBeCloseTo(6.9);
  });
});

describe("buildFramePlan", () => {
  it("emits frames through the manual tail (duration > content)", () => {
    const c = compiled({
      duration: 10,
      tracks: [track("primary", [clip("a", "s1", 0, 8)])],
      scenes: [scene("s1")],
    });
    const plan = buildFramePlan(c, 1);
    expect(plan).toHaveLength(10);
    // Frame 8 (globalTime 8) is past the clip end → empty tail, but still a frame.
    expect(plan[8]!.globalTime).toBe(8);
    expect(plan[8]!.layers).toEqual([]);
  });

  it("keeps sceneIndex/localTime deterministic for a primary clip", () => {
    const c = compiled({
      duration: 3,
      tracks: [track("primary", [clip("a", "s1", 0, 3)])],
      scenes: [scene("s1")],
    });
    const plan = buildFramePlan(c, 1);
    expect(plan[1]!.sceneIndex).toBe(0);
    expect(plan[1]!.localTime).toBe(1);
  });
});

describe("chunkFramePlan", () => {
  it("splits frames into contiguous chunks", () => {
    const c = compiled({
      duration: 3,
      tracks: [track("primary", [clip("a", "s1", 0, 3)])],
      scenes: [scene("s1")],
    });
    const plan = buildFramePlan(c, 1);
    const chunks = chunkFramePlan(plan, 2);
    expect(chunks).toHaveLength(2);
    expect(chunks.flat()).toHaveLength(plan.length);
  });
});
