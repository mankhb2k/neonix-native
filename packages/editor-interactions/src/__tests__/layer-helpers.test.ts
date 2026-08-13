import { describe, expect, it } from "vitest";
import { clampNodeLocalTiming } from "../timeline/layer-timing";
import {
  reorderLayerLayerIds,
  reorderLayerLayerIdsByInsert,
} from "../timeline/layer-reorder";

describe("clampNodeLocalTiming", () => {
  it("keeps timing inside the container", () => {
    expect(clampNodeLocalTiming(8, 4, 10, 0.05)).toEqual({
      start: 6,
      duration: 4,
    });
  });
});

describe("reorderLayerLayerIdsByInsert", () => {
  it("moves a node before the given index", () => {
    expect(reorderLayerLayerIdsByInsert(["a", "b", "c"], "c", 0)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("supports absolute target index reorder", () => {
    expect(reorderLayerLayerIds(["a", "b", "c"], "a", 2)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });
});
