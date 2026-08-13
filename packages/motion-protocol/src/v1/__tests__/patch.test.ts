import { describe, expect, it } from "vitest";
import {
  applyMotionProjectV1Patch,
  MotionProjectV1PatchSchema,
} from "../patch";
import type { MotionProjectV1 } from "../index";

const TRANSFORM = {
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  anchorX: 0.5,
  anchorY: 0.5,
  opacity: 1,
  visible: true,
  flipX: false,
  flipY: false,
};

function textLayer(id: string, zIndex = 0) {
  return {
    id,
    type: "text" as const,
    parentLayerId: null,
    zIndex,
    timing: { start: 0, duration: 3 },
    transform: TRANSFORM,
    payload: {
      content: { kind: "plain" as const, text: "Hello" },
      fontSize: 24,
      color: "#000000",
      alignment: "left" as const,
      wrap: "word" as const,
      overflow: "visible" as const,
    },
  };
}

function groupLayer(id: string, zIndex = 0) {
  return {
    id,
    type: "group" as const,
    parentLayerId: null,
    zIndex,
    timing: { start: 0, duration: 3 },
    transform: TRANSFORM,
    children: [],
  };
}

function minimalProject(): MotionProjectV1 {
  return {
    format: "motion-project",
    formatVersion: 1,
    metadata: { id: "test-proj", name: "Test", locale: "vi-VN" },
    composition: {
      width: 1080,
      height: 1920,
      fps: 30,
      background: "#ffffff",
      colorSpace: "srgb",
      audioSampleRate: 48000,
    },
    capabilities: { required: [] },
    dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
    tokens: {},
    variables: [],
    assets: [],
    components: [],
    layers: [],
    timeline: { duration: 8 },
    bindings: [],
    extensions: {},
  };
}

describe("V1 patch contract", () => {
  it("parses a valid patch with setComposition", () => {
    const patch = MotionProjectV1PatchSchema.parse({
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [{ op: "setComposition", changes: { fps: 60 } }],
    });
    expect(patch.formatVersion).toBe(1);
    expect(patch.operations[0]!.op).toBe("setComposition");
  });

  it("parses addLayer", () => {
    const patch = MotionProjectV1PatchSchema.parse({
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [{ op: "addLayer", layer: textLayer("title") }],
    });
    expect(patch.operations[0]!.op).toBe("addLayer");
  });

  it("rejects addScene", () => {
    const result = MotionProjectV1PatchSchema.safeParse({
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [{ op: "addScene", scene: { id: "intro" } }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid operation type", () => {
    const result = MotionProjectV1PatchSchema.safeParse({
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [{ op: "deleteEverything" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects patch with zero operations", () => {
    const result = MotionProjectV1PatchSchema.safeParse({
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [],
    });
    expect(result.success).toBe(false);
  });

  it("applies setComposition", () => {
    const result = applyMotionProjectV1Patch(minimalProject(), {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [{ op: "setComposition", changes: { fps: 60 } }],
    });
    expect(result.diagnostics).toHaveLength(0);
    expect(result.project!.composition.fps).toBe(60);
    expect(result.project!.composition.width).toBe(1080);
  });

  it("applies setTokens", () => {
    const result = applyMotionProjectV1Patch(minimalProject(), {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [
        { op: "setTokens", changes: { colors: { brand: "#ff0000" } } },
      ],
    });
    expect(result.diagnostics).toHaveLength(0);
    expect(result.project!.tokens.colors).toEqual({ brand: "#ff0000" });
  });

  it("adds a root layer", () => {
    const result = applyMotionProjectV1Patch(minimalProject(), {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [{ op: "addLayer", layer: textLayer("title") }],
    });
    expect(result.diagnostics).toHaveLength(0);
    expect(result.project!.layers).toHaveLength(1);
    expect(result.project!.layers[0]!.id).toBe("title");
  });

  it("rejects duplicate layer add", () => {
    const patch = {
      format: "motion-project-patch" as const,
      formatVersion: 1 as const,
      baseRevision: 0,
      operations: [{ op: "addLayer" as const, layer: textLayer("title") }],
    };
    const r1 = applyMotionProjectV1Patch(minimalProject(), patch);
    expect(r1.diagnostics).toHaveLength(0);
    const r2 = applyMotionProjectV1Patch(r1.project!, patch);
    expect(r2.diagnostics).toHaveLength(1);
    expect(r2.diagnostics[0]!.path).toContain("layer.id");
  });

  it("updates a layer", () => {
    const added = applyMotionProjectV1Patch(minimalProject(), {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [{ op: "addLayer", layer: textLayer("title") }],
    });
    const updated = applyMotionProjectV1Patch(added.project!, {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 1,
      operations: [
        {
          op: "updateLayer",
          layerId: "title",
          layer: { ...textLayer("title"), name: "Headline" },
        },
      ],
    });
    expect(updated.diagnostics).toHaveLength(0);
    expect(updated.project!.layers[0]!.name).toBe("Headline");
  });

  it("removes a layer", () => {
    const added = applyMotionProjectV1Patch(minimalProject(), {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [{ op: "addLayer", layer: textLayer("title") }],
    });
    const removed = applyMotionProjectV1Patch(added.project!, {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 1,
      operations: [{ op: "removeLayer", layerId: "title" }],
    });
    expect(removed.diagnostics).toHaveLength(0);
    expect(removed.project!.layers).toHaveLength(0);
  });

  it("trims a layer", () => {
    const added = applyMotionProjectV1Patch(minimalProject(), {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [{ op: "addLayer", layer: textLayer("title") }],
    });
    const trimmed = applyMotionProjectV1Patch(added.project!, {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 1,
      operations: [
        { op: "trimLayer", layerId: "title", start: 1, duration: 2 },
      ],
    });
    expect(trimmed.diagnostics).toHaveLength(0);
    expect(trimmed.project!.layers[0]!.timing).toEqual({
      start: 1,
      duration: 2,
    });
  });

  it("nests a child into a group", () => {
    const added = applyMotionProjectV1Patch(minimalProject(), {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [{ op: "addLayer", layer: groupLayer("main") }],
    });
    const nested = applyMotionProjectV1Patch(added.project!, {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 1,
      operations: [
        {
          op: "addLayer",
          layer: { ...textLayer("title"), parentLayerId: "main", zIndex: 0 },
        },
      ],
    });
    expect(nested.diagnostics).toHaveLength(0);
    expect(nested.project!.layers).toHaveLength(1);
    const group = nested.project!.layers[0]!;
    expect(group.type).toBe("group");
    if (group.type === "group") {
      expect(group.children).toHaveLength(1);
      expect(group.children[0]!.id).toBe("title");
    }
  });

  it("adds an audio root layer", () => {
    const result = applyMotionProjectV1Patch(minimalProject(), {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [
        {
          op: "addLayer",
          layer: {
            id: "music",
            type: "audio",
            parentLayerId: null,
            zIndex: -1,
            timing: { start: 0, duration: 8 },
            payload: { assetId: "asset-music" },
          },
        },
      ],
    });
    expect(result.diagnostics).toHaveLength(0);
    expect(result.project!.layers[0]!.type).toBe("audio");
    expect(result.project!.layers[0]!.zIndex).toBe(-1);
  });

  it("adds a variable and a layer binding", () => {
    const project = minimalProject();
    const withLayer = applyMotionProjectV1Patch(project, {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [{ op: "addLayer", layer: textLayer("title") }],
    });
    const add = applyMotionProjectV1Patch(withLayer.project!, {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 1,
      operations: [
        {
          op: "addVariable",
          variable: {
            id: "headline-text",
            name: "Headline",
            type: "string",
            value: "Hello",
          },
        },
        {
          op: "addBinding",
          binding: {
            id: "bind-1",
            source: { kind: "variable", variableId: "headline-text" },
            target: {
              type: "layer",
              layerId: "title",
              property: "payload.content.text",
            },
          },
        },
      ],
    });
    expect(add.diagnostics).toHaveLength(0);
    expect(add.project!.variables).toHaveLength(1);
    expect(add.project!.bindings[0]!.target).toEqual({
      type: "layer",
      layerId: "title",
      property: "payload.content.text",
    });
  });

  it("re-validates output and fails on invalid composition", () => {
    const result = applyMotionProjectV1Patch(minimalProject(), {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [{ op: "setValue", path: "composition.fps", value: -1 }],
    });
    expect(result.project).toBeNull();
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(
      result.diagnostics.some((d) => d.message.includes("Post-patch")),
    ).toBe(true);
  });

  it("sets an arbitrary deep path", () => {
    const result = applyMotionProjectV1Patch(minimalProject(), {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [
        { op: "setValue", path: "composition.background", value: "#000000" },
      ],
    });
    expect(result.diagnostics).toHaveLength(0);
    expect(result.project!.composition.background).toBe("#000000");
  });
});
