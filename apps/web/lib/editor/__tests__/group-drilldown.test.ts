import { beforeEach, describe, expect, it } from "vitest";

import { fixtureMultiSceneReferences } from "@/lib/editor/__fixtures__/projects";
import { useEditorStore } from "@/lib/editor/editor-store";
import { rootLayerIdOf, selectionNone } from "@motionvideo/editor-core";

/**
 * Group drill-down (clipkit double-click groups) + pure-layerId selection.
 *
 * fixtureMultiSceneReferences nests:
 *   scene.a (group) → node.a.root (group) → node.a.child (text)
 *   scene.b (group) → node.b.title (text)
 */
describe("group drill-down + pure layerId selection", () => {
  beforeEach(() => {
    const { project, clips, lanes } = fixtureMultiSceneReferences();
    useEditorStore.getState().loadProject(project, [], clips, lanes);
  });

  it("selectNode stores a pure layerId (no sceneId)", () => {
    useEditorStore.getState().selectNode("node.a.child");
    expect(useEditorStore.getState().selection).toEqual({
      kind: "node",
      layerId: "node.a.child",
    });
  });

  it("selectNode(null) clears the node selection", () => {
    useEditorStore.getState().selectNode("node.a.child");
    useEditorStore.getState().selectNode(null);
    expect(useEditorStore.getState().selection).toEqual(selectionNone());
  });

  it("enterGroup drills into a group by pushing groupPath", () => {
    useEditorStore.getState().enterGroup("scene.a");
    expect(useEditorStore.getState().groupPath).toEqual(["scene.a"]);
    // Drill-in clears any prior node selection.
    expect(useEditorStore.getState().selection).toEqual(selectionNone());

    // node.a.root is a nested group inside scene.a — drill in one more level.
    useEditorStore.getState().enterGroup("node.a.root");
    expect(useEditorStore.getState().groupPath).toEqual([
      "scene.a",
      "node.a.root",
    ]);
  });

  it("enterGroup is a no-op for a non-group id", () => {
    useEditorStore.getState().enterGroup("node.b.title");
    expect(useEditorStore.getState().groupPath).toEqual([]);
  });

  it("navigateGroupDepth pops groupPath back out", () => {
    useEditorStore.getState().enterGroup("scene.a");
    useEditorStore.getState().enterGroup("node.a.root");

    useEditorStore.getState().navigateGroupDepth(1);
    expect(useEditorStore.getState().groupPath).toEqual(["scene.a"]);

    useEditorStore.getState().navigateGroupDepth(0);
    expect(useEditorStore.getState().groupPath).toEqual([]);
  });

  it("rootLayerIdOf resolves a nested node to its root group", () => {
    const project = useEditorStore.getState().project!;
    expect(rootLayerIdOf(project, "node.a.child")).toBe("scene.a");
    expect(rootLayerIdOf(project, "node.a.root")).toBe("scene.a");
    expect(rootLayerIdOf(project, "scene.a")).toBe("scene.a");
    expect(rootLayerIdOf(project, "node.b.title")).toBe("scene.b");
    expect(rootLayerIdOf(project, "missing")).toBeNull();
  });

  it("reorderLayers swaps zIndex of scoped siblings", () => {
    const project = useEditorStore.getState().project!;
    expect(project.layers.find((l) => l.id === "scene.a")?.zIndex).toBe(0);
    expect(project.layers.find((l) => l.id === "scene.b")?.zIndex).toBe(1);

    useEditorStore.getState().reorderLayers("scene.a", "scene.b");

    const next = useEditorStore.getState().project!;
    expect(next.layers.find((l) => l.id === "scene.a")?.zIndex).toBe(1);
    expect(next.layers.find((l) => l.id === "scene.b")?.zIndex).toBe(0);
    expect(useEditorStore.getState().canUndo).toBe(true);
  });

  it("reorderLayers rejects ids that are not scoped siblings", () => {
    useEditorStore.getState().enterGroup("scene.a");
    const before = useEditorStore.getState().project!;
    const dirty = useEditorStore.getState().dirtyRevision;

    useEditorStore.getState().reorderLayers("node.a.root", "scene.b");

    const after = useEditorStore.getState();
    expect(after.project).toBe(before);
    expect(after.dirtyRevision).toBe(dirty);
    expect(before.layers.find((l) => l.id === "scene.a")?.zIndex).toBe(0);
    expect(before.layers.find((l) => l.id === "scene.b")?.zIndex).toBe(1);
  });
});
