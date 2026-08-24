import { describe, expect, it } from "vitest";
import { createV2EditorProject } from "./projects";
import { applyV2EditorCommand } from "./commands";

describe("V2 editor command contract", () => {
  it("commits a typed layer patch and returns an inverse command", () => {
    const project = createV2EditorProject("shape");
    const result = applyV2EditorCommand(project, {
      type: "patch-layer",
      layerId: "shape",
      patch: {
        opacity: 0.5,
        transform: { translate: { x: 640 } },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.layers[0].opacity).toBe(0.5);
    expect(result.document.layers[0].transform.translate.x).toBe(640);
    expect(result.inverse.type).toBe("replace-layer");
  });

  it("restores the exact prior document through the inverse command", () => {
    const project = createV2EditorProject("shape");
    const result = applyV2EditorCommand(project, {
      type: "patch-layer",
      layerId: "shape",
      patch: {
        timing: { start: 2, duration: 4 },
        transform: { scale: { x: 1.5, y: 0.75 } },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const undone = applyV2EditorCommand(result.document, result.inverse);
    expect(undone.ok).toBe(true);
    if (!undone.ok) return;
    expect(undone.document).toEqual(project);
  });

  it("keeps the last valid document when a command fails schema validation", () => {
    const project = createV2EditorProject("shape");
    const result = applyV2EditorCommand(project, {
      type: "patch-layer",
      layerId: "shape",
      patch: { opacity: 2 },
    });

    expect(result.ok).toBe(false);
    expect(result.document.layers[0].opacity).toBe(1);
    expect(result.diagnostics[0]?.code).toBe("document_invalid");
  });

  it("returns a diagnostic for a missing layer without mutating the project", () => {
    const project = createV2EditorProject("shape");
    const result = applyV2EditorCommand(project, {
      type: "patch-layer",
      layerId: "missing",
      patch: { opacity: 0.5 },
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("layer_not_found");
    expect(result.document).toEqual(project);
  });

  it("adds a new top-level shape with a reversible command", () => {
    const project = createV2EditorProject("shape");
    const source = project.layers[0];
    const result = applyV2EditorCommand(project, {
      type: "add-layer",
      layer: {
        ...source,
        id: "ellipse-1",
        order: 1,
        payload: { shape: "ellipse" },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.layers).toHaveLength(2);
    expect(result.document.layers[1]?.payload).toEqual({ shape: "ellipse" });
    expect(result.inverse).toEqual({ type: "remove-layer", layerId: "ellipse-1" });
  });

  it("commits a multi-layer timing patch atomically", () => {
    const project = createV2EditorProject("shape");
    const source = project.layers[0];
    const withSecond = {
      ...project,
      layers: [
        source,
        { ...source, id: "shape-2", order: 1, timing: { start: 2, duration: 3 } },
      ],
    };
    const result = applyV2EditorCommand(withSecond, {
      type: "patch-layers",
      patches: {
        shape: { timing: { start: 1 } },
        "shape-2": { timing: { start: 3 } },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.layers.map((layer) => layer.timing.start)).toEqual([1, 3]);
    expect(result.inverse.type).toBe("replace-layers");
  });

  it("normalizes sibling order for a reorder command", () => {
    const project = createV2EditorProject("shape");
    const source = project.layers[0];
    const withSiblings = {
      ...project,
      layers: [
        { ...source, id: "layer-0", order: 0 },
        { ...source, id: "layer-1", order: 1 },
        { ...source, id: "layer-2", order: 2 },
      ],
    };
    const result = applyV2EditorCommand(withSiblings, {
      type: "reorder-layers",
      parentLayerId: null,
      orderedLayerIds: ["layer-0", "layer-2", "layer-1"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.document.layers
        .slice()
        .sort((left, right) => left.order - right.order)
        .map((layer) => [layer.id, layer.order]),
    ).toEqual([
      ["layer-0", 0],
      ["layer-2", 1],
      ["layer-1", 2],
    ]);
  });

  it("commits ordered effects as one reversible layer patch", () => {
    const project = createV2EditorProject("shape");
    const effects = [
      { id: "blur-1", type: "blur", radius: 8 },
      { id: "glow-1", type: "outer-glow", radius: 12, color: "#ffffff", opacity: 0.5 },
    ] as const;
    const result = applyV2EditorCommand(project, {
      type: "patch-layer",
      layerId: "shape",
      patch: { effects },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.layers[0]?.effects?.map((effect) => effect.id)).toEqual(["blur-1", "glow-1"]);
    const undone = applyV2EditorCommand(result.document, result.inverse);
    expect(undone.ok).toBe(true);
    if (undone.ok) expect(undone.document).toEqual(project);
  });

  it("rejects duplicate and over-limit effect ids atomically", () => {
    const project = createV2EditorProject("shape");
    const duplicate = applyV2EditorCommand(project, {
      type: "patch-layer",
      layerId: "shape",
      patch: {
        effects: [
          { id: "same", type: "blur", radius: 8 },
          { id: "same", type: "blur", radius: 16 },
        ],
      },
    });
    expect(duplicate.ok).toBe(false);
    expect(duplicate.document).toEqual(project);

    const overLimit = applyV2EditorCommand(project, {
      type: "patch-layer",
      layerId: "shape",
      patch: {
        effects: Array.from({ length: 9 }, (_, index) => ({ id: `blur-${index}`, type: "blur" as const, radius: 8 })),
      },
    });
    expect(overLimit.ok).toBe(false);
    expect(overLimit.document).toEqual(project);
  });
});
