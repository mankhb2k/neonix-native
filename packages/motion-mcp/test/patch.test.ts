import { describe, expect, it } from "vitest";
import { createV2ShapeProject } from "./fixture";
import {
  MotionProtocolV2PatchSchema,
  applyMotionProtocolV2Patch,
} from "../src/patch";

describe("Protocol V2 patches", () => {
  it("adds and trims a certified layer", () => {
    const project = createV2ShapeProject("patch-project");
    const layer = createV2ShapeProject("added").layers[0]!;
    const patch = MotionProtocolV2PatchSchema.parse({
      format: "motion-protocol-patch",
      formatVersion: 2,
      baseRevision: 0,
      operations: [
        { op: "addLayer", layer: { ...layer, id: "added", zIndex: 1 } },
        { op: "trimLayer", layerId: "added", start: 1, duration: 2 },
      ],
    });
    const result = applyMotionProtocolV2Patch(project, patch);
    expect(result.diagnostics).toEqual([]);
    expect(result.project?.layers[1]?.timing).toEqual({ start: 1, duration: 2 });
  });

  it("rejects duplicate layer ids after a patch", () => {
    const project = createV2ShapeProject("patch-project");
    const layer = project.layers[0]!;
    const result = applyMotionProtocolV2Patch(project, {
      format: "motion-protocol-patch",
      formatVersion: 2,
      baseRevision: 0,
      operations: [{ op: "addLayer", layer }],
    });
    expect(result.project).toBeTruthy();
    expect(result.diagnostics[0]?.message).toContain("already exists");
  });
});
