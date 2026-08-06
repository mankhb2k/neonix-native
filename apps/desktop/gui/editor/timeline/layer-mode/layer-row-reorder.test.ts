import { describe, expect, it } from "vitest";
import {
  reorderLayerNodeIds,
  reorderLayerNodeIdsByInsert,
  zIndexForLayerInsertGap,
} from "./layer-row-reorder";

describe("reorderLayerNodeIds", () => {
  it("moves a node to another row index", () => {
    expect(reorderLayerNodeIds(["a", "b", "c", "d"], "a", 2)).toEqual([
      "b",
      "c",
      "a",
      "d",
    ]);
    expect(reorderLayerNodeIds(["a", "b", "c"], "c", 0)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("no-ops when index is unchanged or id missing", () => {
    expect(reorderLayerNodeIds(["a", "b"], "a", 0)).toEqual(["a", "b"]);
    expect(reorderLayerNodeIds(["a", "b"], "z", 1)).toEqual(["a", "b"]);
  });
});

describe("reorderLayerNodeIdsByInsert", () => {
  it("inserts before a gap index (adjusting after removal)", () => {
    expect(reorderLayerNodeIdsByInsert(["a", "b", "c"], "a", 2)).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(reorderLayerNodeIdsByInsert(["a", "b", "c"], "c", 0)).toEqual([
      "c",
      "a",
      "b",
    ]);
    expect(reorderLayerNodeIdsByInsert(["a", "b", "c"], "a", 3)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("no-ops when dropping into the mover home gap", () => {
    expect(reorderLayerNodeIdsByInsert(["a", "b", "c"], "b", 1)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(reorderLayerNodeIdsByInsert(["a", "b", "c"], "b", 2)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("zIndexForLayerInsertGap", () => {
  it("places above / below / between ordered z indices", () => {
    expect(zIndexForLayerInsertGap([2, 1, 0], 0)).toBe(3);
    expect(zIndexForLayerInsertGap([2, 1, 0], 3)).toBe(-1);
    expect(zIndexForLayerInsertGap([4, 2, 0], 1)).toBe(3);
    expect(zIndexForLayerInsertGap([], 0)).toBe(0);
  });
});
