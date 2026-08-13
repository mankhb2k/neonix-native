import { describe, expect, it } from "vitest";
import {
  listTimelineSegments,
  resolveTimelineAtTime,
  timelineTotalDuration,
} from "./resolve-timeline";

function clip(sceneId: string, start: number, duration: number) {
  return {
    source: { kind: "scene" as const, sceneId },
    start,
    duration,
  };
}

function runtime(visualTracks: Array<{ order: number; clips: ReturnType<typeof clip>[] }>, duration?: number) {
  const scenes = visualTracks.flatMap((t) =>
    t.clips.map((c) => ({
      id: c.source.sceneId,
      duration: c.duration,
      name: c.source.sceneId,
    })),
  );
  return {
    timeline: {
      ...(duration !== undefined ? { duration } : {}),
      visualTracks: visualTracks.map((t, i) => ({
        id: `track-${i}`,
        order: t.order,
        clips: t.clips,
      })),
    },
    scenes,
  };
}

describe("resolveTimelineAtTime", () => {
  it("resolves sequential clips on one track", () => {
    const rt = runtime(
      [
        {
          order: 0,
          clips: [
            clip("scene.hook", 0, 4),
            clip("scene.harvard", 4, 5),
            clip("scene.newsfeed", 9, 17),
            clip("scene.outro", 26, 4),
          ],
        },
      ],
      30,
    );
    expect(resolveTimelineAtTime(rt, 0)?.sceneId).toBe("scene.hook");
    expect(resolveTimelineAtTime(rt, 3.9)?.sceneId).toBe("scene.hook");
    expect(resolveTimelineAtTime(rt, 4)?.sceneId).toBe("scene.harvard");
    expect(resolveTimelineAtTime(rt, 9)?.sceneId).toBe("scene.newsfeed");
    expect(resolveTimelineAtTime(rt, 26.9)?.sceneId).toBe("scene.outro");
  });

  it("returns null in empty tail and past end", () => {
    const rt = runtime([{ order: 0, clips: [clip("s1", 0, 8)] }], 10);
    expect(resolveTimelineAtTime(rt, 8)).toBeNull();
    expect(resolveTimelineAtTime(rt, 9.5)).toBeNull();
    expect(resolveTimelineAtTime(rt, 10)).toBeNull();
  });

  it("prefers higher order when clips overlap", () => {
    const rt = runtime(
      [
        { order: 0, clips: [clip("main", 0, 5)] },
        { order: 1, clips: [clip("over", 1, 2)] },
      ],
      5,
    );
    expect(resolveTimelineAtTime(rt, 1.5)?.sceneId).toBe("over");
  });

  it("lists segments sorted by start then order", () => {
    const rt = runtime(
      [
        { order: 1, clips: [clip("over", 0, 2)] },
        { order: 0, clips: [clip("main", 0, 5)] },
      ],
      5,
    );
    const segs = listTimelineSegments(rt);
    expect(segs.map((s) => s.sceneId)).toEqual(["main", "over"]);
    expect(timelineTotalDuration(rt)).toBe(5);
  });
});
