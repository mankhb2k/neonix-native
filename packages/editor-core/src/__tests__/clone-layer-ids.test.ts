import { describe, expect, it } from "vitest";
import {
  visualLayerAtoms,
  type MotionLayer,
} from "@motionvideo/motion-protocol";
import { cloneLayerWithNewIds } from "../timeline/internal/scene-utils";

function createDeterministicId(): (prefix: string) => string {
  const counters = new Map<string, number>();
  return (prefix: string) => {
    const n = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, n);
    return `${prefix}_${n}`;
  };
}

function textLeaf(id: string, parentId: string): MotionLayer {
  return {
    id,
    type: "text",
    name: id,
    parentLayerId: parentId,
    zIndex: 0,
    timing: { start: 0, duration: 2 },
    ...visualLayerAtoms({ width: 100, height: 40 }),
    payload: {
      text: id,
      fontSize: 20,
      color: "#000000",
      alignment: "left",
    },
  } as unknown as MotionLayer;
}

function nestedGroupScene(): MotionLayer {
  const g1: MotionLayer = {
    id: "g1",
    type: "group",
    name: "g1",
    parentLayerId: "root",
    zIndex: 0,
    timing: { start: 0, duration: 5 },
    ...visualLayerAtoms({ width: 1920, height: 1080 }),
    children: [textLeaf("t1", "g1")],
  } as unknown as MotionLayer;
  return {
    id: "root",
    type: "group",
    name: "root",
    parentLayerId: null,
    zIndex: 0,
    timing: { start: 0, duration: 6 },
    ...visualLayerAtoms({ width: 1920, height: 1080 }),
    children: [g1, textLeaf("t2", "root")],
  } as unknown as MotionLayer;
}

describe("cloneLayerWithNewIds", () => {
  it("re-points parentLayerId for nested groups (not just the root)", () => {
    const cloned = cloneLayerWithNewIds(
      nestedGroupScene(),
      createDeterministicId(),
    );
    expect(cloned.type).toBe("group");
    if (cloned.type !== "group") return;

    // Root gets a fresh id; original is not mutated.
    expect(cloned.id).not.toBe("root");

    const [cg1, ct2] = cloned.children;
    expect(cg1?.type).toBe("group");
    if (cg1?.type !== "group") return;

    const ct1 = cg1.children[0];
    // Intermediate group re-points to the new root id.
    expect(cg1.parentLayerId).toBe(cloned.id);
    // Grandchild re-points to the new intermediate group id (the bug: it kept "g1").
    expect(ct1?.parentLayerId).toBe(cg1.id);
    // Direct leaf re-points to the new root id.
    expect(ct2?.parentLayerId).toBe(cloned.id);
  });

  it("produces a self-consistent parent/child graph after clone", () => {
    const cloned = cloneLayerWithNewIds(
      nestedGroupScene(),
      createDeterministicId(),
    );
    expect(cloned.type).toBe("group");
    if (cloned.type !== "group") return;

    const idToParent = new Map<string, string | null>();
    const walk = (nodes: MotionLayer[]): void => {
      for (const node of nodes) {
        idToParent.set(node.id, node.parentLayerId);
        if (node.type === "group") walk(node.children);
      }
    };
    walk(cloned.children);

    for (const [id, parent] of idToParent) {
      expect(parent).not.toBeNull();
      expect(parent).not.toBe("root"); // no stale reference to original root
      expect(parent).not.toBe("g1"); // no stale reference to original group
      if (parent) expect(idToParent.has(id)).toBe(true);
    }
  });

  it("does not mutate the input layer", () => {
    const input = nestedGroupScene();
    const before = JSON.stringify(input);
    cloneLayerWithNewIds(input, createDeterministicId());
    expect(JSON.stringify(input)).toBe(before);
    expect(input.id).toBe("root");
  });
});
