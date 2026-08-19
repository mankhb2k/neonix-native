import { describe, expect, it } from "vitest";
import {
  MCPApplyPatchInputSchema,
  MCPCompileProjectInputSchema,
  MCPCreateProjectInputSchema,
  MCPExplainDiagnosticsInputSchema,
  MCPInspectTimelineInputSchema,
  MCPListCapabilitiesInputSchema,
  MCPRenderPreviewFrameInputSchema,
  MCPValidateProjectInputSchema,
  MCP_TOOLS,
  canExecuteTool,
  computeMCPProjectHash,
  explainDiagnostics,
  inspectTimeline,
  listCapabilities,
  preflightCapabilities,
} from "../src";
import type { MotionProjectV1 } from "@motionvideo/motion-protocol";
import { visualLayerAtoms } from "@motionvideo/patterns";

function minimalProject(): MotionProjectV1 {
  return {
    format: "motion-project",
    formatVersion: 1,
    metadata: { id: "test-proj", name: "Test", locale: "en-US" },
    composition: {
      width: 1080,
      height: 1920,
      fps: 30,
      background: "#ffffff",
      colorSpace: "srgb",
      audioSampleRate: 48000,
    },
    assets: [],
    components: [],
    layers: [],
  };
}

describe("motion-mcp", () => {
  it("parses create_project input", () => {
    const input = MCPCreateProjectInputSchema.parse({
      metadata: { id: "p1", name: "Proj", locale: "en-US" },
      composition: {
        width: 1080,
        height: 1920,
        fps: 30,
        background: "#ffffff",
        colorSpace: "srgb",
        audioSampleRate: 48000,
      },
    });
    expect(input.metadata.name).toBe("Proj");
  });

  it("parses create_project with optional skillId", () => {
    const input = MCPCreateProjectInputSchema.parse({
      metadata: { id: "p1", name: "Proj", locale: "en-US" },
      composition: {
        width: 1080,
        height: 1920,
        fps: 30,
        background: "#ffffff",
        colorSpace: "srgb",
        audioSampleRate: 48000,
      },
      skillId: "motion/brand-intro",
    });
    expect(input.skillId).toBe("motion/brand-intro");
  });

  it("parses validate_project input", () => {
    const project = minimalProject();
    const input = MCPValidateProjectInputSchema.parse({ project });
    expect(input.project.metadata.id).toBe("test-proj");
  });

  it("parses apply_patch input", () => {
    const project = minimalProject();
    const input = MCPApplyPatchInputSchema.parse({
      project,
      patch: {
        format: "motion-project-patch",
        formatVersion: 1,
        baseRevision: 0,
        operations: [{ op: "setComposition", changes: { fps: 60 } }],
      },
    });
    expect(input.patch.operations).toHaveLength(1);
  });

  it("parses compile_project input", () => {
    const project = minimalProject();
    const input = MCPCompileProjectInputSchema.parse({
      project,
      targetFps: 60,
      includeSourceRefs: true,
    });
    expect(input.targetFps).toBe(60);
  });

  it("parses compile_project with defaults", () => {
    const project = minimalProject();
    const input = MCPCompileProjectInputSchema.parse({ project });
    expect(input.includeSourceRefs).toBe(true);
  });

  it("parses render_preview_frame input", () => {
    const project = minimalProject();
    const input = MCPRenderPreviewFrameInputSchema.parse({
      project,
      time: 1.5,
      width: 540,
      height: 960,
    });
    expect(input.time).toBe(1.5);
    expect(input.format).toBe("png");
  });

  it("parses list_capabilities input", () => {
    const input = MCPListCapabilitiesInputSchema.parse({
      filter: "primitive.",
      includeExperimental: true,
    });
    expect(input.filter).toBe("primitive.");
    expect(input.includeExperimental).toBe(true);
  });

  it("parses list_capabilities with defaults", () => {
    const input = MCPListCapabilitiesInputSchema.parse({});
    expect(input.includeExperimental).toBe(false);
  });

  it("parses inspect_timeline input", () => {
    const project = minimalProject();
    const input = MCPInspectTimelineInputSchema.parse({
      project,
      layerId: "main",
      verbose: true,
    });
    expect(input.layerId).toBe("main");
    expect(input.verbose).toBe(true);
  });

  it("parses explain_diagnostics input", () => {
    const input = MCPExplainDiagnosticsInputSchema.parse({
      diagnostics: [
        {
          path: "timeline",
          message: "Unknown scene: intro",
          severity: "error",
        },
      ],
    });
    expect(input.diagnostics).toHaveLength(1);
  });

  it("inspect_timeline keeps layer language, not track/clip language", () => {
    const tool = MCP_TOOLS.find((entry) => entry.name === "inspect_timeline");
    expect(tool?.description).toMatch(/root layers/i);
    expect(tool?.description).not.toMatch(/clips/i);
    expect(tool?.description).not.toMatch(/tracks/i);
  });

  it("all tool names are unique", () => {
    const names = MCP_TOOLS.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every tool has a recognized category", () => {
    const validCategories = ["project", "compile", "render", "inspect"];
    for (const tool of MCP_TOOLS) {
      expect(validCategories).toContain(tool.category);
    }
  });

  it("preflightCapabilities allows empty required", () => {
    const project = minimalProject();
    const result = preflightCapabilities(project, []);
    expect(result.allowed).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("preflightCapabilities always allows (capabilities removed from core)", () => {
    const project = minimalProject();
    const result = preflightCapabilities(project, []);
    expect(result.allowed).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("canExecuteTool always allows known tools (capabilities removed from core)", () => {
    const project = minimalProject();
    const result = canExecuteTool("create_project", project, []);
    expect(result.allowed).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("computeMCPProjectHash is stable", () => {
    const project = minimalProject();
    const a = computeMCPProjectHash(project);
    const b = computeMCPProjectHash(project);
    expect(a.projectHash).toBe(b.projectHash);
    expect(a.projectHashShort).toBe(b.projectHashShort);
  });

  it("computeMCPProjectHash changes when project changes", () => {
    const p1 = minimalProject();
    const p2 = {
      ...minimalProject(),
      metadata: { ...minimalProject().metadata, name: "Different" },
    };
    expect(computeMCPProjectHash(p1).projectHash).not.toBe(
      computeMCPProjectHash(p2).projectHash,
    );
  });

  it("lists all non-experimental capabilities by default", () => {
    const result = listCapabilities();
    expect(result.total).toBeGreaterThan(0);
    expect(result.capabilities.every((entry) => !entry.experimental)).toBe(
      true,
    );
  });

  it("listCapabilities filters by prefix", () => {
    const result = listCapabilities("primitive.");
    expect(
      result.capabilities.every((entry) => entry.id.startsWith("primitive.")),
    ).toBe(true);
  });

  it("includes experimental when requested", () => {
    const result = listCapabilities(undefined, true);
    expect(result.capabilities.some((entry) => entry.experimental)).toBe(true);
  });

  it("inspectTimeline summarizes root layers", () => {
    const project: MotionProjectV1 = {
      ...minimalProject(),
      layers: [
        {
          id: "main",
          type: "group",
          parentLayerId: null,
          zIndex: 0,
          frame: { width: 100, height: 100 },
          transform: {
            translate: { x: 0, y: 0 },
            scale: { x: 1, y: 1 },
            rotate: { z: 0 },
            skew: { x: 0, y: 0 },
            origin: { x: 0.5, y: 0.5 },
            depth: 0,
          },
          opacity: 100,
          timing: { start: 0, duration: 2 },
          payload: {},
          children: [
            {
              id: "text-1",
              type: "text",
              parentLayerId: "main",
              zIndex: 0,
              frame: { width: 40, height: 20 },
              transform: {
                translate: { x: 0, y: 0 },
                scale: { x: 1, y: 1 },
                rotate: { z: 0 },
                skew: { x: 0, y: 0 },
                origin: { x: 0.5, y: 0.5 },
                depth: 0,
              },
              opacity: 100,
              timing: { start: 0, duration: 2 },
              payload: {
                text: "Hello",
                fontSize: 16,
                color: "#ffffff",
                alignment: "left",
                wrap: "word",
                overflow: "clip",
              },
            },
          ],
        },
      ],
    };

    const result = inspectTimeline(project);
    expect(result.rootLayerCount).toBe(1);
    expect(result.totalDuration).toBe(2);
    expect(result.layers[0]?.id).toBe("main");
  });

  it("inspects an empty project", () => {
    const project = minimalProject();
    const result = inspectTimeline(project);
    expect(result.rootLayerCount).toBe(0);
    expect(result.layers).toEqual([]);
    expect(result.totalDuration).toBe(0);
  });

  it("inspects root layers", () => {
    const project = {
      ...minimalProject(),
      layers: [
        {
          id: "main",
          type: "group",
          parentLayerId: null,
          zIndex: 0,
          timing: { start: 0, duration: 3 },
          ...visualLayerAtoms({
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            originX: 0.5,
            originY: 0.5,
            opacity: 100,
            visible: true,
          }),
          children: [],
        },
        {
          id: "music",
          type: "audio",
          parentLayerId: null,
          zIndex: -1,
          timing: { start: 0, duration: 5 },
          payload: { assetId: "music-1" },
        },
      ],
    } as unknown as MotionProjectV1;
    const result = inspectTimeline(project);
    expect(result.rootLayerCount).toBe(2);
    expect(result.totalDuration).toBe(5);
    expect(result.layers.map((layer) => layer.id)).toEqual(["main", "music"]);
  });

  it("inspects a specific root layer by id", () => {
    const project = {
      ...minimalProject(),
      layers: [
        {
          id: "main",
          type: "group",
          parentLayerId: null,
          zIndex: 0,
          timing: { start: 0, duration: 2 },
          ...visualLayerAtoms({
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            originX: 0.5,
            originY: 0.5,
            opacity: 100,
            visible: true,
          }),
          children: [],
        },
        {
          id: "overlay",
          type: "group",
          parentLayerId: null,
          zIndex: 1,
          timing: { start: 0, duration: 1 },
          ...visualLayerAtoms({
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            originX: 0.5,
            originY: 0.5,
            opacity: 100,
            visible: true,
          }),
          children: [],
        },
      ],
    } as unknown as MotionProjectV1;
    const result = inspectTimeline(project, "overlay");
    expect(result.rootLayerCount).toBe(1);
    expect(result.layers[0]?.id).toBe("overlay");
    expect(result.layers[0]?.zIndex).toBe(1);
  });

  it("explainDiagnostics rewrites legacy scene errors", () => {
    const result = explainDiagnostics({
      locale: "en",
      suggestFixes: true,
      diagnostics: [
        {
          path: "timeline.sceneOrder",
          message: "Unknown scene: intro",
          severity: "error",
        },
      ],
    });
    expect(result.explanations[0]?.explanation).toContain("V1 has no scenes");
  });

  it("explains unknown layer diagnostics", () => {
    const result = explainDiagnostics({
      locale: "en",
      suggestFixes: true,
      diagnostics: [
        {
          path: "operations[0].target.layerId",
          message: "Unknown layer: xyz",
          severity: "error",
        },
      ],
    });
    expect(result.explanations).toHaveLength(1);
    expect(result.explanations[0]?.explanation).toContain("doesn't exist");
  });

  it("explains sceneOrder leak diagnostics", () => {
    const result = explainDiagnostics({
      locale: "en",
      suggestFixes: true,
      diagnostics: [
        {
          path: "output.project.timeline",
          message:
            "Skill output contains field 'sceneOrder' - use project.layers with root zIndex",
          severity: "error",
        },
      ],
    });
    expect(result.explanations[0]?.explanation).toContain("sceneOrder");
    expect(result.explanations[0]?.explanation).toContain("project.layers");
  });

  it("explains scene.transition V2 leak diagnostics", () => {
    const result = explainDiagnostics({
      locale: "en",
      suggestFixes: true,
      diagnostics: [
        {
          path: "output.project.scenes.0.transition",
          message:
            "Skill output contains V2 field 'scene.transition' - transitions are not V1 primitives; express effects as scene/component/layer animation",
          severity: "error",
        },
      ],
    });
    expect(result.explanations[0]?.explanation).toContain(
      "not a V1 timeline primitive",
    );
    expect(result.explanations[0]?.suggestedAction).toContain(
      "Remove transition",
    );
  });

  it("explains formatVersion diagnostics", () => {
    const result = explainDiagnostics({
      locale: "en",
      suggestFixes: true,
      diagnostics: [
        {
          path: "output.project.formatVersion",
          message:
            "Skill output contains formatVersion: 2 - V1 projects must use formatVersion: 1",
          severity: "error",
        },
      ],
    });
    expect(result.explanations[0]?.explanation).toContain("formatVersion");
    expect(result.explanations[0]?.explanation).toContain("project.layers");
  });

  it("explains post-patch validation failures", () => {
    const result = explainDiagnostics({
      locale: "en",
      suggestFixes: true,
      diagnostics: [
        {
          path: "(composition.fps)",
          message: "Post-patch validation: fps must be within [1, 120]",
          severity: "error",
        },
      ],
    });
    expect(result.explanations[0]?.explanation).toContain(
      "doesn't pass V1 schema validation",
    );
  });

  it("explains multiple diagnostics", () => {
    const result = explainDiagnostics({
      locale: "en",
      suggestFixes: true,
      diagnostics: [
        { path: "x", message: "Required", severity: "error" },
        { path: "y", message: "Unknown scene: foo", severity: "warning" },
      ],
    });
    expect(result.explanations).toHaveLength(2);
  });

  it("honors suggestFixes flag", () => {
    const withFixes = explainDiagnostics({
      locale: "en",
      diagnostics: [{ path: "x", message: "Required", severity: "error" }],
      suggestFixes: true,
    });
    expect(withFixes.explanations[0]?.suggestedAction).toBeDefined();

    const withoutFixes = explainDiagnostics({
      locale: "en",
      diagnostics: [{ path: "x", message: "Required", severity: "error" }],
      suggestFixes: false,
    });
    expect(
      withoutFixes.explanations[0]?.suggestedPatchOperation,
    ).toBeUndefined();
  });
});
