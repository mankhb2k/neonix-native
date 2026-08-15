import { describe, expect, it } from "vitest";
import {
  listTimelineSegments,
  resolveTimelineAtTime,
  timelineTotalDuration,
} from "./resolve-timeline";
import { ROOT_LAYER_GRAPH_ID } from "./layer-graph";

function runtime(duration: number) {
  return { timeline: { duration } };
}

describe("resolveTimelineAtTime", () => {
  it("resolves the single layer-graph window", () => {
    const rt = runtime(30);
    expect(resolveTimelineAtTime(rt, 0)?.graphId).toBe(ROOT_LAYER_GRAPH_ID);
    expect(resolveTimelineAtTime(rt, 3.9)?.graphId).toBe(ROOT_LAYER_GRAPH_ID);
    expect(resolveTimelineAtTime(rt, 4)?.localTime).toBe(4);
    expect(resolveTimelineAtTime(rt, 26.9)?.graphId).toBe(ROOT_LAYER_GRAPH_ID);
  });

  it("returns null in empty tail and past end", () => {
    const rt = runtime(10);
    expect(resolveTimelineAtTime(rt, 10)).toBeNull();
    expect(resolveTimelineAtTime(rt, 10.5)).toBeNull();
  });

  it("lists one segment covering the full duration", () => {
    const rt = runtime(5);
    const segs = listTimelineSegments(rt);
    expect(segs.map((s) => s.graphId)).toEqual([ROOT_LAYER_GRAPH_ID]);
    expect(segs[0]!.duration).toBe(5);
    expect(timelineTotalDuration(rt)).toBe(5);
  });

  it("returns null for empty timeline", () => {
    expect(resolveTimelineAtTime(runtime(0), 0)).toBeNull();
    expect(listTimelineSegments(runtime(0))).toEqual([]);
  });
});
