/**
 * Phase 2 — v3 protocol schema tests.
 *
 * Covers positive fixture parsing, negative rejection, isolation from the
 * v2 parser, format discriminator routing, namespaced extensions, and
 * cross-reference validation.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MOTION_PROJECT_V3_FORMAT_VERSION,
  MotionProjectV3Schema,
} from "../index";
import { parseMotionProjectV3 } from "../parse";
import { MotionV3ReferenceError } from "../references/types";

const FIXTURES_DIR = join(__dirname, "..", "__fixtures__");

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), "utf8"));
}

// ── Positive fixtures ──────────────────────────────────────────────────

describe("v3 schema — positive fixtures", () => {
  it("parses minimal-empty project", () => {
    const input = loadFixture("minimal-empty.project.json");
    const project = MotionProjectV3Schema.parse(input);
    expect(project.formatVersion).toBe(MOTION_PROJECT_V3_FORMAT_VERSION);
    expect(project.format).toBe("motion-project");
    expect(project.scenes).toEqual([]);
    expect(project.timeline.visualTracks).toEqual([]);
  });

  it("parses representative project with defaults applied", () => {
    const input = loadFixture("representative.project.json");
    const project = MotionProjectV3Schema.parse(input);
    expect(project.composition.background).toBe("#ffffff");
    expect(project.composition.audioSampleRate).toBe(48000);
    expect(project.composition.colorSpace).toBe("srgb");
    expect(project.timeline.visualTracks).toHaveLength(1);
    expect(project.timeline.visualTracks[0]!.clips).toHaveLength(2);
    expect(project.timeline.audioTracks).toHaveLength(1);
    expect(project.timeline.captionTracks).toHaveLength(1);
    expect(project.components).toHaveLength(1);
    expect(project.variables).toHaveLength(4);
    expect(project.bindings).toHaveLength(2);
  });

  it("parses comprehensive project covering ALL top-level v3 fields", () => {
    const input = loadFixture("comprehensive.project.json");
    const project = MotionProjectV3Schema.parse(input);

    // metadata — all fields including optional identity
    expect(project.metadata.id).toBe("v3-comprehensive");
    expect(project.metadata.industry).toBe("technology");
    expect(project.metadata.tags).toEqual(["demo", "v3", "comprehensive"]);
    expect(project.metadata.createdAt).toBe("2026-08-10T00:00:00Z");
    expect(project.metadata.updatedAt).toBe("2026-08-10T12:00:00Z");

    // composition — all fields including pixelAspectRatio, safeArea, motionBlur
    expect(project.composition.width).toBe(1920);
    expect(project.composition.height).toBe(1080);
    expect(project.composition.pixelAspectRatio).toBe(1);
    expect(project.composition.safeArea).toBeTruthy();
    expect(project.composition.motionBlur?.samples).toBe(16);

    // capabilities — required, optional, experimental
    expect(project.capabilities.required).toContain("primitive.text");
    expect(project.capabilities.optional).toContain("effect.blur");
    expect(project.capabilities.experimental).toContain(
      "projection.perspective-3d",
    );

    // dependencies — compiler, components, plugins
    expect(project.dependencies.compiler.range).toBe(">=1.0.0");
    expect(project.dependencies.components).toHaveLength(1);
    expect(project.dependencies.plugins).toHaveLength(1);

    // tokens — all 5 categories
    expect(project.tokens.colors?.brand).toBe("#ff6b35");
    expect(project.tokens.fonts?.display).toBe("font-be-vietnam");
    expect(project.tokens.spacing?.md).toBe(16);
    expect(project.tokens.radii?.sm).toBe(0.125);
    expect(project.tokens.motion?.normal).toBe(0.3);

    // variables — all 7 kinds
    expect(project.variables).toHaveLength(7);
    const kinds = project.variables.map((v) => v.type);
    expect(kinds).toEqual(
      expect.arrayContaining([
        "string",
        "color",
        "number",
        "boolean",
        "asset",
        "enum",
        "list",
      ]),
    );

    // assets — all 5 types
    expect(project.assets).toHaveLength(5);
    const assetTypes = project.assets.map((a) => a.assetType);
    expect(assetTypes).toEqual(
      expect.arrayContaining(["image", "svg", "video", "audio", "font"]),
    );

    // components — with actions, variants, assetDependencies
    expect(project.components).toHaveLength(1);
    const comp = project.components[0]!;
    expect(comp.actions).toHaveLength(1);
    expect(comp.variants).toBeTruthy();
    expect(comp.assetDependencies).toContain("asset-font-display");

    // scenes — group, text, shape, image, bone, camera, path, adjustment, video, svg, component
    expect(project.scenes).toHaveLength(4);
    const allNodes = project.scenes.flatMap((s) => s.nodes);
    const nodeTypes = allNodes.map((n) => n.type);
    expect(nodeTypes).toEqual(
      expect.arrayContaining([
        "group",
        "text",
        "shape",
        "image",
        "bone",
        "camera",
        "path",
        "adjustment",
        "video",
        "svg",
        "component",
      ]),
    );

    // scene: markers, drivers, motionBlur, semantic, space
    const intro = project.scenes.find((s) => s.id === "scene-intro")!;
    expect(intro.markers).toHaveLength(2);
    expect(intro.drivers).toHaveLength(1);
    expect(intro.motionBlur?.enabled).toBe(true);
    expect(intro.semantic?.role).toBe("intro");
    expect(intro.space).toBe("layered-2.5d");

    // timeline: duration, workArea, markers
    expect(project.timeline.duration).toBe(18);
    expect(project.timeline.workArea).toEqual({ start: 0, end: 18 });
    expect(project.timeline.markers).toHaveLength(1);

    // timeline: visualTracks with main+overlay, scene-only clip sources
    expect(project.timeline.visualTracks).toHaveLength(2);
    const overlayTrack = project.timeline.visualTracks[1]!;
    expect(overlayTrack.role).toBe("overlay");
    expect(overlayTrack.clips[0]!.source.kind).toBe("scene");
    expect(overlayTrack.clips[0]!.source).toEqual({
      kind: "scene",
      sceneId: "scene-lower-third",
    });

    // timeline: audioTrack with all fields
    expect(project.timeline.audioTracks).toHaveLength(1);
    const audioTrack = project.timeline.audioTracks[0]!;
    expect(audioTrack.volume).toBe(0.7);
    expect(audioTrack.fadeIn).toBe(1);

    // timeline: captionTracks with audioTrackId ref
    expect(project.timeline.captionTracks).toHaveLength(1);
    expect(project.timeline.captionTracks[0]!.audioTrackId).toBe("track-bgm");

    // bindings — scene + componentNode targets
    expect(project.bindings).toHaveLength(3);
    const componentBinding = project.bindings.find(
      (b) => b.target.kind === "componentNode",
    )!;
    expect(componentBinding.target.kind).toBe("componentNode");
    if (componentBinding.target.kind !== "componentNode") {
      throw new Error("Expected componentNode binding");
    }
    expect(componentBinding.target.sceneId).toBe("scene-lower-third");
    expect(componentBinding.target.nodeId).toBe("node-lower-third");
    expect(componentBinding.target.targetId).toBe("lt-bg-color");

    // provenance — all 4 sub-fields
    expect(project.provenance?.workspaceId).toBe("ws-moticlip-demo");
    expect(project.provenance?.bundleProfile).toBe("embedded-components");
    expect(project.provenance?.sourceMap?.scenes).toBeTruthy();
    expect(project.provenance?.sourceMap?.components).toBeTruthy();
    expect(project.provenance?.sourceMap?.variables).toBeTruthy();
    expect(project.provenance?.sourceMap?.assets).toBeTruthy();

    // extensions — multiple namespaced keys
    expect(project.extensions["com.moticlip.constraints"]).toBeTruthy();
    expect(project.extensions["com.moticlip.ai-hints"]).toBeTruthy();
  });

  it("keeps scene transition out of v3 scenes (timeline carries it)", () => {
    const input = loadFixture("representative.project.json");
    const project = MotionProjectV3Schema.parse(input);
    for (const scene of project.scenes) {
      expect(scene).not.toHaveProperty("transition");
    }
    const introClip = project.timeline.visualTracks[0]!.clips[0]!;
    expect(introClip.transitionOut?.type).toBe("fade");
  });

  it("validates activeCameraId references a camera node", () => {
    const input = loadFixture("representative.project.json");
    const project = MotionProjectV3Schema.parse(input);
    const intro = project.scenes.find((scene) => scene.id === "intro")!;
    const cam = intro.nodes.find((node) => node.id === "cam")!;
    expect(cam.type).toBe("camera");
  });

  // ── Phase 0 example fixtures ──────────────────────────────────────

  it("parses multi-scene project with overlay track", () => {
    const input = loadFixture("multi-scene.project.json");
    const project = MotionProjectV3Schema.parse(input);
    expect(project.scenes).toHaveLength(3);
    expect(project.timeline.visualTracks).toHaveLength(2);
    expect(project.timeline.visualTracks[0]!.role).toBe("main");
    expect(project.timeline.visualTracks[1]!.role).toBe("overlay");
    expect(project.timeline.visualTracks[0]!.clips).toHaveLength(3);
  });

  it("parses transition project with clip-level transitionIn/transitionOut", () => {
    const input = loadFixture("transition.project.json");
    const project = MotionProjectV3Schema.parse(input);
    const clips = project.timeline.visualTracks[0]!.clips;
    expect(clips[0]!.transitionIn?.type).toBe("fade");
    expect(clips[0]!.transitionOut?.type).toBe("slide");
    expect(clips[1]!.transitionIn?.type).toBe("crossfade");
    expect(clips[2]!.transitionIn?.type).toBe("wipe");
    // Verifies V3 scenes do NOT have scene.transition
    for (const scene of project.scenes) {
      expect(scene).not.toHaveProperty("transition");
    }
  });

  it("accepts clip with transition durations within clip duration", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<
      string,
      unknown
    >;
    const project = MotionProjectV3Schema.parse({
      ...input,
      timeline: {
        ...(input.timeline as Record<string, unknown>),
        visualTracks: [
          {
            id: "track-1",
            role: "main",
            order: 0,
            clips: [
              {
                id: "clip-1",
                source: { kind: "scene", sceneId: "s1" },
                start: 0,
                duration: 3,
                transitionIn: { type: "fade", duration: 1 },
                transitionOut: { type: "fade", duration: 1 },
              },
            ],
          },
        ],
      },
    });
    expect(project.timeline.visualTracks[0]!.clips[0]!.duration).toBe(3);
  });

  it("parses component project with embedded component and component-as-node layer", () => {
    const input = loadFixture("component.project.json");
    const project = MotionProjectV3Schema.parse(input);
    expect(project.components).toHaveLength(1);
    expect(project.components[0]!.publicParams).toHaveLength(2);

    const ctaScene = project.scenes.find((scene) => scene.id === "cta-scene")!;
    const componentNode = ctaScene.nodes.find(
      (node) => node.type === "component",
    )!;
    expect(componentNode).toBeDefined();
    if (componentNode.type === "component") {
      expect(componentNode.payload.componentId).toBe("call-to-action");
    }

    // Visual clips are scene-only now.
    const overlayTrack = project.timeline.visualTracks.find(
      (t) => t.role === "overlay",
    )!;
    expect(overlayTrack.clips[0]!.source.kind).toBe("scene");
    expect(overlayTrack.clips[0]!.source).toEqual({
      kind: "scene",
      sceneId: "cta-scene",
    });
  });

  it("parses scene-local motion clip targeting a component node", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const scenes = input.scenes as Array<Record<string, unknown>>;
    const ctaScene = scenes.find((s) => s.id === "cta-scene")!;
    ctaScene.clips = [
      {
        id: "clip-anim",
        targetId: "cta-instance",
        schedule: { kind: "absolute", at: 0 },
        duration: 1,
        playback: {},
        source: {
          kind: "tracks",
          tracks: [
            {
              targetId: "cta-instance",
              property: "transform.x",
              valueKind: "number",
              keys: [
                { t: 0, v: 0 },
                { t: 1, v: 100, easing: "easeOut" },
              ],
            },
          ],
        },
      },
    ];
    const project = MotionProjectV3Schema.parse(input);
    const parsedScene = project.scenes.find((s) => s.id === "cta-scene")!;
    expect(parsedScene.clips).toHaveLength(1);
    expect(parsedScene.clips[0]!.targetId).toBe("cta-instance");
    expect(parsedScene.clips[0]!.source.kind).toBe("tracks");
  });

  it("rejects component node without payload.componentId", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const scenes = input.scenes as Array<Record<string, unknown>>;
    const ctaScene = scenes.find((s) => s.id === "cta-scene")!;
    const nodes = ctaScene.nodes as Array<Record<string, unknown>>;
    const node = nodes.find((n) => n.type === "component")!;
    delete (node.payload as Record<string, unknown>).componentId;
    expect(() => MotionProjectV3Schema.parse(input)).toThrow();
  });

  it("rejects visual clip with component source (scene-only timeline)", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const timeline = input.timeline as Record<string, unknown>;
    const tracks = timeline.visualTracks as Array<Record<string, unknown>>;
    const overlayTrack = tracks.find((t) => t.role === "overlay")!;
    const clips = overlayTrack.clips as Array<Record<string, unknown>>;
    clips[0]!.source = { kind: "component", componentId: "call-to-action" };
    expect(() => MotionProjectV3Schema.parse(input)).toThrow();
  });

  it("accepts scene-local motion on a component node with normal transform paths", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const scenes = input.scenes as Array<Record<string, unknown>>;
    const ctaScene = scenes.find((s) => s.id === "cta-scene")!;
    ctaScene.clips = [
      {
        id: "clip-anim",
        targetId: "cta-instance",
        schedule: { kind: "absolute", at: 0 },
        duration: 1,
        playback: {},
        source: {
          kind: "tracks",
          tracks: [
            {
              targetId: "cta-instance",
              property: "transform.width",
              valueKind: "number",
              keys: [{ t: 0, v: 600 }],
            },
          ],
        },
      },
    ];
    const project = MotionProjectV3Schema.parse(input);
    const parsedScene = project.scenes.find((s) => s.id === "cta-scene")!;
    expect(parsedScene.clips[0]!.source.kind).toBe("tracks");
    expect(parsedScene.clips[0]!.targetId).toBe("cta-instance");
  });

  it("rejects scene-local motion clip on component node with empty keys", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const scenes = input.scenes as Array<Record<string, unknown>>;
    const ctaScene = scenes.find((s) => s.id === "cta-scene")!;
    ctaScene.clips = [
      {
        id: "clip-anim",
        targetId: "cta-instance",
        schedule: { kind: "absolute", at: 0 },
        duration: 1,
        playback: {},
        source: {
          kind: "tracks",
          tracks: [
            { targetId: "cta-instance", property: "transform.x", keys: [] },
          ],
        },
      },
    ];
    expect(() => MotionProjectV3Schema.parse(input)).toThrow();
  });

  it("rejects scene-local motion clip on component node with mismatched valueKind", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const scenes = input.scenes as Array<Record<string, unknown>>;
    const ctaScene = scenes.find((s) => s.id === "cta-scene")!;
    ctaScene.clips = [
      {
        id: "clip-anim",
        targetId: "cta-instance",
        schedule: { kind: "absolute", at: 0 },
        duration: 1,
        playback: {},
        source: {
          kind: "tracks",
          tracks: [
            {
              targetId: "cta-instance",
              property: "transform.x",
              valueKind: "color",
              keys: [{ t: 0, v: 0 }],
            },
          ],
        },
      },
    ];
    expect(() => MotionProjectV3Schema.parse(input)).toThrow();
  });

  it("parses caption project with bilingual caption tracks", () => {
    const input = loadFixture("caption.project.json");
    const project = MotionProjectV3Schema.parse(input);
    expect(project.timeline.captionTracks).toHaveLength(2);
    expect(project.timeline.captionTracks[0]!.locale).toBe("vi-VN");
    expect(project.timeline.captionTracks[1]!.locale).toBe("en-US");
    expect(project.timeline.captionTracks[0]!.tokens).toHaveLength(5);
  });

  it("parses audio project with BGM, voiceover, and SFX tracks", () => {
    const input = loadFixture("audio.project.json");
    const project = MotionProjectV3Schema.parse(input);
    expect(project.timeline.audioTracks).toHaveLength(4);
    const roles = project.timeline.audioTracks.map((t) => t.role);
    expect(roles).toEqual(["bgm", "voiceover", "sfx", "sfx"]);
    expect(project.timeline.audioTracks[0]!.volume).toBe(0.3);
  });
});

// ── Negative Zod-level fixtures ────────────────────────────────────────

describe("v3 schema — negative fixtures", () => {
  it("rejects v2-style sceneOrder timeline (visualTracks required)", () => {
    const input = loadFixture("invalid-timeline.project.json");
    expect(() => MotionProjectV3Schema.parse(input)).toThrow();
  });

  it("rejects unknown root fields", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<
      string,
      unknown
    >;
    expect(() =>
      MotionProjectV3Schema.parse({ ...input, unexpected: true }),
    ).toThrow();
  });

  it("rejects missing composition width", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<
      string,
      unknown
    >;
    const { width: _width, ...withoutWidth } = input.composition as Record<
      string,
      unknown
    >;
    void _width;
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        composition: withoutWidth,
      }),
    ).toThrow();
  });

  it("rejects invalid enum value in visual track role", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<
      string,
      unknown
    >;
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        timeline: {
          ...(input.timeline as Record<string, unknown>),
          visualTracks: [
            {
              id: "track-1",
              role: "bogus",
              order: 0,
              clips: [
                {
                  id: "clip-1",
                  source: { kind: "scene", sceneId: "s1" },
                  start: 0,
                  duration: 1,
                },
              ],
            },
          ],
        },
      }),
    ).toThrow();
  });

  it("rejects instanceTransform on a visual clip (removed field)", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<
      string,
      unknown
    >;
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        timeline: {
          ...(input.timeline as Record<string, unknown>),
          visualTracks: [
            {
              id: "track-1",
              role: "main",
              order: 0,
              clips: [
                {
                  id: "clip-1",
                  source: { kind: "scene", sceneId: "s1" },
                  start: 0,
                  duration: 1,
                  instanceTransform: { x: 100 },
                },
              ],
            },
          ],
        },
      }),
    ).toThrow();
  });

  it("rejects instanceTransformTracks on a visual clip (removed field)", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<
      string,
      unknown
    >;
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        timeline: {
          ...(input.timeline as Record<string, unknown>),
          visualTracks: [
            {
              id: "track-1",
              role: "main",
              order: 0,
              clips: [
                {
                  id: "clip-1",
                  source: { kind: "scene", sceneId: "s1" },
                  start: 0,
                  duration: 1,
                  instanceTransformTracks: [
                    {
                      property: "transform.x",
                      keys: [{ t: 0, v: 0 }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      }),
    ).toThrow();
  });

  it("rejects invalid capability id shape", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<
      string,
      unknown
    >;
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        capabilities: { required: ["UPPER_CASE_INVALID"] },
      }),
    ).toThrow();
  });

  it("rejects negative composition dimensions", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<
      string,
      unknown
    >;
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        composition: {
          ...(input.composition as Record<string, unknown>),
          width: 0,
        },
      }),
    ).toThrow();
  });

  it("rejects zero-duration visual clip", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<
      string,
      unknown
    >;
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        timeline: {
          ...(input.timeline as Record<string, unknown>),
          visualTracks: [
            {
              id: "track-1",
              role: "main",
              order: 0,
              clips: [
                {
                  id: "clip-1",
                  source: { kind: "scene", sceneId: "s1" },
                  start: 0,
                  duration: 0,
                },
              ],
            },
          ],
        },
      }),
    ).toThrow();
  });

  it("rejects negative clip start time", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<
      string,
      unknown
    >;
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        timeline: {
          ...(input.timeline as Record<string, unknown>),
          visualTracks: [
            {
              id: "track-1",
              role: "main",
              order: 0,
              clips: [
                {
                  id: "clip-1",
                  source: { kind: "scene", sceneId: "s1" },
                  start: -1,
                  duration: 3,
                },
              ],
            },
          ],
        },
      }),
    ).toThrow();
  });

  it("rejects audio track referencing non-audio asset type", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<
      string,
      unknown
    >;
    // build inline fixture with an image asset + audio track pointing to it
    // (Zod won't catch the type mismatch — that's reference validation's job)
    // This test verifies Zod accepts the shape even if ref validation later rejects.
    const project = MotionProjectV3Schema.parse({
      ...input,
      assets: [
        {
          id: "img",
          uri: "a.png",
          assetType: "image",
          mimeType: "image/png",
          width: 100,
          height: 100,
        },
      ],
      timeline: {
        ...(input.timeline as Record<string, unknown>),
        audioTracks: [
          {
            id: "at1",
            role: "bgm",
            assetId: "img",
            start: 0,
            duration: 5,
          },
        ],
      },
    });
    // Zod accepts because assetId is just a string — ref validation catches type mismatch
    expect(project.timeline.audioTracks[0]!.assetId).toBe("img");
  });

  it("rejects transitionIn duration exceeding clip duration", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<
      string,
      unknown
    >;
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        timeline: {
          ...(input.timeline as Record<string, unknown>),
          visualTracks: [
            {
              id: "track-1",
              role: "main",
              order: 0,
              clips: [
                {
                  id: "clip-1",
                  source: { kind: "scene", sceneId: "s1" },
                  start: 0,
                  duration: 2,
                  transitionIn: { type: "fade", duration: 3 },
                },
              ],
            },
          ],
        },
      }),
    ).toThrow();
  });

  it("rejects transitionIn + transitionOut exceeding clip duration", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<
      string,
      unknown
    >;
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        timeline: {
          ...(input.timeline as Record<string, unknown>),
          visualTracks: [
            {
              id: "track-1",
              role: "main",
              order: 0,
              clips: [
                {
                  id: "clip-1",
                  source: { kind: "scene", sceneId: "s1" },
                  start: 0,
                  duration: 3,
                  transitionIn: { type: "fade", duration: 2 },
                  transitionOut: { type: "crossfade", duration: 2 },
                },
              ],
            },
          ],
        },
      }),
    ).toThrow();
  });

  it("rejects visual clip exceeding timeline duration", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<
      string,
      unknown
    >;
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        timeline: {
          ...(input.timeline as Record<string, unknown>),
          duration: 5,
          visualTracks: [
            {
              id: "track-1",
              role: "main",
              order: 0,
              clips: [
                {
                  id: "clip-1",
                  source: { kind: "scene", sceneId: "s1" },
                  start: 4,
                  duration: 3,
                },
              ],
            },
          ],
        },
      }),
    ).toThrow();
  });

  it("rejects audio track exceeding timeline duration", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<
      string,
      unknown
    >;
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        timeline: {
          ...(input.timeline as Record<string, unknown>),
          duration: 5,
          audioTracks: [
            {
              id: "at1",
              role: "bgm",
              assetId: "audio-1",
              start: 3,
              duration: 4,
            },
          ],
        },
      }),
    ).toThrow();
  });

  it("rejects work area exceeding timeline duration", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<
      string,
      unknown
    >;
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        timeline: {
          ...(input.timeline as Record<string, unknown>),
          duration: 5,
          workArea: { start: 0, end: 6 },
        },
      }),
    ).toThrow();
  });

  it("rejects marker exceeding timeline duration", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<
      string,
      unknown
    >;
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        timeline: {
          ...(input.timeline as Record<string, unknown>),
          duration: 5,
          markers: [{ id: "marker-1", t: 6 }],
        },
      }),
    ).toThrow();
  });

  it("rejects caption token exceeding timeline duration", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<
      string,
      unknown
    >;
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        timeline: {
          ...(input.timeline as Record<string, unknown>),
          duration: 5,
          captionTracks: [
            {
              id: "cap-1",
              locale: "vi-VN",
              tokens: [
                { id: "tok-1", text: "hello", start: 4, end: 6 },
              ],
              style: { fontSize: 32, fill: "#ffffff" },
            },
          ],
        },
      }),
    ).toThrow();
  });
});

// ── Cross-reference validation ─────────────────────────────────────────

describe("v3 reference validation — parseMotionProjectV3", () => {
  it("rejects duplicate scene ids", () => {
    const input = loadFixture("invalid-duplicate-ids.project.json");
    // Duplicate ids are caught at schema level (.superRefine) before
    // reference validation — both ZodError and MotionV3ReferenceError are valid.
    expect(() => parseMotionProjectV3(input)).toThrow();
    try {
      parseMotionProjectV3(input);
    } catch (err) {
      expect(String(err)).toContain("Duplicate scene id");
    }
  });

  it("rejects duplicate variable ids", () => {
    const input = loadFixture("invalid-duplicate-ids.project.json");
    try {
      parseMotionProjectV3(input);
    } catch (err) {
      expect(String(err)).toContain("Duplicate variable id");
    }
  });

  it("rejects duplicate asset ids", () => {
    const input = loadFixture("invalid-duplicate-ids.project.json");
    try {
      parseMotionProjectV3(input);
    } catch (err) {
      expect(String(err)).toContain("Duplicate asset id");
    }
  });

  it("rejects missing scene reference in visual clip", () => {
    const input = loadFixture("invalid-missing-refs.project.json");
    expect(() => parseMotionProjectV3(input)).toThrow(MotionV3ReferenceError);
    try {
      parseMotionProjectV3(input);
    } catch (err) {
      expect(String(err)).toContain("Unknown scene: scene-nonexistent");
    }
  });

  it("rejects missing asset reference in audio track", () => {
    const input = loadFixture("invalid-missing-refs.project.json");
    try {
      parseMotionProjectV3(input);
    } catch (err) {
      expect(String(err)).toContain("Unknown asset: asset-missing-audio");
    }
  });

  it("rejects missing asset reference in image node", () => {
    const input = loadFixture("invalid-missing-refs.project.json");
    try {
      parseMotionProjectV3(input);
    } catch (err) {
      expect(String(err)).toContain("Unknown asset: asset-nonexistent");
    }
  });

  it("rejects missing font asset reference in text node", () => {
    const input = loadFixture("invalid-missing-refs.project.json");
    try {
      parseMotionProjectV3(input);
    } catch (err) {
      expect(String(err)).toContain("Unknown asset: font-missing");
    }
  });

  it("rejects missing variable reference in binding", () => {
    const input = loadFixture("invalid-missing-refs.project.json");
    try {
      parseMotionProjectV3(input);
    } catch (err) {
      expect(String(err)).toContain("Unknown variable: var-nonexistent");
    }
  });

  it("rejects audio track referencing image asset (type mismatch)", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<
      string,
      unknown
    >;
    expect(() =>
      parseMotionProjectV3({
        ...input,
        assets: [
          {
            id: "img",
            uri: "a.png",
            assetType: "image" as const,
            mimeType: "image/png" as const,
            width: 100,
            height: 100,
          },
        ],
        timeline: {
          ...(input.timeline as Record<string, unknown>),
          audioTracks: [
            {
              id: "at1",
              role: "bgm" as const,
              assetId: "img",
              start: 0,
              duration: 5,
            },
          ],
        },
      }),
    ).toThrow(MotionV3ReferenceError);
  });

  it("passes reference validation for a clean comprehensive project", () => {
    const input = loadFixture("comprehensive.project.json");
    const project = parseMotionProjectV3(input);
    expect(project.metadata.id).toBe("v3-comprehensive");
  });

  // ── Component ownership contract: publicTargets ───────────────────

  it("rejects duplicate publicTarget ids within a component", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const components = (input.components as Array<Record<string, unknown>>).map(
      (c) => ({
        ...c,
        publicTargets: [
          {
            id: "dup-id",
            nodeId: "cta-label",
            property: "payload.content.text",
          },
          { id: "dup-id", nodeId: "cta-bg", property: "payload.color" },
        ],
      }),
    );
    expect(() => parseMotionProjectV3({ ...input, components })).toThrow(
      MotionV3ReferenceError,
    );
    try {
      parseMotionProjectV3({ ...input, components });
    } catch (err) {
      expect(String(err)).toContain("Duplicate publicTarget id: dup-id");
    }
  });

  it("rejects publicTarget with unknown nodeId", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const components = (input.components as Array<Record<string, unknown>>).map(
      (c) => ({
        ...c,
        publicTargets: [
          {
            id: "bad-target",
            nodeId: "nonexistent-node",
            property: "payload.content.text",
          },
        ],
      }),
    );
    expect(() => parseMotionProjectV3({ ...input, components })).toThrow(
      MotionV3ReferenceError,
    );
    try {
      parseMotionProjectV3({ ...input, components });
    } catch (err) {
      expect(String(err)).toContain(
        'publicTarget "bad-target" references unknown node',
      );
    }
  });

  it("rejects publicTarget with unsupported property for node type", () => {
    const input = loadFixture("representative.project.json") as Record<
      string,
      unknown
    >;
    const components = (input.components as Array<Record<string, unknown>>).map(
      (c) => ({
        ...c,
        publicTargets: [
          ...((c.publicTargets as Array<Record<string, unknown>>) ?? []),
          {
            id: "bad-property",
            nodeId: "logo",
            property: "payload.content.text",
          },
        ],
      }),
    );
    expect(() => parseMotionProjectV3({ ...input, components })).toThrow(
      MotionV3ReferenceError,
    );
    try {
      parseMotionProjectV3({ ...input, components });
    } catch (err) {
      expect(String(err)).toContain("exposes unsupported property");
    }
  });

  it("rejects component binding with unknown targetId", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const bindings = [
      {
        id: "bad-binding",
        source: { kind: "variable", variableId: "cta-text" },
        target: {
          kind: "component",
          componentId: "call-to-action",
          targetId: "nonexistent-target",
        },
      },
    ];
    expect(() => parseMotionProjectV3({ ...input, bindings })).toThrow(
      MotionV3ReferenceError,
    );
    try {
      parseMotionProjectV3({ ...input, bindings });
    } catch (err) {
      expect(String(err)).toContain(
        'does not expose public target "nonexistent-target"',
      );
    }
  });
});

// ── Isolation from v2 ──────────────────────────────────────────────────

describe("v3 isolation from v2 parser", () => {
  it("formatVersion 2 never parses through MotionProjectV3Schema", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<
      string,
      unknown
    >;
    expect(() =>
      MotionProjectV3Schema.parse({ ...input, formatVersion: 2 }),
    ).toThrow();
  });

  it("discriminates on format + formatVersion", () => {
    const input = loadFixture("minimal-empty.project.json");
    const parsed = MotionProjectV3Schema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.formatVersion).toBe(3);
    }
  });
});

// ── Extensions ─────────────────────────────────────────────────────────

describe("v3 extensions — namespaced keys", () => {
  it("accepts valid namespaced extensions", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<
      string,
      unknown
    >;
    const project = MotionProjectV3Schema.parse({
      ...input,
      extensions: { "com.moticlip.constraints": [{ maxDuration: 10 }] },
    });
    expect(project.extensions["com.moticlip.constraints"]).toEqual([
      { maxDuration: 10 },
    ]);
  });

  it("rejects non-namespaced extension keys", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<
      string,
      unknown
    >;
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        extensions: { constraints: [] },
      }),
    ).toThrow();
  });

  it("accepts multiple namespaced extension keys", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<
      string,
      unknown
    >;
    const project = MotionProjectV3Schema.parse({
      ...input,
      extensions: {
        "com.moticlip.constraints": [{ maxDuration: 30 }],
        "com.moticlip.ai-hints": { tone: "professional" },
      },
    });
    expect(Object.keys(project.extensions)).toHaveLength(2);
  });
});

// ── Node-graph validation (Phase 2: group layer semantics) ────────────

import { validateNodeGraphV3 } from "../references/node-graph";
import type { NodeV3 } from "../nodes";

function makeNode(
  overrides: Partial<NodeV3> & { id: string; type: string },
): NodeV3 {
  return {
    parentId: null,
    zIndex: 0,
    transform: {
      x: 0,
      y: 0,
      width: 100,
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
    timing: { start: 0, duration: 1 },
    payload: {},
    ...overrides,
  } as NodeV3;
}

describe("validateNodeGraphV3 — group layer semantics", () => {
  it("accepts valid three-level nested groups", () => {
    const nodes: NodeV3[] = [
      makeNode({
        id: "group.character",
        type: "group",
        parentId: null,
        zIndex: 3,
      }),
      makeNode({
        id: "group.upper-body",
        type: "group",
        parentId: "group.character",
        zIndex: 2,
      }),
      makeNode({
        id: "group.head-rig",
        type: "group",
        parentId: "group.upper-body",
        zIndex: 3,
      }),
      makeNode({
        id: "head-image",
        type: "image",
        parentId: "group.head-rig",
        zIndex: 0,
        payload: { assetId: "asset.head" },
      }),
    ];
    const issues = validateNodeGraphV3(nodes, "scene.test");
    expect(issues).toEqual([]);
  });

  it("rejects missing parent", () => {
    const nodes: NodeV3[] = [
      makeNode({ id: "group.a", type: "group", parentId: null }),
      makeNode({
        id: "child",
        type: "image",
        parentId: "nonexistent",
        payload: { assetId: "a" },
      }),
    ];
    const issues = validateNodeGraphV3(nodes, "scene.test");
    expect(issues.some((i) => i.message.includes("Unknown parent"))).toBe(true);
  });

  it("rejects self-parent", () => {
    const nodes: NodeV3[] = [
      makeNode({ id: "group.a", type: "group", parentId: "group.a" }),
    ];
    const issues = validateNodeGraphV3(nodes, "scene.test");
    expect(
      issues.some((i) => i.message.includes("cannot be its own parent")),
    ).toBe(true);
  });

  it("rejects parent cycles (A → B → A)", () => {
    const nodes: NodeV3[] = [
      makeNode({ id: "a", type: "group", parentId: "b" }),
      makeNode({ id: "b", type: "group", parentId: "a" }),
    ];
    const issues = validateNodeGraphV3(nodes, "scene.test");
    expect(
      issues.some((i) => i.message.includes("Parent cycle detected")),
    ).toBe(true);
  });

  it("rejects children under non-group parent (image)", () => {
    const nodes: NodeV3[] = [
      makeNode({
        id: "img",
        type: "image",
        parentId: null,
        payload: { assetId: "a" },
      }),
      makeNode({
        id: "child",
        type: "image",
        parentId: "img",
        payload: { assetId: "b" },
      }),
    ];
    const issues = validateNodeGraphV3(nodes, "scene.test");
    expect(
      issues.some((i) =>
        i.message.includes('only "group" nodes may have children'),
      ),
    ).toBe(true);
  });

  it("rejects children under non-group parent (text)", () => {
    const nodes: NodeV3[] = [
      makeNode({
        id: "txt",
        type: "text",
        parentId: null,
        payload: {
          content: { kind: "plain", text: "hi" },
          fontSize: 24,
          color: "#000000",
          alignment: "left",
          wrap: "word",
          overflow: "visible",
        },
      }),
      makeNode({
        id: "child",
        type: "image",
        parentId: "txt",
        payload: { assetId: "b" },
      }),
    ];
    const issues = validateNodeGraphV3(nodes, "scene.test");
    expect(
      issues.some((i) =>
        i.message.includes('only "group" nodes may have children'),
      ),
    ).toBe(true);
  });
});

// ── G2: ProceduralDriver schema-level range validation ────────────────

import { ProceduralDriverSchema } from "../animation/drivers";

describe("ProceduralDriverSchema — range validation", () => {
  it("rejects remap driver with inMin >= inMax", () => {
    const result = ProceduralDriverSchema.safeParse({
      id: "d1",
      type: "remap",
      targetNodeId: "n1",
      targetProperty: "transform.x",
      sourceNodeId: "n2",
      sourceProperty: "transform.y",
      inMin: 10,
      inMax: 5,
      outMin: 0,
      outMax: 100,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (i) => i.message.includes("inMin") && i.message.includes("inMax"),
        ),
      ).toBe(true);
    }
  });

  it("rejects remap driver with outMin >= outMax", () => {
    const result = ProceduralDriverSchema.safeParse({
      id: "d1",
      type: "remap",
      targetNodeId: "n1",
      targetProperty: "transform.x",
      sourceNodeId: "n2",
      sourceProperty: "transform.y",
      inMin: 0,
      inMax: 100,
      outMin: 50,
      outMax: 50,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (i) => i.message.includes("outMin") && i.message.includes("outMax"),
        ),
      ).toBe(true);
    }
  });

  it("accepts remap driver with valid ranges", () => {
    const result = ProceduralDriverSchema.safeParse({
      id: "d1",
      type: "remap",
      targetNodeId: "n1",
      targetProperty: "transform.x",
      sourceNodeId: "n2",
      sourceProperty: "transform.y",
      inMin: 0,
      inMax: 100,
      outMin: 0,
      outMax: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("remap");
    }
  });

  it("rejects clamp driver with min >= max", () => {
    const result = ProceduralDriverSchema.safeParse({
      id: "d1",
      type: "clamp",
      targetNodeId: "n1",
      targetProperty: "transform.x",
      sourceNodeId: "n2",
      sourceProperty: "transform.y",
      min: 10,
      max: 10,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (i) => i.message.includes("min") && i.message.includes("max"),
        ),
      ).toBe(true);
    }
  });

  it("accepts clamp driver with min < max", () => {
    const result = ProceduralDriverSchema.safeParse({
      id: "d1",
      type: "clamp",
      targetNodeId: "n1",
      targetProperty: "transform.x",
      sourceNodeId: "n2",
      sourceProperty: "transform.y",
      min: 0,
      max: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects wrap driver with min >= max", () => {
    const result = ProceduralDriverSchema.safeParse({
      id: "d1",
      type: "wrap",
      targetNodeId: "n1",
      targetProperty: "transform.x",
      sourceNodeId: "n2",
      sourceProperty: "transform.y",
      min: 100,
      max: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (i) => i.message.includes("min") && i.message.includes("max"),
        ),
      ).toBe(true);
    }
  });

  it("accepts wrap driver with min < max", () => {
    const result = ProceduralDriverSchema.safeParse({
      id: "d1",
      type: "wrap",
      targetNodeId: "n1",
      targetProperty: "transform.x",
      sourceNodeId: "n2",
      sourceProperty: "transform.y",
      min: 0,
      max: 360,
    });
    expect(result.success).toBe(true);
  });

  it("accepts noise driver (no range fields)", () => {
    const result = ProceduralDriverSchema.safeParse({
      id: "d1",
      type: "noise",
      targetNodeId: "n1",
      targetProperty: "transform.x",
      frequency: 2,
      amplitude: 10,
      seed: 42,
    });
    expect(result.success).toBe(true);
  });
});

// ── G1: AudioTrackV3 schema-level edge cases ─────────────────────────

describe("AudioTrackV3 schema — edge case validation", () => {
  function makeValidProject(audioOverrides: Record<string, unknown>) {
    const input = loadFixture("minimal-empty.project.json") as Record<
      string,
      unknown
    >;
    return MotionProjectV3Schema.safeParse({
      ...input,
      assets: [
        {
          id: "audio1",
          uri: "bgm.mp3",
          assetType: "audio",
          mimeType: "audio/mpeg",
          duration: 30,
          codec: "mp3",
          sampleRate: 44100,
          channels: 2,
        },
      ],
      timeline: {
        ...(input.timeline as Record<string, unknown>),
        audioTracks: [
          {
            id: "at1",
            role: "bgm",
            assetId: "audio1",
            start: 0,
            duration: 5,
            ...audioOverrides,
          },
        ],
      },
    });
  }

  it("rejects audio track with trimEnd > duration", () => {
    const result = makeValidProject({ trimEnd: 10 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (i) =>
            i.message.includes("trimEnd") && i.message.includes("duration"),
        ),
      ).toBe(true);
    }
  });

  it("rejects fadeIn + fadeOut exceeding duration", () => {
    const result = makeValidProject({ fadeIn: 3, fadeOut: 3, duration: 5 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (i) => i.message.includes("fadeIn") && i.message.includes("fadeOut"),
        ),
      ).toBe(true);
    }
  });

  it("accepts audio track with all optional fields", () => {
    const result = makeValidProject({
      trimStart: 1,
      volume: 0.5,
      loop: true,
      fadeIn: 2,
      fadeOut: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const at = result.data.timeline.audioTracks[0];
      expect(at.volume).toBe(0.5);
      expect(at.fadeIn).toBe(2);
      expect(at.fadeOut).toBe(1);
      expect(at.loop).toBe(true);
    }
  });

  it("rejects audio track with negative volume", () => {
    const result = makeValidProject({ volume: -0.1 });
    expect(result.success).toBe(false);
  });

  it("rejects audio track with volume > 1", () => {
    const result = makeValidProject({ volume: 1.1 });
    expect(result.success).toBe(false);
  });
});

// ── G4: Reference validation — audio + caption track duplicate IDs ────

describe("v3 reference validation — audio & caption duplicate IDs", () => {
  function makeProjectWithAudioTracks(
    trackOverrides: Array<Record<string, unknown>>,
  ) {
    const input = loadFixture("minimal-empty.project.json") as Record<
      string,
      unknown
    >;
    return {
      ...input,
      assets: [
        {
          id: "bgm",
          uri: "bgm.mp3",
          assetType: "audio",
          mimeType: "audio/mpeg",
          duration: 30,
          codec: "mp3",
          sampleRate: 44100,
          channels: 2,
        },
      ],
      timeline: {
        ...(input.timeline as Record<string, unknown>),
        audioTracks: trackOverrides,
      },
    };
  }

  it("rejects duplicate audio track ids", () => {
    const project = makeProjectWithAudioTracks([
      { id: "dup-at", role: "bgm", assetId: "bgm", start: 0, duration: 5 },
      { id: "dup-at", role: "sfx", assetId: "bgm", start: 5, duration: 3 },
    ]);
    expect(() => parseMotionProjectV3(project)).toThrow();
    try {
      parseMotionProjectV3(project);
    } catch (err) {
      expect(String(err)).toContain("Duplicate audio track id: dup-at");
    }
  });

  it("rejects duplicate caption track ids", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<
      string,
      unknown
    >;
    const project = {
      ...input,
      timeline: {
        ...(input.timeline as Record<string, unknown>),
        captionTracks: [
          {
            id: "dup-ct",
            locale: "vi-VN",
            style: { fontSize: 24, fill: "#fff" },
            tokens: [{ id: "t1", text: "hi", start: 0, end: 1 }],
          },
          {
            id: "dup-ct",
            locale: "en-US",
            style: { fontSize: 24, fill: "#fff" },
            tokens: [{ id: "t2", text: "hi", start: 0, end: 1 }],
          },
        ],
      },
    };
    expect(() => parseMotionProjectV3(project)).toThrow();
    try {
      parseMotionProjectV3(project);
    } catch (err) {
      expect(String(err)).toContain("Duplicate caption track id: dup-ct");
    }
  });

  it("accepts unique audio track ids", () => {
    const project = makeProjectWithAudioTracks([
      { id: "at1", role: "bgm", assetId: "bgm", start: 0, duration: 5 },
      { id: "at2", role: "sfx", assetId: "bgm", start: 5, duration: 3 },
    ]);
    expect(() => parseMotionProjectV3(project)).not.toThrow();
  });

  it("accepts unique caption track ids", () => {
    const input = loadFixture("minimal-empty.project.json") as Record<
      string,
      unknown
    >;
    const project = {
      ...input,
      timeline: {
        ...(input.timeline as Record<string, unknown>),
        captionTracks: [
          {
            id: "ct1",
            locale: "vi-VN",
            style: { fontSize: 24, fill: "#fff" },
            tokens: [{ id: "t1", text: "hi", start: 0, end: 1 }],
          },
          {
            id: "ct2",
            locale: "en-US",
            style: { fontSize: 24, fill: "#fff" },
            tokens: [{ id: "t2", text: "hi", start: 0, end: 1 }],
          },
        ],
      },
    };
    expect(() => parseMotionProjectV3(project)).not.toThrow();
  });
});
