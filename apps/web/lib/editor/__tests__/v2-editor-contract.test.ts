import { describe, expect, it } from "vitest";
import { applyEditorCommand } from "@motionvideo/editor-core/document/commands";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";
import {
  createV2EditorProject,
  isV2EditorProjectId,
} from "../document/demo-projects";

describe("web editor Protocol V2 contract", () => {
  it("accepts every currently supported seeded document", () => {
    for (const projectId of ["shape", "overlap", "three-kingdoms"]) {
      expect(isV2EditorProjectId(projectId)).toBe(true);
      expect(
        MotionProtocolV2Schema.safeParse(createV2EditorProject(projectId)).success,
      ).toBe(true);
    }
  });

  it("keeps a valid document and inverse command across an edit", () => {
    const initial = createV2EditorProject("shape");
    const result = applyEditorCommand(initial, {
      type: "patch-layer",
      layerId: "shape",
      patch: { opacity: 0.5 },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(MotionProtocolV2Schema.safeParse(result.document).success).toBe(true);

    const undone = applyEditorCommand(result.document, result.inverse);
    expect(undone.ok).toBe(true);
    if (undone.ok) expect(undone.document).toEqual(initial);
  });
});
