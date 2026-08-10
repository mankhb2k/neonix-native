/**
 * Phase 5 — Compiler V3 entry point tests.
 *
 * Covers:
 *  - minimal + representative v3 projects compile to a valid runtime IR
 *  - visual tracks → sceneOrder, bindings applied, components synthesized
 *  - every CMP_* diagnostic code
 *  - deterministic compile cache keys
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  MotionRuntimeProjectSchema,
  V3,
} from "@motionvideo/motion-protocol";
import {
  buildCompileCacheKeyV3,
  compileMotionProjectV3,
  detectScheduleCycles,
} from "../index";

const fixtureDir = fileURLToPath(
  new URL("../../../motion-protocol/src/v3/__fixtures__", import.meta.url),
);

function loadV3Fixture(name: string): V3.MotionProjectV3 {
  const raw = readFileSync(`${fixtureDir}/${name}`, "utf8");
  return V3.MotionProjectV3Schema.parse(JSON.parse(raw));
}

const minimal = loadV3Fixture("minimal-empty.project.json");
const representative = loadV3Fixture("representative.project.json");

// ── Happy paths ───────────────────────────────────────────────────────

describe("compileMotionProjectV3 — happy paths", () => {
  it("compiles the minimal empty project to a valid runtime IR", () => {
    const result = compileMotionProjectV3(minimal);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const parsed = MotionRuntimeProjectSchema.safeParse(result.project);
    expect(parsed.success).toBe(true);
    expect(result.project.scenes).toEqual([]);
    expect(result.project.timeline.sceneOrder).toEqual([]);
    // v2 metadata derived from v3 composition (1920×1080 → 16:9).
    expect(result.project.metadata.aspectRatio).toBe("16:9");
    expect(result.project.metadata.fps).toBe(30);
  });

  it("compiles the representative project to a valid runtime IR", () => {
    const result = compileMotionProjectV3(representative);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(result.diagnostics, null, 2));
      return;
    }
    const parsed = MotionRuntimeProjectSchema.safeParse(result.project);
    expect(parsed.success).toBe(true);

    // visualTracks → sceneOrder, in clip order.
    expect(result.project.timeline.sceneOrder).toEqual(["intro", "outro"]);

    // composition 1080×1920 → 9:16.
    expect(result.project.metadata.aspectRatio).toBe("9:16");

    // audio track down-migrated (duration/playbackRate/muted stripped).
    const audio = result.project.timeline.audioTracks;
    expect(audio).toHaveLength(1);
    expect(audio[0]!.assetId).toBe("bgm");
    expect(audio[0]!.volume).toBe(0.8);

    // captions copied through.
    expect(result.project.timeline.captionTracks).toHaveLength(1);

    // scenes carry compiled tracks from scene-local clips.
    const intro = result.project.scenes.find((scene) => scene.id === "intro")!;
    expect(intro).toBeDefined();
    expect(intro.tracks.length).toBeGreaterThan(0);

    // camera node down-migrated.
    const cam = intro.nodes.find((node) => node.id === "cam")!;
    expect(cam).toBeDefined();
    expect(cam.payload).toMatchObject({ zoom: 1, projection: "orthographic" });
  });

  it("applies scene bindings before layout/text fitting", () => {
    const result = compileMotionProjectV3(representative);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const intro = result.project.scenes.find((scene) => scene.id === "intro")!;
    const subtitle = intro.nodes.find((node) => node.id === "subtitle")!;
    expect(subtitle.type).toBe("text");
    if (subtitle.type === "text") {
      // payload.text binding → payload.content after v2 text normalization.
      expect(subtitle.payload.content).toMatchObject({
        kind: "plain",
        text: "Mark Zuckerberg",
      });
    }
    const title = intro.nodes.find((node) => node.id === "title")!;
    expect(title.transform.opacity).toBe(0.9);
  });

  it("synthesizes a scene from an embedded component visual clip", () => {
    const project = structuredClone(representative);
    project.timeline.visualTracks = [
      {
        id: "component-track",
        role: "main",
        order: 0,
        muted: false,
        clips: [
          {
            id: "clip-logo-reveal",
            source: { kind: "component", componentId: "logo-reveal" },
            start: 0,
            duration: 4,
            opacity: 1,
            loop: false,
          },
        ],
      },
    ];
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(result.diagnostics, null, 2));
      return;
    }
    expect(result.project.timeline.sceneOrder).toEqual(["clip-logo-reveal"]);
    const synthesized = result.project.scenes.find(
      (scene) => scene.id === "clip-logo-reveal",
    )!;
    expect(synthesized).toBeDefined();
    expect(synthesized.duration).toBe(4);
    expect(synthesized.nodes.map((node) => node.id)).toEqual(["logo"]);
  });

  it("clones a scene when it is reused by multiple visual clips", () => {
    const project = structuredClone(representative);
    project.timeline.visualTracks = [
      {
        id: "main-track",
        role: "main",
        order: 0,
        muted: false,
        clips: [
          {
            ...project.timeline.visualTracks[0]!.clips[0]!,
            id: "clip-intro-a",
          },
          {
            ...project.timeline.visualTracks[0]!.clips[0]!,
            id: "clip-intro-b",
          },
        ],
      },
    ];
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.timeline.sceneOrder).toEqual([
      "intro",
      "intro@clip-intro-b",
    ]);
  });

  it("falls back to declaration order when there are no visual tracks", () => {
    const project = structuredClone(representative);
    project.timeline.visualTracks = [];
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.timeline.sceneOrder).toEqual(["intro", "outro"]);
  });
});

// ── Phase 6 — runtime IR enrichment ───────────────────────────────────

describe("compileMotionProjectV3 — Phase 6 runtime IR enrichment", () => {
  it("emits composition metadata, hash inputs, and source refs", () => {
    const result = compileMotionProjectV3(minimal);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const project = result.project;
    expect(project.composition).toEqual({
      width: 1920,
      height: 1080,
      fps: 30,
      background: "#ffffff",
      colorSpace: "srgb",
      audioSampleRate: 48000,
    });
    expect(project.compilerVersion).toBe("2.0.0-phase6");
    expect(project.capabilityFingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(project.runtimeHash).toMatch(/^[0-9a-f]{32}$/);
    expect(project.sourceRef).toEqual({ scenes: {} });
  });

  it("preserves v3 composition fidelity (1080×1920, 48000 Hz, safeArea)", () => {
    const result = compileMotionProjectV3(representative);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const project = result.project;
    expect(project.composition).toEqual({
      width: 1080,
      height: 1920,
      fps: 30,
      background: "#ffffff",
      colorSpace: "srgb",
      audioSampleRate: 48000,
      safeArea: {
        platform: "generic",
        top: 0.1,
        right: 0.05,
        bottom: 0.15,
        left: 0.05,
      },
    });
  });

  it("records per-scene and project-level source refs", () => {
    const result = compileMotionProjectV3(representative);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const project = result.project;
    expect(project.sourceRef?.scenes["intro"]).toBe("scenes:intro");
    expect(project.sourceRef?.scenes["outro"]).toBe("scenes:outro");
    const intro = project.scenes.find((scene) => scene.id === "intro")!;
    expect(intro.sourceRef).toEqual({ projectPath: ["scenes", "intro"] });
  });

  it("points synthesized component scenes back to their component", () => {
    const project = structuredClone(representative);
    project.timeline.visualTracks = [
      {
        id: "component-track",
        role: "main",
        order: 0,
        muted: false,
        clips: [
          {
            id: "clip-logo-reveal",
            source: { kind: "component", componentId: "logo-reveal" },
            start: 0,
            duration: 4,
            opacity: 1,
            loop: false,
          },
        ],
      },
    ];
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const synthesized = result.project.scenes.find(
      (scene) => scene.id === "clip-logo-reveal",
    )!;
    expect(synthesized).toBeDefined();
    expect(synthesized.sourceRef).toEqual({
      projectPath: ["components", "logo-reveal"],
      sourceModule: "logo-reveal@1.0.0",
    });
    expect(result.project.sourceRef?.scenes["clip-logo-reveal"]).toBe(
      "components:logo-reveal#logo-reveal@1.0.0",
    );
  });

  it("produces a deterministic runtimeHash that changes with input", () => {
    const first = compileMotionProjectV3(representative);
    const second = compileMotionProjectV3(representative);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.project.runtimeHash).toBe(second.project.runtimeHash);

    const mutated = structuredClone(representative);
    mutated.composition = { ...mutated.composition, width: 1280, height: 720 };
    const changed = compileMotionProjectV3(mutated);
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    expect(changed.project.runtimeHash).not.toBe(first.project.runtimeHash);
    expect(changed.project.composition?.width).toBe(1280);
  });
});

// ── Diagnostic codes ──────────────────────────────────────────────────

describe("compileMotionProjectV3 — CMP_* diagnostics", () => {
  it("CMP_UNRESOLVED_VARIABLE: binding references a missing variable", () => {
    const project = structuredClone(representative);
    project.bindings.push({
      id: "binding-ghost",
      source: { kind: "variable", variableId: "ghost-var" },
      target: {
        kind: "scene",
        sceneId: "intro",
        nodeId: "title",
        property: "transform.opacity",
      },
    });
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const code = result.diagnostics.find(
      (d) => d.code === "CMP_UNRESOLVED_VARIABLE",
    );
    expect(code).toBeDefined();
  });

  it("CMP_UNRESOLVED_COMPONENT: visual clip references a missing component", () => {
    const project = structuredClone(representative);
    project.timeline.visualTracks = [
      {
        id: "main-track",
        role: "main",
        order: 0,
        muted: false,
        clips: [
          {
            id: "clip-ghost-component",
            source: { kind: "component", componentId: "ghost" },
            start: 0,
            duration: 3,
            opacity: 1,
            loop: false,
          },
        ],
      },
    ];
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.diagnostics.some((d) => d.code === "CMP_UNRESOLVED_COMPONENT"),
    ).toBe(true);
  });

  it("CMP_UNRESOLVED_ASSET: node references a missing asset", () => {
    const project = structuredClone(representative);
    project.scenes[0]!.nodes.push({
      id: "ghost-img",
      type: "image",
      parentId: null,
      visible: true,
      locked: false,
      transform: {
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        anchorX: 0.5,
        anchorY: 0.5,
        opacity: 1,
        visible: true,
        flipX: false,
        flipY: false,
      },
      payload: { assetId: "ghost-asset", fit: "contain" },
    });
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.diagnostics.some((d) => d.code === "CMP_UNRESOLVED_ASSET"),
    ).toBe(true);
  });

  it("CMP_UNRESOLVED_PRESET: clip references an unknown preset (error)", () => {
    const project = structuredClone(representative);
    project.scenes[0]!.clips.push({
      id: "ghost-preset-clip",
      targetId: "title",
      schedule: { kind: "absolute", at: 0 },
      duration: 0.5,
      playback: { direction: "normal", iterations: 1, rate: 1 },
      source: { kind: "preset", presetId: "ghost-preset" },
    });
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.diagnostics.some((d) => d.code === "CMP_UNRESOLVED_PRESET"),
    ).toBe(true);
  });

  it("CMP_CYCLE_DETECTED: clip schedules form a cycle", () => {
    const project = structuredClone(representative);
    project.scenes[0]!.clips.push(
      {
        id: "clip-a",
        targetId: "title",
        schedule: { kind: "after", clipId: "clip-b" },
        duration: 0.5,
        playback: { direction: "normal", iterations: 1, rate: 1 },
        source: {
          kind: "tracks",
          tracks: [
            {
              targetId: "title",
              property: "transform.opacity",
              keys: [{ t: 0, v: 1 }],
            },
          ],
        },
      },
      {
        id: "clip-b",
        targetId: "title",
        schedule: { kind: "after", clipId: "clip-a" },
        duration: 0.5,
        playback: { direction: "normal", iterations: 1, rate: 1 },
        source: {
          kind: "tracks",
          tracks: [
            {
              targetId: "title",
              property: "transform.opacity",
              keys: [{ t: 0, v: 1 }],
            },
          ],
        },
      },
    );
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.diagnostics.some((d) => d.code === "CMP_CYCLE_DETECTED"),
    ).toBe(true);
  });

  it("CMP_COMPONENT_INTEGRITY_MISMATCH: dependency vs embedded integrity", () => {
    const project = structuredClone(representative);
    project.dependencies.components[0]!.integrity = "sha256:tampered";
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.diagnostics.some(
        (d) => d.code === "CMP_COMPONENT_INTEGRITY_MISMATCH",
      ),
    ).toBe(true);
  });

  it("CMP_BINDING_TYPE_MISMATCH: number variable bound to text (error)", () => {
    const project = structuredClone(representative);
    project.bindings.push({
      id: "binding-wrong-type",
      source: { kind: "variable", variableId: "title-opacity" },
      target: {
        kind: "scene",
        sceneId: "intro",
        nodeId: "subtitle",
        property: "payload.text",
      },
    });
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.diagnostics.some((d) => d.code === "CMP_BINDING_TYPE_MISMATCH"),
    ).toBe(true);
  });

  it("CMP_CLIP_TARGET_MISSING: scene clip targets an unknown node", () => {
    const project = structuredClone(representative);
    project.scenes[0]!.clips.push({
      id: "ghost-target-clip",
      targetId: "ghost-node",
      schedule: { kind: "absolute", at: 0 },
      duration: 0.5,
      playback: { direction: "normal", iterations: 1, rate: 1 },
      source: {
        kind: "tracks",
        tracks: [
          {
            targetId: "ghost-node",
            property: "transform.opacity",
            keys: [{ t: 0, v: 1 }],
          },
        ],
      },
    });
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.diagnostics.some((d) => d.code === "CMP_CLIP_TARGET_MISSING"),
    ).toBe(true);
  });

  it("rejects structurally invalid v3 projects with RUNTIME_VALIDATION_ERROR", () => {
    const project = structuredClone(minimal) as V3.MotionProjectV3;
    // composition.width must be positive — break it.
    (project.composition as { width: number }).width = -1;
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.diagnostics.some((d) => d.code === "RUNTIME_VALIDATION_ERROR"),
    ).toBe(true);
  });
});

// ── Schedule cycle helper ─────────────────────────────────────────────

describe("detectScheduleCycles", () => {
  it("detects a two-clip cycle", () => {
    const clips = [
      { id: "a", schedule: { kind: "after", clipId: "b" } },
      { id: "b", schedule: { kind: "after", clipId: "a" } },
    ];
    expect(detectScheduleCycles(clips).sort()).toEqual(["a"]);
  });

  it("returns empty for acyclic schedules", () => {
    const clips = [
      { id: "a", schedule: { kind: "absolute", at: 0 } },
      { id: "b", schedule: { kind: "after", clipId: "a" } },
    ];
    expect(detectScheduleCycles(clips)).toEqual([]);
  });
});

// ── Cache key ─────────────────────────────────────────────────────────

describe("buildCompileCacheKeyV3", () => {
  it("is deterministic for the same input", () => {
    const first = buildCompileCacheKeyV3(representative);
    const second = buildCompileCacheKeyV3(
      loadV3Fixture("representative.project.json"),
    );
    expect(first).toBe(second);
  });

  it("changes when project content changes", () => {
    const base = buildCompileCacheKeyV3(representative);
    const changed = structuredClone(representative);
    changed.metadata.name = "Renamed";
    expect(buildCompileCacheKeyV3(changed)).not.toBe(base);
  });

  it("changes when the profile changes", () => {
    const embedded = buildCompileCacheKeyV3(representative, {
      profile: "embedded-components",
    });
    const flattened = buildCompileCacheKeyV3(representative, {
      profile: "flattened-components",
    });
    expect(flattened).not.toBe(embedded);
  });

  it("changes when component dependencies change", () => {
    const base = buildCompileCacheKeyV3(representative);
    const changed = structuredClone(representative);
    changed.dependencies.components[0]!.integrity = "sha256:different";
    expect(buildCompileCacheKeyV3(changed)).not.toBe(base);
  });
});
