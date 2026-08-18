import { describe, expect, it } from "vitest";
import {
  MotionProjectV1Schema,
  visualLayerAtoms,
  type MotionLayer,
} from "@motionvideo/motion-protocol";
import { groupLayers, ungroupLayers, isIdentityGroup } from "../document/group";
import { resolveGroupPath } from "../document/group-path";

function solid(
  id: string,
  opts: { z: number; start: number; duration: number },
): MotionLayer {
  return {
    id,
    type: "solid",
    parentLayerId: null,
    zIndex: opts.z,
    timing: { start: opts.start, duration: opts.duration },
    ...visualLayerAtoms({ width: 100, height: 100 }),
    payload: { color: "#ff0000" },
  } as MotionLayer;
}

function projectWith(layers: MotionLayer[]) {
  return MotionProjectV1Schema.parse({
    format: "motion-project",
    formatVersion: 1,
    metadata: { id: "group-test", name: "Group test", locale: "vi-VN" },
    composition: { width: 1080, height: 1920, fps: 30 },
    capabilities: {},
    dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
    tokens: {},
    variables: [],
    assets: [],
    components: [],
    timeline: { duration: 10 },
    bindings: [],
    layers,
  });
}

describe("groupLayers", () => {
  it("wraps selected root layers into a coordinate-identity group", () => {
    const a = solid("a", { z: 1, start: 2, duration: 3 });
    const b = solid("b", { z: 2, start: 4, duration: 2 });
    const c = solid("c", { z: 3, start: 0, duration: 1 });
    const result = groupLayers([a, b, c], ["a", "b"], "g");
    expect(result).not.toBeNull();
    if (!result) return;

    const group = result.layers.find((l) => l.id === "g");
    expect(group?.type).toBe("group");
    if (group?.type !== "group") return;

    expect(group.timing.start).toBe(2); // min child start
    expect(group.timing.duration).toBe(4); // (4-2)+2
    expect(group.zIndex).toBe(2); // front-most child zIndex
    expect(group.parentLayerId).toBeNull();
    expect(group.children).toHaveLength(2);
    expect(group.children[0]!.timing.start).toBe(0); // a: 2-2
    expect(group.children[1]!.timing.start).toBe(2); // b: 4-2
    expect(group.children[0]!.parentLayerId).toBe("g");
    expect(isIdentityGroup(group)).toBe(true);
    // Paint position preserved: group sits where the front-most child was.
    expect(result.layers.map((l) => l.id)).toEqual(["g", "c"]);
  });

  it("returns null when fewer than two ids are root layers", () => {
    const a = solid("a", { z: 1, start: 0, duration: 1 });
    expect(groupLayers([a], ["a"], "g")).toBeNull();
  });

  it("produces a schema-valid project", () => {
    const a = solid("a", { z: 1, start: 0, duration: 2 });
    const b = solid("b", { z: 2, start: 1, duration: 2 });
    const result = groupLayers([a, b], ["a", "b"], "g");
    expect(result).not.toBeNull();
    if (!result) return;
    const project = projectWith(result.layers);
    expect(project.layers.some((l) => l.id === "g")).toBe(true);
  });
});

describe("ungroupLayers", () => {
  it("round-trips groupLayers (bakes time back, restores parentLayerId)", () => {
    const a = solid("a", { z: 1, start: 2, duration: 3 });
    const b = solid("b", { z: 2, start: 4, duration: 2 });
    const c = solid("c", { z: 3, start: 0, duration: 1 });
    const grouped = groupLayers([a, b, c], ["a", "b"], "g");
    if (!grouped) throw new Error("expected group");
    const ungrouped = ungroupLayers(grouped.layers, "g");
    expect(ungrouped).not.toBeNull();
    if (!ungrouped) return;
    expect(ungrouped.liftedIds).toEqual(["a", "b"]);
    const byId = new Map(ungrouped.layers.map((l) => [l.id, l]));
    expect(byId.get("a")!.timing.start).toBe(2);
    expect(byId.get("b")!.timing.start).toBe(4);
    expect(byId.get("a")!.parentLayerId).toBeNull();
    expect(byId.get("b")!.parentLayerId).toBeNull();
  });
});

describe("resolveGroupPath", () => {
  it("scopes into a group and accumulates timeOffset", () => {
    const a = solid("a", { z: 1, start: 0, duration: 1 });
    const b = solid("b", { z: 2, start: 1, duration: 1 });
    const grouped = groupLayers([a, b], ["a", "b"], "g");
    if (!grouped) throw new Error("expected group");
    const resolved = resolveGroupPath(grouped.layers, ["g"]);
    expect(resolved.crumbs.map((c) => c.id)).toEqual(["g"]);
    expect(resolved.layers.map((l) => l.id)).toEqual(["a", "b"]);
    expect(resolved.timeOffset).toBe(0); // g.start === 0
  });

  it("stops early on a stale group id", () => {
    const a = solid("a", { z: 1, start: 0, duration: 1 });
    const resolved = resolveGroupPath([a], ["missing"]);
    expect(resolved.crumbs).toEqual([]);
    expect(resolved.layers.map((l) => l.id)).toEqual(["a"]);
  });
});
