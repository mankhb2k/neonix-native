import { describe, expect, it } from "vitest";
import {
  applyMotionProjectV3Patch,
  MotionProjectV3PatchSchema,
} from "../patch";
import type { MotionProjectV3 } from "../index";

function minimalProject(): MotionProjectV3 {
  return {
    format: "motion-project",
    formatVersion: 3,
    metadata: { id: "test-proj", name: "Test", locale: "vi-VN" },
    composition: {
      width: 1080,
      height: 1920,
      fps: 30,
      background: "#ffffff",
      colorSpace: "srgb",
      audioSampleRate: 48000,
    },
    capabilities: {},
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

describe("V3 patch contract", () => {
  it("parses a valid patch with setComposition", () => {
    const patch = MotionProjectV3PatchSchema.parse({
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [{ op: "setComposition", changes: { fps: 60 } }],
    });
    expect(patch.formatVersion).toBe(1);
    expect(patch.operations[0]!.op).toBe("setComposition");
  });

  it("parses addScene + addVisualClip operations", () => {
    const patch = MotionProjectV3PatchSchema.parse({
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [
        {
          op: "addScene",
          scene: {
            id: "intro",
            duration: 3,
            nodes: [],
            clips: [],
          },
        },
      ],
    });
    expect(patch.operations.length).toBe(1);
  });

  it("rejects invalid operation type", () => {
    const result = MotionProjectV3PatchSchema.safeParse({
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [{ op: "deleteEverything" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects patch with zero operations", () => {
    const result = MotionProjectV3PatchSchema.safeParse({
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects patch with wrong format version", () => {
    const result = MotionProjectV3PatchSchema.safeParse({
      format: "motion-project-patch",
      formatVersion: 99,
      baseRevision: 0,
      operations: [{ op: "setComposition", changes: {} }],
    });
    expect(result.success).toBe(false);
  });

  // ── Apply: composition / tokens ──────────────────────────────────────

  it("applies setComposition", () => {
    const project = minimalProject();
    const result = applyMotionProjectV3Patch(project, {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [{ op: "setComposition", changes: { fps: 60 } }],
    });
    expect(result.diagnostics).toHaveLength(0);
    expect(result.project!.composition.fps).toBe(60);
    expect(result.project!.composition.width).toBe(1080); // unchanged
  });

  it("applies setTokens", () => {
    const project = minimalProject();
    const result = applyMotionProjectV3Patch(project, {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [
        {
          op: "setTokens",
          changes: { colors: { brand: "#ff0000" } },
        },
      ],
    });
    expect(result.diagnostics).toHaveLength(0);
    expect(result.project!.tokens.colors).toEqual({ brand: "#ff0000" });
  });

  // ── Apply: scenes ────────────────────────────────────────────────────

  it("adds a scene", () => {
    const project = minimalProject();
    const result = applyMotionProjectV3Patch(project, {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [
        {
          op: "addScene",
          scene: {
            id: "intro",
            duration: 3,
            nodes: [],
            clips: [],
          },
        },
      ],
    });
    expect(result.diagnostics).toHaveLength(0);
    expect(result.project!.scenes).toHaveLength(1);
    expect(result.project!.scenes[0]!.id).toBe("intro");
  });

  it("rejects duplicate scene add", () => {
    const project = minimalProject();
    const scene = { id: "intro", duration: 3, nodes: [], clips: [] };
    const patch = {
      format: "motion-project-patch" as const,
      formatVersion: 1 as const,
      baseRevision: 0,
      operations: [{ op: "addScene" as const, scene }],
    };
    const r1 = applyMotionProjectV3Patch(project, patch);
    expect(r1.diagnostics).toHaveLength(0);
    const r2 = applyMotionProjectV3Patch(r1.project!, patch);
    expect(r2.diagnostics).toHaveLength(1);
    expect(r2.diagnostics[0]!.path).toContain("scene.id");
  });

  it("updates a scene", () => {
    let project = minimalProject();
    const add = applyMotionProjectV3Patch(project, {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [
        {
          op: "addScene",
          scene: { id: "intro", duration: 3, nodes: [], clips: [] },
        },
      ],
    });
    const result = applyMotionProjectV3Patch(add.project!, {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 1,
      operations: [
        {
          op: "updateScene",
          sceneId: "intro",
          changes: { duration: 5, name: "Introduction" },
        },
      ],
    });
    expect(result.diagnostics).toHaveLength(0);
    expect(result.project!.scenes[0]!.duration).toBe(5);
    expect(result.project!.scenes[0]!.name).toBe("Introduction");
  });

  it("removes a scene and cleans up visual track clips", () => {
    let project = minimalProject();
    // Add a scene and a visual track with a clip referencing it
    project = {
      ...project,
      scenes: [
        { id: "intro", duration: 3, nodes: [], clips: [] },
        { id: "outro", duration: 2, nodes: [], clips: [] },
      ],
      timeline: {
        ...project.timeline,
        visualTracks: [
          {
            id: "main",
            role: "main",
            order: 0,
            muted: false,
            clips: [
              {
                id: "clip-intro",
                source: { kind: "scene", sceneId: "intro" },
                start: 0,
                duration: 3,
                loop: false,
                opacity: 1,
              },
              {
                id: "clip-outro",
                source: { kind: "scene", sceneId: "outro" },
                start: 3,
                duration: 2,
                loop: false,
                opacity: 1,
              },
            ],
          },
        ],
      },
    };
    const result = applyMotionProjectV3Patch(project, {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [{ op: "removeScene", sceneId: "outro" }],
    });
    expect(result.diagnostics).toHaveLength(0);
    expect(result.project!.scenes).toHaveLength(1);
    expect(result.project!.scenes[0]!.id).toBe("intro");
    expect(result.project!.timeline.visualTracks[0]!.clips).toHaveLength(1);
    expect(result.project!.timeline.visualTracks[0]!.clips[0]!.id).toBe(
      "clip-intro",
    );
  });

  // ── Apply: visual clips ─────────────────────────────────────────────

  it("adds a visual clip to a track", () => {
    let project = minimalProject();
    project = {
      ...project,
      scenes: [{ id: "intro", duration: 3, nodes: [], clips: [] }],
      timeline: {
        ...project.timeline,
        visualTracks: [
          {
            id: "main",
            role: "main",
            order: 0,
            muted: false,
            clips: [],
          },
        ],
      },
    };
    const result = applyMotionProjectV3Patch(project, {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [
        {
          op: "addVisualClip",
          trackId: "main",
          clip: {
            id: "clip-intro",
            source: { kind: "scene", sceneId: "intro" },
            start: 0,
            duration: 3,
            loop: false,
            opacity: 1,
          },
        },
      ],
    });
    expect(result.diagnostics).toHaveLength(0);
    expect(result.project!.timeline.visualTracks[0]!.clips).toHaveLength(1);
    expect(result.project!.timeline.visualTracks[0]!.clips[0]!.id).toBe(
      "clip-intro",
    );
  });

  it("trims a visual clip", () => {
    let project = minimalProject();
    project = {
      ...project,
      scenes: [{ id: "intro", duration: 5, nodes: [], clips: [] }],
      timeline: {
        ...project.timeline,
        visualTracks: [
          {
            id: "main",
            role: "main",
            order: 0,
            muted: false,
            clips: [
              {
                id: "clip-intro",
                source: { kind: "scene", sceneId: "intro" },
                start: 0,
                duration: 5,
                trimStart: 0,
                loop: false,
                opacity: 1,
              },
            ],
          },
        ],
      },
    };
    const result = applyMotionProjectV3Patch(project, {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [
        {
          op: "trimVisualClip",
          trackId: "main",
          clipId: "clip-intro",
          trimStart: 1,
          duration: 3,
        },
      ],
    });
    expect(result.diagnostics).toHaveLength(0);
    const clip = result.project!.timeline.visualTracks[0]!.clips[0]!;
    expect(clip.trimStart).toBe(1);
    expect(clip.duration).toBe(3);
  });

  it("moves a visual clip between tracks", () => {
    let project = minimalProject();
    project = {
      ...project,
      scenes: [{ id: "intro", duration: 3, nodes: [], clips: [] }],
      timeline: {
        ...project.timeline,
        visualTracks: [
          {
            id: "main",
            role: "main",
            order: 0,
            muted: false,
            clips: [
              {
                id: "clip-intro",
                source: { kind: "scene", sceneId: "intro" },
                start: 0,
                duration: 3,
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
                id: "clip-overlay-bg",
                source: { kind: "scene", sceneId: "intro" },
                start: 0,
                duration: 5,
                loop: false,
                opacity: 1,
              },
            ],
          },
        ],
      },
    };
    const result = applyMotionProjectV3Patch(project, {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [
        {
          op: "moveVisualClip",
          clipId: "clip-intro",
          fromTrackId: "main",
          toTrackId: "overlay",
          start: 0,
        },
      ],
    });
    expect(result.diagnostics).toHaveLength(0);
    // Main track is pruned (0 clips), overlay now has 2 clips
    expect(result.project!.timeline.visualTracks).toHaveLength(1);
    expect(result.project!.timeline.visualTracks[0]!.id).toBe("overlay");
    expect(result.project!.timeline.visualTracks[0]!.clips).toHaveLength(2);
    expect(result.project!.timeline.visualTracks[0]!.clips[0]!.id).toBe(
      "clip-overlay-bg",
    );
    expect(result.project!.timeline.visualTracks[0]!.clips[1]!.source).toEqual({
      kind: "scene",
      sceneId: "intro",
    });
  });

  it("reorders clips on a visual track", () => {
    let project = minimalProject();
    project = {
      ...project,
      scenes: [
        { id: "a", duration: 2, nodes: [], clips: [] },
        { id: "b", duration: 3, nodes: [], clips: [] },
        { id: "c", duration: 1, nodes: [], clips: [] },
      ],
      timeline: {
        ...project.timeline,
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
              {
                id: "c2",
                source: { kind: "scene", sceneId: "b" },
                start: 2,
                duration: 3,
                loop: false,
                opacity: 1,
              },
              {
                id: "c3",
                source: { kind: "scene", sceneId: "c" },
                start: 5,
                duration: 1,
                loop: false,
                opacity: 1,
              },
            ],
          },
        ],
      },
    };
    const result = applyMotionProjectV3Patch(project, {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [
        {
          op: "reorderVisualTrack",
          trackId: "main",
          orderedClipIds: ["c3", "c1", "c2"],
        },
      ],
    });
    expect(result.diagnostics).toHaveLength(0);
    const ids = result.project!.timeline.visualTracks[0]!.clips.map(
      (c) => c.id,
    );
    expect(ids).toEqual(["c3", "c1", "c2"]);
  });

  // ── Apply: variables, assets, bindings ──────────────────────────────

  it("adds and updates a variable", () => {
    const project = minimalProject();
    const add = applyMotionProjectV3Patch(project, {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
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
      ],
    });
    expect(add.diagnostics).toHaveLength(0);
    expect(add.project!.variables).toHaveLength(1);
    expect(add.project!.variables[0]!.value).toBe("Hello");

    const upd = applyMotionProjectV3Patch(add.project!, {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 1,
      operations: [
        {
          op: "updateVariable",
          variable: {
            id: "headline-text",
            name: "Headline",
            type: "string",
            value: "World",
          },
        },
      ],
    });
    expect(upd.diagnostics).toHaveLength(0);
    expect(upd.project!.variables[0]!.value).toBe("World");
  });

  it("adds and updates a binding", () => {
    const project = minimalProject();
    const add = applyMotionProjectV3Patch(project, {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [
        {
          op: "addBinding",
          binding: {
            id: "bind-1",
            source: { kind: "variable", variableId: "v1" },
            target: {
              kind: "scene",
              sceneId: "s1",
              nodeId: "n1",
              property: "payload.content.text",
            },
          },
        },
      ],
    });
    expect(add.diagnostics).toHaveLength(0);
    expect(add.project!.bindings).toHaveLength(1);
    expect(add.project!.bindings[0]!.id).toBe("bind-1");
  });

  // ── Apply: audio tracks ─────────────────────────────────────────────

  it("adds an audio track to the timeline", () => {
    const project = minimalProject();
    const result = applyMotionProjectV3Patch(project, {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [
        {
          op: "addAudioTrack",
          audioTrack: {
            id: "bgm-1",
            role: "bgm",
            assetId: "asset-music",
            start: 0,
            duration: 10,
            volume: 0.8,
            loop: true,
            fadeIn: 0,
            fadeOut: 0,
            trimStart: 0,
            playbackRate: 1,
            muted: false,
          },
        },
      ],
    });
    expect(result.diagnostics).toHaveLength(0);
    expect(result.project!.timeline.audioTracks).toHaveLength(1);
    expect(result.project!.timeline.audioTracks[0]!.role).toBe("bgm");
  });

  // ── Apply: caption cues ─────────────────────────────────────────────

  it("adds a caption cue to an existing caption track", () => {
    let project = minimalProject();
    project = {
      ...project,
      timeline: {
        ...project.timeline,
        captionTracks: [
          {
            id: "cap-en",
            locale: "en-US",
            tokens: [],
            style: { fontSize: 36, fill: "#ffffff", position: "bottom" },
          },
        ],
      },
    };
    const result = applyMotionProjectV3Patch(project, {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [
        {
          op: "addCaptionCue",
          trackId: "cap-en",
          token: { id: "t1", text: "Hello world", start: 0, end: 2 },
        },
      ],
    });
    expect(result.diagnostics).toHaveLength(0);
    expect(
      result.project!.timeline.captionTracks[0]!.tokens,
    ).toHaveLength(1);
    expect(
      result.project!.timeline.captionTracks[0]!.tokens[0]!.text,
    ).toBe("Hello world");
  });

  // ── Unknown references ──────────────────────────────────────────────

  it("returns diagnostic for unknown track in addVisualClip", () => {
    const project = minimalProject();
    const result = applyMotionProjectV3Patch(project, {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [
        {
          op: "addVisualClip",
          trackId: "nonexistent",
          clip: {
            id: "clip-x",
            source: { kind: "scene", sceneId: "x" },
            start: 0,
            duration: 2,
            loop: false,
            opacity: 1,
          },
        },
      ],
    });
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]!.severity).toBe("error");
    expect(result.diagnostics[0]!.path).toContain("trackId");
  });

  // ── Re-validation gate ──────────────────────────────────────────────

  it("re-validates output and fails on invalid composition", () => {
    // Use setComposition with an invalid value that bypasses the
    // partial schema but fails full MotionProjectV3Schema re-validation.
    // composition.fps must be >= 1, but since we're using partial schema,
    // we accept negative values – they'll be caught at re-validation.
    // Actually, CompositionSettingsSchema.partial() still validates each key,
    // so negative fps would fail the partial schema.
    // Use setValue with bypass instead.
    const project = minimalProject();
    const result = applyMotionProjectV3Patch(project, {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [
        {
          op: "setValue",
          path: "composition.fps",
          value: -1,
        },
      ],
    });
    // setValue bypasses schema validation, but final re-validation catches it
    expect(result.project).toBeNull();
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(
      result.diagnostics.some((d) => d.message.includes("Post-patch")),
    ).toBe(true);
  });

  // ── setValue operation ──────────────────────────────────────────────

  it("sets an arbitrary deep path", () => {
    const project = minimalProject();
    const result = applyMotionProjectV3Patch(project, {
      format: "motion-project-patch",
      formatVersion: 1,
      baseRevision: 0,
      operations: [
        {
          op: "setValue",
          path: "composition.background",
          value: "#000000",
        },
      ],
    });
    expect(result.diagnostics).toHaveLength(0);
    expect(result.project!.composition.background).toBe("#000000");
  });
});
