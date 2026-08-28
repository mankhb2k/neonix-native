import { describe, expect, it } from "vitest";
import { createV2EditorProject } from "../document/demo-projects";
import { createEditorStore } from "./editor-store";

describe("EditorStore", () => {
  it("creates an isolated per-editor authoring snapshot", () => {
    const first = createEditorStore(createV2EditorProject("shape"));
    const second = createEditorStore(createV2EditorProject("overlap"));

    first.setState({ selectedLayerIds: ["shape"] });
    expect(first.getState().selectedLayerIds).toEqual(["shape"]);
    expect(second.getState().selectedLayerIds).toEqual([]);
    expect(first.getState().document.id).not.toBe(second.getState().document.id);
  });
});
