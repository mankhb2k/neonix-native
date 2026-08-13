import { describe, expect, it } from "vitest";
import {
  MCPCreateProjectInputSchema,
  MCPValidateProjectInputSchema,
  MCPApplyPatchInputSchema,
  MCPListCapabilitiesInputSchema,
  MCPInspectTimelineInputSchema,
  MCPExplainDiagnosticsInputSchema,
  MCPCompileProjectInputSchema,
  MCPRenderPreviewFrameInputSchema,
  MCP_TOOLS,
  preflightCapabilities,
  canExecuteTool,
  computeMCPProjectHash,
  listCapabilities,
  inspectTimeline,
  explainDiagnostics,
} from "../mcp";
import type { MotionProjectV3 } from "../index";

function minimalProject(): MotionProjectV3 {
  return {
    format: "motion-project",
    formatVersion: 3,
    metadata: { id: "test-proj", name: "Test", locale: "en-US" },
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
    scenes: [],
    timeline: {
      visualTracks: [],
      audioTracks: [],
      captionTracks: [],
    },
    bindings: [],
    extensions: {},
  };
}

describe("V3 MCP contract", () => {
  // ── Input schemas ─────────────────────────────────────────────────

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
        operations: [
          { op: "setTokens", changes: { colors: { brand: "#ff0" } } },
        ],
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
    expect(input.format).toBe("png"); // default
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
      trackId: "main",
      verbose: true,
    });
    expect(input.trackId).toBe("main");
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

  // ── Tool registry ─────────────────────────────────────────────────

  it("has 8 registered MCP tools", () => {
    expect(MCP_TOOLS).toHaveLength(8);
  });

  it("all tool names are unique", () => {
    const names = MCP_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every tool has a recognized category", () => {
    const validCategories = ["project", "compile", "render", "inspect"];
    for (const tool of MCP_TOOLS) {
      expect(validCategories).toContain(tool.category);
    }
  });

  // ── Preflight ─────────────────────────────────────────────────────

  it("preflightCapabilities allows empty required", () => {
    const project = minimalProject();
    const result = preflightCapabilities(project, []);
    expect(result.allowed).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("preflightCapabilities detects missing capabilities", () => {
    const project: MotionProjectV3 = {
      ...minimalProject(),
      capabilities: { required: ["effect.glow", "primitive.video"] },
    };
    const result = preflightCapabilities(project, ["primitive.text"]);
    expect(result.allowed).toBe(false);
    expect(result.missing).toContain("effect.glow");
    expect(result.missing).toContain("primitive.video");
  });

  it("preflightCapabilities reports optional as recommended", () => {
    const project: MotionProjectV3 = {
      ...minimalProject(),
      capabilities: {
        required: ["primitive.text"],
        optional: ["effect.glow"],
      },
    };
    const result = preflightCapabilities(project, ["primitive.text"]);
    expect(result.allowed).toBe(true);
    expect(result.recommended).toContain("effect.glow");
  });

  it("canExecuteTool returns true with all capabilities available", () => {
    const project = minimalProject();
    const result = canExecuteTool("create_project", project, [
      "primitive.text",
      "anim.opacity",
    ]);
    expect(result.allowed).toBe(true);
  });

  it("canExecuteTool returns false with missing capabilities", () => {
    const project: MotionProjectV3 = {
      ...minimalProject(),
      capabilities: { required: ["primitive.video"] },
    };
    const result = canExecuteTool("create_project", project, []);
    expect(result.allowed).toBe(false);
    expect(result.missing).toContain("primitive.video");
  });

  // ── Project hash ──────────────────────────────────────────────────

  it("computeMCPProjectHash returns consistent hashes", () => {
    const project = minimalProject();
    const h1 = computeMCPProjectHash(project);
    const h2 = computeMCPProjectHash(project);
    expect(h1.projectHash).toBe(h2.projectHash);
    expect(h1.projectHashShort).toBe(h2.projectHashShort);
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

  // ── listCapabilities ──────────────────────────────────────────────

  it("lists all non-experimental capabilities by default", () => {
    const result = listCapabilities();
    expect(result.total).toBeGreaterThan(0);
    expect(result.capabilities.every((c) => !c.experimental)).toBe(true);
  });

  it("filters capabilities by prefix", () => {
    const result = listCapabilities("primitive.");
    expect(
      result.capabilities.every((c) => c.id.startsWith("primitive.")),
    ).toBe(true);
  });

  it("includes experimental when requested", () => {
    const result = listCapabilities(undefined, true);
    expect(result.capabilities.some((c) => c.experimental)).toBe(true);
  });

  // ── inspectTimeline ───────────────────────────────────────────────

  it("inspects an empty project", () => {
    const project = minimalProject();
    const result = inspectTimeline(project);
    expect(result.trackCount).toBe(0);
    expect(result.totalClipCount).toBe(0);
    expect(result.totalDuration).toBe(0);
  });

  it("inspects a project with visual tracks", () => {
    const project: MotionProjectV3 = {
      ...minimalProject(),
      scenes: [
        { id: "intro", duration: 3, space: "flat-2d", nodes: [], clips: [] },
        { id: "outro", duration: 2, space: "flat-2d", nodes: [], clips: [] },
      ],
      timeline: {
        ...minimalProject().timeline,
        visualTracks: [
          {
            id: "main",
            role: "main",
            order: 0,
            muted: false,
            clips: [
              {
                id: "c1",
                source: { kind: "scene", sceneId: "intro" },
                start: 0,
                duration: 3,
                loop: false,
                opacity: 1,
                transitionOut: { type: "fade", duration: 0.5 },
              },
              {
                id: "c2",
                source: { kind: "scene", sceneId: "outro" },
                start: 3,
                duration: 2,
                loop: false,
                opacity: 1,
              },
            ],
          },
        ],
        audioTracks: [
          {
            id: "bgm",
            role: "bgm",
            assetId: "music-1",
            start: 0,
            duration: 5,
            volume: 0.8,
            trimStart: 0,
            playbackRate: 1,
            fadeIn: 0,
            fadeOut: 0,
            loop: true,
            muted: false,
          },
        ],
        captionTracks: [
          {
            id: "cap-en",
            locale: "en-US",
            enabled: true,
            tokens: [
              { id: "t1", text: "Hello", start: 0, end: 2 },
              { id: "t2", text: "World", start: 2, end: 5 },
            ],
            segmentation: { maxLines: 2 },
            style: {
              fontSize: 36,
              fill: "#ffffff",
              position: "bottom",
              safeArea: "generic",
            },
            animation: { presetId: "none" },
          },
        ],
      },
    };
    const result = inspectTimeline(project);
    expect(result.trackCount).toBe(1);
    expect(result.totalClipCount).toBe(2);
    expect(result.totalDuration).toBe(5);
    expect(result.tracks[0]!.clips[0]!.transitionOut).toBe("fade");
    expect(result.audioTracks).toHaveLength(1);
    expect(result.audioTracks[0]!.role).toBe("bgm");
    expect(result.captionTracks).toHaveLength(1);
    expect(result.captionTracks[0]!.tokenCount).toBe(2);
    expect(result.captionTracks[0]!.firstToken).toBe("Hello");
    expect(result.captionTracks[0]!.lastToken).toBe("World");
  });

  it("inspects a specific track by id", () => {
    const project: MotionProjectV3 = {
      ...minimalProject(),
      scenes: [
        { id: "a", duration: 2, space: "flat-2d", nodes: [], clips: [] },
      ],
      timeline: {
        ...minimalProject().timeline,
        visualTracks: [
          {
            id: "main",
            role: "main",
            order: 0,
            muted: false,
            clips: [
              {
                id: "c1",
                source: { kind: "scene", sceneId: "a" },
                start: 0,
                duration: 2,
                loop: false,
                opacity: 1,
              },
            ],
          },
          {
            id: "overlay",
            role: "overlay",
            order: 1,
            muted: false,
            clips: [
              {
                id: "c2",
                source: { kind: "scene", sceneId: "a" },
                start: 0,
                duration: 1,
                loop: false,
                opacity: 0.5,
              },
            ],
          },
        ],
      },
    };
    const result = inspectTimeline(project, "overlay");
    expect(result.trackCount).toBe(1);
    expect(result.tracks[0]!.id).toBe("overlay");
    expect(result.tracks[0]!.role).toBe("overlay");
  });

  // ── explainDiagnostics ────────────────────────────────────────────

  it("explains unknown scene diagnostics", () => {
    const result = explainDiagnostics({
      locale: "en",
      suggestFixes: true,
      diagnostics: [
        {
          path: "operations[0].target.sceneId",
          message: "Unknown scene: xyz",
          severity: "error",
        },
      ],
    });
    expect(result.explanations).toHaveLength(1);
    expect(result.explanations[0]!.explanation).toContain("doesn't exist");
  });

  it("explains sceneOrder V2 leak diagnostics", () => {
    const result = explainDiagnostics({
      locale: "en",
      suggestFixes: true,
      diagnostics: [
        {
          path: "output.project.timeline",
          message:
            "Skill output contains V2 field 'sceneOrder' — use visualTracks instead",
          severity: "error",
        },
      ],
    });
    expect(result.explanations[0]!.explanation).toContain("sceneOrder");
    expect(result.explanations[0]!.explanation).toContain("visualTracks");
  });

  it("explains scene.transition V2 leak diagnostics", () => {
    const result = explainDiagnostics({
      locale: "en",
      suggestFixes: true,
      diagnostics: [
        {
          path: "output.project.scenes.0.transition",
          message:
            "Skill output contains V2 field 'scene.transition' — transitions belong on timeline VisualClip.transitionOut",
          severity: "error",
        },
      ],
    });
    expect(result.explanations[0]!.explanation).toContain("scene");
    expect(result.explanations[0]!.explanation).toContain("transition");
    expect(result.explanations[0]!.explanation).toContain("transitionOut");
  });

  it("explains formatVersion: 2 V2 leak diagnostics", () => {
    const result = explainDiagnostics({
      locale: "en",
      suggestFixes: true,
      diagnostics: [
        {
          path: "output.project.formatVersion",
          message:
            "Skill output contains formatVersion: 2 — V3 projects must use formatVersion: 3",
          severity: "error",
        },
      ],
    });
    expect(result.explanations[0]!.explanation).toContain("formatVersion");
    expect(result.explanations[0]!.explanation).toContain("V3");
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
    expect(result.explanations[0]!.explanation).toContain(
      "doesn't pass V3 schema validation",
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
    expect(withFixes.explanations[0]!.suggestedAction).toBeDefined();

    const withoutFixes = explainDiagnostics({
      locale: "en",
      diagnostics: [{ path: "x", message: "Required", severity: "error" }],
      suggestFixes: false,
    });
    expect(
      withoutFixes.explanations[0]!.suggestedPatchOperation,
    ).toBeUndefined();
  });
});
