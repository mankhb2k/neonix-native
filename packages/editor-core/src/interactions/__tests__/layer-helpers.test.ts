import { describe, expect, it } from "vitest";
import {
  reorderLayerIds,
  reorderLayerIdsByInsert,
} from "../timeline/layer-reorder";

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

