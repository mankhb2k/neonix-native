import { describe, expect, it } from "vitest";
import { createFacebookHistoryDemoProject } from "./testing/facebook-history-demo";
import { compileProjectV3 } from "./testing/compile";
import {
  listTimelineSegments,
  resolveTimelineAtTime,
  timelineTotalDuration,
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
