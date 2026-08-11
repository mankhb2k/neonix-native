import { describe, expect, it } from "vitest";
import {
  reorderLayerNodeIds,
  reorderLayerNodeIdsByInsert,
  isSiblingLocalMove,
  zIndexForLayerInsertGap,
  zIndexForLayerInsertGapInGroup,
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

// ── Phase 7: Sibling-local reorder validation ────────────────────────

describe("isSiblingLocalMove (Phase 7)", () => {
  function makeParentMap(
    nodes: Array<{ id: string; parentId: string | null }>,
  ): Map<string, string | null> {
    return new Map(nodes.map((n) => [n.id, n.parentId]));
  }

  it("allows reorder within root siblings", () => {
    // Layout: [g.char, g.head, head-img, title]
    // Roots: g.char (idx 0), title (idx 3)
    const orderedIds = ["group.char", "group.head", "head-image", "title"];
    const parentMap = makeParentMap([
      { id: "group.char", parentId: null },
      { id: "group.head", parentId: "group.char" },
      { id: "head-image", parentId: "group.head" },
      { id: "title", parentId: null },
    ]);

    // Move "title" (root, idx 3) before "group.char" (idx 0)
    // insertBeforeIndex=0 is within [0, 3+1]=[0,4] → valid
    expect(
      isSiblingLocalMove(
        { orderedNodeIds: orderedIds, parentIdByNodeId: parentMap },
        "title",
        0,
      ),
    ).toBe(true);

    // Move "title" after itself → no-op but valid
    expect(
      isSiblingLocalMove(
        { orderedNodeIds: orderedIds, parentIdByNodeId: parentMap },
        "title",
        4,
      ),
    ).toBe(true);
  });

  it("rejects cross-parent moves", () => {
    const orderedIds = ["group.char", "group.head", "head-image", "title"];
    const parentMap = makeParentMap([
      { id: "group.char", parentId: null },
      { id: "group.head", parentId: "group.char" },
      { id: "head-image", parentId: "group.head" },
      { id: "title", parentId: null },
    ]);

    // Move "head-image" (parent=head, idx 2) to root area (idx 0)
    // head-image's siblings are under group.head — none at root
    // Sibling range for parentId="group.head": it has only head-image at idx 2
    // So insertBeforeIndex 0 is outside [2,3] → rejected
    expect(
      isSiblingLocalMove(
        { orderedNodeIds: orderedIds, parentIdByNodeId: parentMap },
        "head-image",
        0,
      ),
    ).toBe(false);

    // Move to root area (idx 4 = after title)
    expect(
      isSiblingLocalMove(
        { orderedNodeIds: orderedIds, parentIdByNodeId: parentMap },
        "head-image",
        4,
      ),
    ).toBe(false);
  });

  it("allows reorder within child group", () => {
    // group.head has children: head-image (idx 2), head-text (idx 3)
    const orderedIds = [
      "group.char",
      "group.head",
      "head-image",
      "head-text",
      "title",
    ];
    const parentMap = makeParentMap([
      { id: "group.char", parentId: null },
      { id: "group.head", parentId: "group.char" },
      { id: "head-image", parentId: "group.head" },
      { id: "head-text", parentId: "group.head" },
      { id: "title", parentId: null },
    ]);

    // Move head-text (idx 3) before head-image (idx 2)
    // Sibling range for parent=head: [2,3], insertBefore=2 is within [2,4] → valid
    expect(
      isSiblingLocalMove(
        { orderedNodeIds: orderedIds, parentIdByNodeId: parentMap },
        "head-text",
        2,
      ),
    ).toBe(true);

    // Move head-image (idx 2) after head-text (idx 3)
    // insertBefore=4 is within [2,4] → valid (after last sibling)
    expect(
      isSiblingLocalMove(
        { orderedNodeIds: orderedIds, parentIdByNodeId: parentMap },
        "head-image",
        4,
      ),
    ).toBe(true);
  });

  it("returns false for unknown movingId", () => {
    expect(
      isSiblingLocalMove(
        {
          orderedNodeIds: ["a", "b"],
          parentIdByNodeId: new Map([
            ["a", null],
            ["b", null],
          ]),
        },
        "nonexistent",
        0,
      ),
    ).toBe(false);
  });
});

// ── Phase 3: Sibling-local reorder and drop ───────────────────────────

describe("zIndexForLayerInsertGapInGroup (Phase 3)", () => {
  it("returns 0 for empty sibling group", () => {
    expect(zIndexForLayerInsertGapInGroup([], 0)).toBe(0);
  });

  it("places above first sibling", () => {
    expect(zIndexForLayerInsertGapInGroup([5, 3, 1], 0)).toBe(6);
  });

  it("places below last sibling", () => {
    expect(zIndexForLayerInsertGapInGroup([5, 3, 1], 3)).toBe(0);
  });

  it("places between siblings with gap", () => {
    // [5, 3, 1] gap between 5 and 3 → return 4
    expect(zIndexForLayerInsertGapInGroup([5, 3, 1], 1)).toBe(4);
  });

  it("handles unsorted input (uses desc sort internally)", () => {
    expect(zIndexForLayerInsertGapInGroup([1, 5, 3], 0)).toBe(6);
    expect(zIndexForLayerInsertGapInGroup([1, 5, 3], 3)).toBe(0);
  });
});
