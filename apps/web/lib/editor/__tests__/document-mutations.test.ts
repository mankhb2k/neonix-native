import { beforeEach, describe, expect, it } from "vitest";

import { fixtureBasePlusOverlay } from "@/lib/editor/__fixtures__/projects";
import { useEditorStore } from "@/lib/editor/editor-store";
import { nodeText } from "@motionvideo/editor-core";
import type { MotionLayer } from "@motionvideo/motion-protocol";

function layerById(
  layers: MotionLayer[],
  id: string,
): MotionLayer | undefined {
  for (const layer of layers) {
    if (layer.id === id) return layer;
    if (layer.type === "group") {
      const nested = layerById(layer.children, id);
      if (nested) return nested;
    }
  }
  return undefined;
}

describe("document mutations go through history/dirty/envelope", () => {
  beforeEach(() => {
    const { project, clips, lanes } = fixtureBasePlusOverlay();
    useEditorStore.getState().loadProject(project, [], clips, lanes);
  });

  it("updateBrand bumps dirtyRevision and undoes", () => {
    const before = useEditorStore.getState();
    const originalName = before.project!.metadata.name;
    const dirty = before.dirtyRevision;

    useEditorStore.getState().updateBrand({ name: "Acme" });

    const after = useEditorStore.getState();
    expect(after.project!.metadata.name).toBe("Acme");
    expect(after.dirtyRevision).toBe(dirty + 1);
    expect(after.canUndo).toBe(true);

    after.undo();
    expect(useEditorStore.getState().project!.metadata.name).toBe(originalName);
  });

  it("setAspectRatio writes composition size with undo", () => {
    const dirty = useEditorStore.getState().dirtyRevision;
    useEditorStore.getState().setAspectRatio("9:16");

    const after = useEditorStore.getState();
    expect(after.project!.composition.width).toBe(1080);
    expect(after.project!.composition.height).toBe(1920);
    expect(after.dirtyRevision).toBe(dirty + 1);
    expect(after.canUndo).toBe(true);

    after.undo();
    expect(useEditorStore.getState().project!.composition.width).toBe(1920);
    expect(useEditorStore.getState().project!.composition.height).toBe(1080);
  });

  it("set-node-metadata marks userModified and is undoable", () => {
    const dirty = useEditorStore.getState().dirtyRevision;
    useEditorStore.getState().dispatchPropertyCommand({
      type: "set-node-metadata",
      targets: [{ rootLayerId: "scene.base", layerId: "scene.base.title" }],
      patch: { name: "Headline" },
    });

    const after = useEditorStore.getState();
    const meta =
      after.envelope?.authoring.elementMeta["scene:scene.base:scene.base.title"];
    expect(meta?.semanticKey).toBe("Headline");
    expect(after.dirtyRevision).toBe(dirty + 1);
    expect(meta?.userModifiedProperties).toContain("metadata");
    expect(meta?.origin).toBe("user");
  });

  it("updateNodeText routes through property command (dirty + undo)", () => {
    const dirty = useEditorStore.getState().dirtyRevision;
    useEditorStore
      .getState()
      .updateNodeText("scene.base", "scene.base.title", "Hello");

    const after = useEditorStore.getState();
    expect(
      nodeText(layerById(after.project!.layers, "scene.base.title")),
    ).toBe("Hello");
    expect(after.dirtyRevision).toBe(dirty + 1);
    expect(after.canUndo).toBe(true);

    after.undo();
    expect(
      nodeText(
        layerById(useEditorStore.getState().project!.layers, "scene.base.title"),
      ),
    ).not.toBe("Hello");
  });
});
