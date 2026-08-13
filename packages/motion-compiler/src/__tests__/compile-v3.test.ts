/**
 * Phase 5 — Compiler V3 entry point tests.
 *
 * Covers:
 *  - minimal + representative v3 projects compile to a valid runtime IR
 *  - visual tracks preserved, bindings applied, components synthesized
 *  - every CMP_* diagnostic code
 *  - deterministic compile cache keys
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  MotionRuntimeProject,
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

/** Return sceneIds from all scene-kind clips across all visual tracks, in order. */
function sceneIdsFromVisualTracks(
  tracks: MotionRuntimeProject["timeline"]["visualTracks"],
): string[] {
  return tracks.flatMap((track) =>
    track.clips
      .filter(
        (c): c is typeof c & { source: { kind: "scene"; sceneId: string } } =>
          c.source.kind === "scene",
      )
      .map((c) => c.source.sceneId),
  );
}

/**
 * Build a project that instantiates the embedded `logo-reveal` component as
 * a `type: "component"` scene node, sequenced by a single visual clip.
 */
function makeComponentNodeProject(
  options: {
    sceneId?: string;
    nodeId?: string;
    sceneDuration?: number;
    clipDuration?: number;
    componentId?: string;
    transform?: Partial<V3.ComponentNodeV3["transform"]>;
    publicProps?: V3.ComponentNodeV3["payload"]["publicProps"];
    sceneClips?: V3.MotionClipV3[];
  } = {},
): V3.MotionProjectV3 {
  const project = structuredClone(representative);
  const sceneId = options.sceneId ?? "comp-scene";
  const nodeId = options.nodeId ?? "comp-node";
  const componentId = options.componentId ?? "logo-reveal";
  const sceneDuration = options.sceneDuration ?? 4;
  const clipDuration = options.clipDuration ?? sceneDuration;

  const componentNode: V3.ComponentNodeV3 = {
    id: nodeId,
    type: "component",
    parentId: null,
    visible: true,
    locked: false,
    transform: {
      x: 100,
      y: 200,
      width: 256,
      height: 256,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      anchorX: 0.5,
      anchorY: 0.5,
      opacity: 1,
      visible: true,
      flipX: false,
      flipY: false,
      ...options.transform,
    },
    payload: {
      componentId,
      publicProps: options.publicProps ?? {},
    },
  };

  project.scenes.push({
    id: sceneId,
    name: "Component Scene",
    duration: sceneDuration,
    space: "flat-2d",
    nodes: [componentNode],
    clips: options.sceneClips ?? [],
  });
  project.timeline.visualTracks = [
    {
      id: "main-track",
      role: "main",
      order: 0,
      muted: false,
      clips: [
        {
          id: "clip-comp",
          source: { kind: "scene", sceneId },
          start: 0,
          duration: clipDuration,
          opacity: 1,
          loop: false,
        },
      ],
    },
  ];
  return project;
}

// ── Happy paths ───────────────────────────────────────────────────────

describe("compileMotionProjectV3 — happy paths", () => {
  it("compiles the minimal empty project to a valid runtime IR", () => {
    const result = compileMotionProjectV3(minimal);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const parsed = MotionRuntimeProjectSchema.safeParse(result.project);
    expect(parsed.success).toBe(true);
    expect(result.project.scenes).toEqual([]);
    expect(result.project.timeline.visualTracks).toHaveLength(1);
    expect(result.project.timeline.visualTracks[0]!.clips).toEqual([]);
    // v2 metadata derived from v3 composition (1920×1080 → 16:9).
    expect(result.project.metadata.aspectRatio).toBe("16:9");
    expect(result.project.metadata.fps).toBe(30);
  });

  it("compiles the representative project to a valid runtime IR", () => {
    const result = compileMotionProjectV3(representative);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      console.log(JSON.stringify(result.diagnostics, null, 2));
      return;
    }
    const parsed = MotionRuntimeProjectSchema.safeParse(result.project);
    expect(parsed.success).toBe(true);

    // visualTracks preserved, in track + clip order.
    expect(result.project.timeline.visualTracks).toHaveLength(1);
    expect(
      sceneIdsFromVisualTracks(result.project.timeline.visualTracks),
    ).toEqual(["intro", "outro"]);

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

  it("expands a component node into a wrapper group plus internal nodes", () => {
    const project = makeComponentNodeProject();
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      console.log(JSON.stringify(result.diagnostics, null, 2));
      return;
    }
    expect(
      sceneIdsFromVisualTracks(result.project.timeline.visualTracks),
    ).toEqual(["comp-scene"]);
    const scene = result.project.scenes.find((s) => s.id === "comp-scene")!;
    expect(scene).toBeDefined();
    expect(scene.duration).toBe(4);
    // wrapper group + internal "logo" node re-parented under the wrapper.
    expect(scene.nodes.map((node) => node.id)).toEqual([
      "comp-node__instance",
      "comp-node__logo",
    ]);
    expect(scene.nodes[0]!.type).toBe("group");
    expect(scene.nodes[1]!.parentId).toBe("comp-node__instance");
  });

  it("component node transform becomes the wrapper group transform", () => {
    const project = makeComponentNodeProject({
      transform: {
        x: 100,
        y: 200,
        rotation: 15,
        scaleX: 0.5,
        scaleY: 0.5,
        opacity: 0.8,
      },
    });
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      console.log(JSON.stringify(result.diagnostics, null, 2));
      return;
    }
    const scene = result.project.scenes.find((s) => s.id === "comp-scene")!;
    expect(scene).toBeDefined();
    expect(scene.nodes).toHaveLength(2);
    const wrapperGroup = scene.nodes[0]!;
    expect(wrapperGroup.id).toBe("comp-node__instance");
    expect(wrapperGroup.type).toBe("group");
    expect(wrapperGroup.transform.x).toBe(100);
    expect(wrapperGroup.transform.y).toBe(200);
    expect(wrapperGroup.transform.rotation).toBe(15);
    expect(wrapperGroup.transform.scaleX).toBe(0.5);
    expect(wrapperGroup.transform.scaleY).toBe(0.5);
    expect(wrapperGroup.transform.opacity).toBe(0.8);
    const logoNode = scene.nodes[1]!;
    expect(logoNode.id).toBe("comp-node__logo");
    expect(logoNode.parentId).toBe("comp-node__instance");
  });

  it("produces deterministic internal node ids for component nodes", () => {
    const project = makeComponentNodeProject();
    const first = compileMotionProjectV3(project);
    const second = compileMotionProjectV3(project);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    const sceneA = first.project.scenes.find((s) => s.id === "comp-scene")!;
    const sceneB = second.project.scenes.find((s) => s.id === "comp-scene")!;
    expect(sceneA.nodes.map((n) => n.id)).toEqual(
      sceneB.nodes.map((n) => n.id),
    );
    expect(first.project.runtimeHash).toBe(second.project.runtimeHash);
  });

  it("scene-local motion targeting a component node compiles to wrapper motion", () => {
    const project = makeComponentNodeProject({
      sceneClips: [
        {
          id: "clip-anim",
          targetId: "comp-node",
          schedule: { kind: "absolute", at: 0 },
          duration: 2,
          playback: { direction: "normal", iterations: 1, rate: 1 },
          source: {
            kind: "tracks",
            tracks: [
              {
                targetId: "comp-node",
                property: "transform.x",
                keys: [
                  { t: 0, v: 0 },
                  { t: 2, v: 200 },
                ],
              },
            ],
          },
        },
      ],
    });
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      console.log(JSON.stringify(result.diagnostics, null, 2));
      return;
    }
    const scene = result.project.scenes.find((s) => s.id === "comp-scene")!;
    expect(scene.nodes).toHaveLength(2);
    expect(scene.nodes[0]!.id).toBe("comp-node__instance");
    expect(scene.nodes[0]!.type).toBe("group");
    expect(scene.nodes[1]!.parentId).toBe("comp-node__instance");
    // Motion targeting the component node is remapped to the wrapper group.
    expect(scene.tracks).toHaveLength(1);
    expect(scene.tracks[0]!.targetId).toBe("comp-node__instance");
    expect(scene.tracks[0]!.property).toBe("transform.x");
  });

  it("golden: component node expansion is deterministic with transform + tracks", () => {
    const project = makeComponentNodeProject({
      transform: {
        x: 100,
        y: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
        visible: true,
      },
      sceneClips: [
        {
          id: "clip-anim",
          targetId: "comp-node",
          schedule: { kind: "absolute", at: 0 },
          duration: 4,
          playback: { direction: "normal", iterations: 1, rate: 1 },
          source: {
            kind: "tracks",
            tracks: [
              {
                targetId: "comp-node",
                property: "transform.x",
                valueKind: "number",
                keys: [
                  { t: 0, v: 100 },
                  { t: 2, v: 300, easing: "easeOut" },
                ],
              },
              {
                targetId: "comp-node",
                property: "transform.opacity",
                keys: [
                  { t: 0, v: 0 },
                  { t: 1, v: 1 },
                ],
              },
            ],
          },
        },
      ],
    });
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      console.log(JSON.stringify(result.diagnostics, null, 2));
      return;
    }
    const scene = result.project.scenes.find((s) => s.id === "comp-scene")!;

    // ── Deterministic wrapper group ──────────────────────────────────
    expect(scene.nodes).toHaveLength(2);
    const wrapper = scene.nodes[0]!;
    expect(wrapper.id).toBe("comp-node__instance");
    expect(wrapper.type).toBe("group");
    expect(wrapper.parentId).toBeNull();
    expect(wrapper.transform.x).toBe(100);
    expect(wrapper.transform.y).toBe(0);
    expect(wrapper.transform.opacity).toBe(1);
    expect(wrapper.transform.visible).toBe(true);

    const logo = scene.nodes[1]!;
    expect(logo.parentId).toBe("comp-node__instance");
    expect(logo.type).toBe("solid");

    // ── Deterministic motion tracks ──────────────────────────────────
    expect(scene.tracks).toHaveLength(2);

    const txTrack = scene.tracks.find((t) => t.property === "transform.x")!;
    expect(txTrack.targetId).toBe("comp-node__instance");
    expect(txTrack.keys).toHaveLength(2);
    expect(txTrack.keys[0]!.t).toBe(0);
    expect(txTrack.keys[0]!.v).toBe(100);
    expect(txTrack.keys[1]!.t).toBe(2);
    expect(txTrack.keys[1]!.v).toBe(300);
    expect(txTrack.keys[1]!.easing).toBe("easeOut");

    const opacityTrack = scene.tracks.find(
      (t) => t.property === "transform.opacity",
    )!;
    expect(opacityTrack.targetId).toBe("comp-node__instance");
    expect(opacityTrack.keys).toHaveLength(2);
    expect(opacityTrack.keys[0]!.t).toBe(0);
    expect(opacityTrack.keys[0]!.v).toBe(0);
    expect(opacityTrack.keys[1]!.t).toBe(1);
    expect(opacityTrack.keys[1]!.v).toBe(1);
  });

  it("applies transitionIn on a scene clip wrapping a component node", () => {
    const project = makeComponentNodeProject();
    project.timeline.visualTracks[0]!.clips[0]!.transitionIn = {
      type: "fade",
      duration: 0.5,
    };
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      console.log(JSON.stringify(result.diagnostics, null, 2));
      return;
    }
    const vizTrack = result.project.timeline.visualTracks[0]!;
    expect(vizTrack.role).toBe("primary");
    const clip = vizTrack.clips[0] as Record<string, unknown>;
    expect(clip.transitionIn).toEqual({ type: "fade", duration: 0.5 });
  });

  it("applies variant overrides through public targets", () => {
    const project = makeComponentNodeProject();
    const component = project.components.find(
      (c) => c.id === "logo-reveal",
    )!;
    component.variants = [
      {
        id: "accent",
        name: "Accent",
        overrides: { "logo-color": "#ff0000" },
        params: {},
      },
    ];
    const scene = project.scenes.find((s) => s.id === "comp-scene")!;
    const compNode = scene.nodes.find(
      (n) => n.type === "component",
    ) as V3.ComponentNodeV3;
    compNode.payload.variantId = "accent";

    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const runtimeScene = result.project.scenes.find(
      (s) => s.id === "comp-scene",
    )!;
    const logo = runtimeScene.nodes.find(
      (n) => n.id === "comp-node__logo",
    ) as unknown as { payload: Record<string, unknown> };
    expect(logo.payload.color).toBe("#ff0000");
  });

  it("consumer publicProps override variant overrides", () => {
    const project = makeComponentNodeProject({
      publicProps: { "logo-color": "#00ff00" },
    });
    const component = project.components.find(
      (c) => c.id === "logo-reveal",
    )!;
    component.variants = [
      {
        id: "accent",
        name: "Accent",
        overrides: { "logo-color": "#ff0000" },
        params: {},
      },
    ];
    const scene = project.scenes.find((s) => s.id === "comp-scene")!;
    const compNode = scene.nodes.find(
      (n) => n.type === "component",
    ) as V3.ComponentNodeV3;
    compNode.payload.variantId = "accent";

    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const runtimeScene = result.project.scenes.find(
      (s) => s.id === "comp-scene",
    )!;
    const logo = runtimeScene.nodes.find(
      (n) => n.id === "comp-node__logo",
    ) as unknown as { payload: Record<string, unknown> };
    expect(logo.payload.color).toBe("#00ff00");
  });

  it("rejects a visual clip carrying the removed instanceTransform field", () => {
    const project = structuredClone(representative);
    project.timeline.visualTracks = [
      {
        id: "main-track",
        role: "main",
        order: 0,
        muted: false,
        clips: [
          {
            id: "clip-intro",
            source: { kind: "scene", sceneId: "intro" },
            start: 0,
            duration: 3,
            opacity: 1,
            loop: false,
            // @ts-expect-error — instanceTransform is no longer a visual clip field
            instanceTransform: { x: 100 },
          },
        ],
      },
    ];
    // Schema-level .strict() rejects the unknown key before CMP validation.
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.diagnostics.some((d) => d.code === "RUNTIME_VALIDATION_ERROR"),
    ).toBe(true);
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
    expect(
      sceneIdsFromVisualTracks(result.project.timeline.visualTracks),
    ).toEqual(["intro", "intro@clip-intro-b"]);
  });

  it("falls back to declaration order when there are no visual tracks", () => {
    const project = structuredClone(representative);
    project.timeline.visualTracks = [];
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      sceneIdsFromVisualTracks(result.project.timeline.visualTracks),
    ).toEqual(["intro", "outro"]);
  });
});

// ── Phase 2 — track-preserving compiler output ─────────────────────────

describe("compileMotionProjectV3 — Phase 2 track preservation", () => {
  it("preserves two visual tracks with distinct roles and ids", () => {
    const project = structuredClone(representative);
    project.timeline.visualTracks = [
      {
        id: "main-track",
        role: "main",
        order: 0,
        muted: false,
        clips: [
          {
            id: "clip-intro",
            source: { kind: "scene", sceneId: "intro" },
            start: 0,
            duration: 3,
            opacity: 1,
            loop: false,
          },
        ],
      },
      {
        id: "overlay-track",
        role: "overlay",
        order: 1,
        muted: false,
        clips: [
          {
            id: "clip-outro",
            source: { kind: "scene", sceneId: "outro" },
            start: 0,
            duration: 3,
            opacity: 0.8,
            loop: false,
          },
        ],
      },
    ];
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const vt = result.project.timeline.visualTracks;
    expect(vt).toHaveLength(2);
    expect(vt[0]!.id).toBe("main-track");
    expect(vt[0]!.role).toBe("primary"); // "main" → "primary"
    expect(vt[1]!.id).toBe("overlay-track");
    expect(vt[1]!.role).toBe("overlay");
  });

  it("preserves clip opacity, loop, trimStart, playbackRate", () => {
    const project = structuredClone(representative);
    project.timeline.visualTracks = [
      {
        id: "main-track",
        role: "main",
        order: 0,
        muted: false,
        clips: [
          {
            id: "clip-intro",
            source: { kind: "scene", sceneId: "intro" },
            start: 0,
            duration: 3,
            opacity: 0.5,
            loop: true,
            trimStart: 0.5,
            playbackRate: 2,
          },
        ],
      },
    ];
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const clip = result.project.timeline.visualTracks[0]!.clips[0]!;
    expect(clip.opacity).toBe(0.5);
    expect(clip.loop).toBe(true);
    expect(clip.trimStart).toBe(0.5);
    expect(clip.playbackRate).toBe(2);
  });

  it("preserves transitionIn and transitionOut on clips", () => {
    const project = structuredClone(representative);
    project.timeline.visualTracks = [
      {
        id: "main-track",
        role: "main",
        order: 0,
        muted: false,
        clips: [
          {
            id: "clip-intro",
            source: { kind: "scene", sceneId: "intro" },
            start: 0,
            duration: 3,
            opacity: 1,
            loop: false,
            transitionIn: { type: "fade" as const, duration: 0.5 },
          },
          {
            id: "clip-outro",
            source: { kind: "scene", sceneId: "outro" },
            start: 3,
            duration: 3,
            opacity: 1,
            loop: false,
            transitionOut: { type: "crossfade" as const, duration: 0.4 },
          },
        ],
      },
    ];
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const clips = result.project.timeline.visualTracks[0]!.clips;
    expect(clips[0]!.transitionIn).toEqual({ type: "fade", duration: 0.5 });
    expect(clips[1]!.transitionOut).toEqual({
      type: "crossfade",
      duration: 0.4,
    });
  });

  it("overlay clip appears over base clip on different track", () => {
    const project = structuredClone(representative);
    project.timeline.visualTracks = [
      {
        id: "base-track",
        role: "main",
        order: 0,
        muted: false,
        clips: [
          {
            id: "clip-intro",
            source: { kind: "scene", sceneId: "intro" },
            start: 0,
            duration: 5,
            opacity: 1,
            loop: false,
          },
        ],
      },
      {
        id: "overlay-track",
        role: "overlay",
        order: 1,
        muted: false,
        clips: [
          {
            id: "clip-overlay",
            source: { kind: "scene", sceneId: "intro" },
            start: 2,
            duration: 3,
            opacity: 0.7,
            loop: false,
          },
        ],
      },
    ];
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const vt = result.project.timeline.visualTracks;
    expect(vt).toHaveLength(2);
    expect(vt[1]!.role).toBe("overlay");
    expect(vt[1]!.clips[0]!.opacity).toBe(0.7);
    expect(vt[1]!.clips[0]!.start).toBe(2);
    expect(vt[1]!.clips[0]!.duration).toBe(3);
  });

  it("preserves a gap between clips on the same track", () => {
    const project = structuredClone(representative);
    project.timeline.visualTracks = [
      {
        id: "main-track",
        role: "main",
        order: 0,
        muted: false,
        clips: [
          {
            id: "clip-intro",
            source: { kind: "scene", sceneId: "intro" },
            start: 0,
            duration: 3,
            opacity: 1,
            loop: false,
          },
          {
            id: "clip-outro",
            source: { kind: "scene", sceneId: "outro" },
            start: 5,
            duration: 3,
            opacity: 1,
            loop: false,
          },
        ],
      },
    ];
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const clips = result.project.timeline.visualTracks[0]!.clips;
    expect(clips.map((c) => c.start)).toEqual([0, 5]);
  });

  it("preserves overlapping starts on an overlay track", () => {
    const project = structuredClone(representative);
    project.timeline.visualTracks = [
      {
        id: "overlay-track",
        role: "overlay",
        order: 0,
        muted: false,
        clips: [
          {
            id: "clip-a",
            source: { kind: "scene", sceneId: "intro" },
            start: 1,
            duration: 2,
            opacity: 1,
            loop: false,
          },
          {
            id: "clip-b",
            source: { kind: "scene", sceneId: "outro" },
            start: 1.5,
            duration: 2,
            opacity: 1,
            loop: false,
          },
        ],
      },
    ];
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const clips = result.project.timeline.visualTracks[0]!.clips;
    expect(clips.map((c) => c.start)).toEqual([1, 1.5]);
  });

  it("repeated scene on different tracks gets independent clip entries", () => {
    const project = structuredClone(representative);
    const introDuration = project.scenes[0]!.duration;
    project.timeline.visualTracks = [
      {
        id: "track-a",
        role: "main",
        order: 0,
        muted: false,
        clips: [
          {
            id: "clip-a",
            source: { kind: "scene", sceneId: "intro" },
            start: 0,
            duration: introDuration,
            opacity: 1,
            loop: false,
          },
        ],
      },
      {
        id: "track-b",
        role: "overlay",
        order: 1,
        muted: false,
        clips: [
          {
            id: "clip-b",
            source: { kind: "scene", sceneId: "intro" },
            start: 0,
            duration: 2,
            opacity: 0.5,
            loop: false,
          },
        ],
      },
    ];
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const vt = result.project.timeline.visualTracks;
    expect(vt).toHaveLength(2);
    expect(vt[0]!.clips[0]!.source.sceneId).toBe("intro");
    // Second clip on track-b should be the cloned version
    expect(vt[1]!.clips[0]!.source.sceneId).toBe("intro@clip-b");
  });

  it("component node scene on overlay track works", () => {
    const project = makeComponentNodeProject();
    project.timeline.visualTracks = [
      {
        id: "overlay-track",
        role: "overlay",
        order: 0,
        muted: false,
        clips: [
          {
            id: "clip-logo",
            source: { kind: "scene", sceneId: "comp-scene" },
            start: 0,
            duration: 4,
            opacity: 0.9,
            loop: false,
          },
        ],
      },
    ];
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const vt = result.project.timeline.visualTracks;
    expect(vt).toHaveLength(1);
    expect(vt[0]!.role).toBe("overlay");
    expect(vt[0]!.clips[0]!.opacity).toBe(0.9);
    const scene = result.project.scenes.find((s) => s.id === "comp-scene")!;
    expect(scene).toBeDefined();
  });

  it("deterministic ordering when track orders tie", () => {
    const project = structuredClone(representative);
    project.timeline.visualTracks = [
      {
        id: "track-a",
        role: "main",
        order: 0,
        muted: false,
        clips: [
          {
            id: "clip-a",
            source: { kind: "scene", sceneId: "intro" },
            start: 0,
            duration: 2,
            opacity: 1,
            loop: false,
          },
        ],
      },
      {
        id: "track-b",
        role: "overlay",
        order: 0, // same order as track-a
        muted: false,
        clips: [
          {
            id: "clip-b",
            source: { kind: "scene", sceneId: "intro" },
            start: 0,
            duration: 3,
            opacity: 0.5,
            loop: false,
          },
        ],
      },
    ];
    const first = compileMotionProjectV3(project);
    const second = compileMotionProjectV3(project);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    // Same input → same output (stable sort)
    expect(first.project.timeline.visualTracks[0]!.id).toBe(
      second.project.timeline.visualTracks[0]!.id,
    );
    expect(first.project.runtimeHash).toBe(second.project.runtimeHash);
  });
});

// ── Phase 4 — clip-level transitions ──────────────────────────────────

describe("compileMotionProjectV3 — Phase 4 clip transitions", () => {
  it("fade in on a clip", () => {
    const project = structuredClone(representative);
    project.timeline.visualTracks = [
      {
        id: "main-track",
        role: "main",
        order: 0,
        muted: false,
        clips: [
          {
            id: "clip-intro",
            source: { kind: "scene", sceneId: "intro" },
            start: 0,
            duration: 3,
            opacity: 1,
            loop: false,
            transitionIn: {
              type: "fade" as const,
              duration: 0.5,
              easing: "easeInOut" as const,
            },
          },
        ],
      },
    ];
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const c = result.project.timeline.visualTracks[0]!.clips[0]!;
    expect(c.transitionIn).toEqual({
      type: "fade",
      duration: 0.5,
      easing: "easeInOut",
    });
    expect(c.transitionOut).toBeUndefined();
  });

  it("fade out on a clip", () => {
    const project = structuredClone(representative);
    project.timeline.visualTracks = [
      {
        id: "main-track",
        role: "main",
        order: 0,
        muted: false,
        clips: [
          {
            id: "clip-intro",
            source: { kind: "scene", sceneId: "intro" },
            start: 0,
            duration: 3,
            opacity: 1,
            loop: false,
            transitionOut: { type: "fade" as const, duration: 0.8 },
          },
        ],
      },
    ];
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const c = result.project.timeline.visualTracks[0]!.clips[0]!;
    expect(c.transitionIn).toBeUndefined();
    expect(c.transitionOut).toEqual({ type: "fade", duration: 0.8 });
  });

  it("crossfade between adjacent clips", () => {
    const project = structuredClone(representative);
    project.timeline.visualTracks = [
      {
        id: "main-track",
        role: "main",
        order: 0,
        muted: false,
        clips: [
          {
            id: "clip-intro",
            source: { kind: "scene", sceneId: "intro" },
            start: 0,
            duration: 3,
            opacity: 1,
            loop: false,
            transitionOut: { type: "crossfade" as const, duration: 0.5 },
          },
          {
            id: "clip-outro",
            source: { kind: "scene", sceneId: "outro" },
            start: 2.5,
            duration: 3,
            opacity: 1,
            loop: false,
            transitionIn: { type: "crossfade" as const, duration: 0.5 },
          },
        ],
      },
    ];
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const clips = result.project.timeline.visualTracks[0]!.clips;
    expect(clips).toHaveLength(2);
    expect(clips[0]!.transitionOut).toEqual({
      type: "crossfade",
      duration: 0.5,
    });
    expect(clips[1]!.transitionIn).toEqual({
      type: "crossfade",
      duration: 0.5,
    });
    // Clip starts preserve the authored timeline start.
    expect(clips[1]!.start).toBe(2.5);
  });

  it("overlay clip with fade in transition", () => {
    const project = structuredClone(representative);
    project.timeline.visualTracks = [
      {
        id: "base-track",
        role: "main",
        order: 0,
        muted: false,
        clips: [
          {
            id: "clip-intro",
            source: { kind: "scene", sceneId: "intro" },
            start: 0,
            duration: 5,
            opacity: 1,
            loop: false,
          },
        ],
      },
      {
        id: "overlay-track",
        role: "overlay",
        order: 1,
        muted: false,
        clips: [
          {
            id: "clip-overlay",
            source: { kind: "scene", sceneId: "intro" },
            start: 2,
            duration: 3,
            opacity: 0.7,
            loop: false,
            transitionIn: { type: "fade" as const, duration: 0.4 },
            transitionOut: { type: "fade" as const, duration: 0.4 },
          },
        ],
      },
    ];
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const overlay = result.project.timeline.visualTracks[1]!.clips[0]!;
    expect(overlay.transitionIn).toEqual({ type: "fade", duration: 0.4 });
    expect(overlay.transitionOut).toEqual({ type: "fade", duration: 0.4 });
    expect(overlay.opacity).toBe(0.7);
  });

  it("clip without any transition", () => {
    const project = structuredClone(representative);
    project.timeline.visualTracks = [
      {
        id: "main-track",
        role: "main",
        order: 0,
        muted: false,
        clips: [
          {
            id: "clip-intro",
            source: { kind: "scene", sceneId: "intro" },
            start: 0,
            duration: 3,
            opacity: 1,
            loop: false,
          },
        ],
      },
    ];
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const c = result.project.timeline.visualTracks[0]!.clips[0]!;
    expect(c.transitionIn).toBeUndefined();
    expect(c.transitionOut).toBeUndefined();
    // No scene.transition on compiled scenes
    const compiledScene = result.project.scenes[0]!;
    expect((compiledScene as Record<string, unknown>).transition).toBeUndefined();
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
    expect(project.compilerVersion).toBe("3.0.0-phase11");
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

  it("points component-node scenes back to their authored scene", () => {
    const project = makeComponentNodeProject();
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const scene = result.project.scenes.find((s) => s.id === "comp-scene")!;
    expect(scene).toBeDefined();
    expect(scene.sourceRef).toEqual({
      projectPath: ["scenes", "comp-scene"],
    });
    expect(result.project.sourceRef?.scenes["comp-scene"]).toBe(
      "scenes:comp-scene",
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

  it("CMP_UNRESOLVED_COMPONENT: component node references a missing component", () => {
    const project = makeComponentNodeProject({ componentId: "ghost" });
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

  it("CMP_BINDING_TYPE_MISMATCH: component node binding with wrong variable type", () => {
    const project = makeComponentNodeProject();
    // logo-visible publicTarget expects boolean, but brand-color is color → mismatch
    project.bindings.push({
      id: "binding-component-wrong-type",
      source: { kind: "variable", variableId: "brand-color" },
      target: {
        kind: "componentNode",
        sceneId: "comp-scene",
        nodeId: "comp-node",
        targetId: "logo-visible",
      },
    });
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.diagnostics.some((d) => d.code === "CMP_BINDING_TYPE_MISMATCH"),
    ).toBe(true);
  });

  it("CMP_PRIVATE_COMPONENT_ACCESS: component node binding targets non-existent publicTarget", () => {
    const project = makeComponentNodeProject();
    project.bindings.push({
      id: "binding-private-access",
      source: { kind: "variable", variableId: "brand-color" },
      target: {
        kind: "componentNode",
        sceneId: "comp-scene",
        nodeId: "comp-node",
        targetId: "internal-node-not-exposed",
      },
    });
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.diagnostics.some((d) => d.code === "CMP_PRIVATE_COMPONENT_ACCESS"),
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

// ── Phase 6: Group Layer Semantics — Compiler Preservation ────────────

describe("Phase 6 — compiler preserves group semantics", () => {
  const nestedFixture = (() => {
    const raw = readFileSync(
      `${fixtureDir}/nested-groups.project.json`,
      "utf8",
    );
    return V3.MotionProjectV3Schema.parse(JSON.parse(raw));
  })();

  const compileResult = compileMotionProjectV3(nestedFixture);

  it("compiles nested-groups fixture successfully", () => {
    expect(compileResult.ok).toBe(true);
  });

  it("preserves three-level parentId chain", () => {
    if (!compileResult.ok) throw new Error("unexpected compile failure");
    const scene = compileResult.project.scenes[0]!;
    const byId = new Map(scene.nodes.map((n) => [n.id, n]));

    // group.character is root
    expect(byId.get("group.character")!.parentId).toBeNull();
    // group.upper-body is child of group.character
    expect(byId.get("group.upper-body")!.parentId).toBe("group.character");
    // group.head-rig is child of group.upper-body
    expect(byId.get("group.head-rig")!.parentId).toBe("group.upper-body");
    // head-image is child of group.head-rig
    expect(byId.get("head-image")!.parentId).toBe("group.head-rig");
  });

  it("preserves zIndex on all nodes", () => {
    if (!compileResult.ok) throw new Error("unexpected compile failure");
    const scene = compileResult.project.scenes[0]!;
    const byId = new Map(scene.nodes.map((n) => [n.id, n]));

    expect(byId.get("group.character")!.zIndex).toBe(3);
    expect(byId.get("group.upper-body")!.zIndex).toBe(2);
    expect(byId.get("group.head-rig")!.zIndex).toBe(3);
    expect(byId.get("head-image")!.zIndex).toBe(0);
  });

  it("preserves parent-relative timing", () => {
    if (!compileResult.ok) throw new Error("unexpected compile failure");
    const scene = compileResult.project.scenes[0]!;
    const byId = new Map(scene.nodes.map((n) => [n.id, n]));

    expect(byId.get("group.character")!.timing).toEqual({
      start: 5,
      duration: 4,
    });
    expect(byId.get("group.upper-body")!.timing).toEqual({
      start: 1,
      duration: 2,
    });
    expect(byId.get("group.head-rig")!.timing).toEqual({
      start: 0.5,
      duration: 1.5,
    });
    expect(byId.get("head-image")!.timing).toEqual({
      start: 0,
      duration: 1,
    });
  });

  it("preserves `type: group` on group nodes", () => {
    if (!compileResult.ok) throw new Error("unexpected compile failure");
    const scene = compileResult.project.scenes[0]!;
    const byId = new Map(scene.nodes.map((n) => [n.id, n]));

    expect(byId.get("group.character")!.type).toBe("group");
    expect(byId.get("group.upper-body")!.type).toBe("group");
    expect(byId.get("group.head-rig")!.type).toBe("group");
    expect(byId.get("head-image")!.type).toBe("image");
  });

  it("preserves compositing payload on group nodes", () => {
    if (!compileResult.ok) throw new Error("unexpected compile failure");
    const scene = compileResult.project.scenes[0]!;
    const byId = new Map(scene.nodes.map((n) => [n.id, n]));

    expect(
      (byId.get("group.character")!.payload as Record<string, unknown>)
        .compositing,
    ).toEqual({
      mode: "pass-through",
    });
    expect(
      (byId.get("group.upper-body")!.payload as Record<string, unknown>)
        .compositing,
    ).toEqual({
      mode: "pass-through",
    });
    expect(
      (byId.get("group.head-rig")!.payload as Record<string, unknown>)
        .compositing,
    ).toEqual({
      mode: "isolate",
    });
  });

  it("preserves transform fields on all nodes", () => {
    if (!compileResult.ok) throw new Error("unexpected compile failure");
    const scene = compileResult.project.scenes[0]!;
    const byId = new Map(scene.nodes.map((n) => [n.id, n]));

    // Spot-check a few transform fields on group.character
    const char = byId.get("group.character")!.transform;
    expect(char.x).toBe(540);
    expect(char.y).toBe(960);
    expect(char.width).toBe(500);
    expect(char.height).toBe(700);
    expect(char.opacity).toBe(1);
    expect(char.visible).toBe(true);

    // Spot-check head-image
    const head = byId.get("head-image")!.transform;
    expect(head.width).toBe(160);
    expect(head.height).toBe(160);
    expect(head.opacity).toBe(1);
    expect(head.visible).toBe(true);
  });

  it("produces empty tracks array for scene without animations", () => {
    if (!compileResult.ok) throw new Error("unexpected compile failure");
    const scene = compileResult.project.scenes[0]!;
    expect(scene.tracks).toEqual([]);
  });
});

// ── Phase 5 V3 regression — compiler text & transitions ──────────────

describe("compileMotionProjectV3 — V3 text node compilation", () => {
  it("compiles a basic text node with current V3 text payload", () => {
    const project = structuredClone(minimal);
    project.scenes = [
      {
        id: "text-scene",
        duration: 3,
        space: "flat-2d",
        nodes: [
          {
            id: "hello-text",
            type: "text",
            parentId: null,
            visible: true,
            locked: false,
            transform: {
              x: 540,
              y: 960,
              width: 400,
              height: 100,
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
            payload: {
              content: { kind: "plain", text: "Hello V3" },
              fontSize: 48,
              color: "#000000",
              alignment: "left",
              wrap: "word",
              overflow: "visible",
            },
          },
        ],
        clips: [],
      },
    ];
    project.timeline.visualTracks = [
      {
        id: "main",
        role: "main",
        order: 0,
        muted: false,
        clips: [
          {
            id: "clip-text",
            source: { kind: "scene", sceneId: "text-scene" },
            start: 0,
            duration: 3,
            opacity: 1,
            loop: false,
          },
        ],
      },
    ];
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const scene = result.project.scenes.find((s) => s.id === "text-scene")!;
    expect(scene).toBeDefined();
    const textNode = scene.nodes.find((n) => n.id === "hello-text")!;
    expect(textNode).toBeDefined();
    expect(textNode.type).toBe("text");
  });

  it("compiles text node without requiring textAnimator", () => {
    const project = structuredClone(minimal);
    project.scenes = [
      {
        id: "text-scene",
        duration: 3,
        space: "flat-2d",
        nodes: [
          {
            id: "plain-text",
            type: "text",
            parentId: null,
            visible: true,
            locked: false,
            transform: {
              x: 100,
              y: 100,
              width: 200,
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
            },
            payload: {
              content: { kind: "plain", text: "No Animator" },
              fontSize: 32,
              color: "#000000",
              alignment: "left",
              wrap: "word",
              overflow: "visible",
            },
          },
        ],
        clips: [],
      },
    ];
    project.timeline.visualTracks = [
      {
        id: "main",
        role: "main",
        order: 0,
        muted: false,
        clips: [
          {
            id: "clip-text",
            source: { kind: "scene", sceneId: "text-scene" },
            start: 0,
            duration: 3,
            opacity: 1,
            loop: false,
          },
        ],
      },
    ];
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
  });

  it("compiles text node without requiring payload.fitText", () => {
    const project = structuredClone(minimal);
    project.scenes = [
      {
        id: "text-scene",
        duration: 3,
        space: "flat-2d",
        nodes: [
          {
            id: "no-fit-text",
            type: "text",
            parentId: null,
            visible: true,
            locked: false,
            transform: {
              x: 100,
              y: 100,
              width: 200,
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
            },
            payload: {
              content: { kind: "plain", text: "No FitText" },
              fontSize: 32,
              color: "#000000",
              alignment: "left",
              wrap: "word",
              overflow: "visible",
            },
          },
        ],
        clips: [],
      },
    ];
    project.timeline.visualTracks = [
      {
        id: "main",
        role: "main",
        order: 0,
        muted: false,
        clips: [
          {
            id: "clip-text",
            source: { kind: "scene", sceneId: "text-scene" },
            start: 0,
            duration: 3,
            opacity: 1,
            loop: false,
          },
        ],
      },
    ];
    const result = compileMotionProjectV3(project);
    expect(result.ok).toBe(true);
  });
});

describe("compileMotionProjectV3 — V3 scene transition absence", () => {
  it("scene-level transition remains absent in compiled runtime scene", () => {
    const result = compileMotionProjectV3(representative);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const scene of result.project.scenes) {
      expect((scene as Record<string, unknown>).transition).toBeUndefined();
    }
  });
});
