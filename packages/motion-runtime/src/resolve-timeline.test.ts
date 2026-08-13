import { describe, expect, it } from "vitest";
import { createFacebookHistoryDemoProject } from "./testing/facebook-history-demo";
import { compileProjectV3 } from "./testing/compile";
import {
  listTimelineSegments,
  resolveTimelineAtTime,
  timelineTotalDuration,
  type TimelineProjectLike,
} from "./resolve-timeline";
import { compositionDurationInFrames } from "./evaluate-composition";

describe("resolveTimelineAtTime", () => {
  // v3 authoring project compiled through the v3 compiler (Phase 3).
  const runtime = compileProjectV3(createFacebookHistoryDemoProject());

  it("lists six scene segments totaling 27s", () => {
    const segments = listTimelineSegments(runtime);
    expect(segments).toHaveLength(6);
    expect(timelineTotalDuration(runtime)).toBe(27);
    expect(segments[0]?.sceneId).toBe("scene.hook");
    expect(segments[5]?.sceneId).toBe("scene.outro");
  });

  it("resolves boundaries across hard cuts", () => {
    expect(resolveTimelineAtTime(runtime, 0)?.sceneId).toBe("scene.hook");
    expect(resolveTimelineAtTime(runtime, 3.9)?.sceneId).toBe("scene.hook");
    expect(resolveTimelineAtTime(runtime, 4)?.sceneId).toBe("scene.harvard");
    expect(resolveTimelineAtTime(runtime, 9)?.sceneId).toBe("scene.newsfeed");
    expect(resolveTimelineAtTime(runtime, 26.9)?.sceneId).toBe("scene.outro");
  });

  it("maps local time relative to scene start", () => {
    const mid = resolveTimelineAtTime(runtime, 5);
    expect(mid?.sceneId).toBe("scene.harvard");
    expect(mid?.localTime).toBeCloseTo(1, 5);
    expect(mid?.sceneStart).toBe(4);
  });

  it("compositionDurationInFrames sums all scenes when sceneId omitted", () => {
    const frames = compositionDurationInFrames(runtime, undefined, 30);
    expect(frames).toBe(27 * 30);
  });
});

describe("timelineTotalDuration", () => {
  const clip = (
    sceneId: string,
    start: number,
    duration: number,
  ): TimelineProjectLike["timeline"]["visualTracks"][number]["clips"][number] => ({
    source: { kind: "scene", sceneId },
    start,
    duration,
  });

  it("returns explicit timeline.duration even when visual ends earlier", () => {
    const rt: TimelineProjectLike = {
      timeline: {
        duration: 10,
        visualTracks: [{ role: "primary", clips: [clip("s1", 0, 8)] }],
      },
      scenes: [{ id: "s1", duration: 8 }],
    };
    expect(timelineTotalDuration(rt)).toBe(10);
  });

  it("falls back to max visual clip end when duration is missing", () => {
    const rt: TimelineProjectLike = {
      timeline: {
        visualTracks: [
          { role: "primary", clips: [clip("s1", 0, 2), clip("s2", 2, 3)] },
        ],
      },
      scenes: [
        { id: "s1", duration: 2 },
        { id: "s2", duration: 3 },
      ],
    };
    expect(timelineTotalDuration(rt)).toBe(5);
  });

  it("returns 0 for an empty runtime with duration 0", () => {
    const rt: TimelineProjectLike = {
      timeline: { duration: 0, visualTracks: [] },
      scenes: [],
    };
    expect(timelineTotalDuration(rt)).toBe(0);
  });

  it("falls back to visual end when declared duration is 0", () => {
    const rt: TimelineProjectLike = {
      timeline: {
        duration: 0,
        visualTracks: [{ role: "primary", clips: [clip("s1", 0, 5)] }],
      },
      scenes: [{ id: "s1", duration: 5 }],
    };
    expect(timelineTotalDuration(rt)).toBe(5);
  });

  it("resolves scene-only sources without a component fallback", () => {
    const rt: TimelineProjectLike = {
      timeline: {
        visualTracks: [
          {
            role: "primary",
            clips: [
              {
                source: { kind: "component", componentId: "c1" },
                start: 0,
                duration: 3,
              },
            ],
          },
        ],
      },
      scenes: [{ id: "s1", duration: 3 }],
    };
    const segments = listTimelineSegments(rt);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.sceneId).toBe("");
  });

  it("returns null in the empty tail past visual content", () => {
    const rt: TimelineProjectLike = {
      timeline: {
        duration: 10,
        visualTracks: [{ role: "primary", clips: [clip("s1", 0, 8)] }],
      },
      scenes: [{ id: "s1", duration: 8 }],
    };
    expect(resolveTimelineAtTime(rt, 8)).toBeNull();
    expect(resolveTimelineAtTime(rt, 9.5)).toBeNull();
    expect(resolveTimelineAtTime(rt, 10)).toBeNull();
  });

  it("prefers primary over overlay when clips overlap", () => {
    const rt: TimelineProjectLike = {
      timeline: {
        duration: 5,
        visualTracks: [
          { role: "primary", clips: [clip("main", 0, 5)] },
          { role: "overlay", clips: [clip("over", 1, 2)] },
        ],
      },
      scenes: [
        { id: "main", duration: 5 },
        { id: "over", duration: 2 },
      ],
    };
    expect(resolveTimelineAtTime(rt, 1.5)?.sceneId).toBe("main");
  });
});
