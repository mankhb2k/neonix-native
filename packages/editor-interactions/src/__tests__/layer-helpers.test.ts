import { describe, expect, it } from "vitest";
import { clampNodeLocalTiming } from "../timeline/layer-timing";
import {
  reorderLayerIds,
  reorderLayerIdsByInsert,
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

describe("reorderLayerIdsByInsert", () => {
  it("moves a node before the given index", () => {
    expect(reorderLayerIdsByInsert(["a", "b", "c"], "c", 0)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("supports absolute target index reorder", () => {
    expect(reorderLayerIds(["a", "b", "c"], "a", 2)).toEqual(["b", "c", "a"]);
  });
});

describe("reorderLayer* deprecated aliases", () => {
  it("reorderLayerLayerIds mirrors reorderLayerIds", () => {
    expect(reorderLayerLayerIds(["a", "b", "c"], "a", 2)).toEqual(
      reorderLayerIds(["a", "b", "c"], "a", 2),
    );
  });

  it("reorderLayerLayerIdsByInsert mirrors reorderLayerIdsByInsert", () => {
    expect(reorderLayerLayerIdsByInsert(["a", "b", "c"], "c", 0)).toEqual(
      reorderLayerIdsByInsert(["a", "b", "c"], "c", 0),
    );
  });
});
