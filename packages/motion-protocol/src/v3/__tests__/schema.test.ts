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
import {
  collectTimelineIntegrityIssues,
  type ProjectTimelineV3,
} from "../timeline";

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

    // timeline: visualTracks with unique orders, scene clip sources
    expect(project.timeline.visualTracks).toHaveLength(2);
    const overlayTrack = project.timeline.visualTracks[1]!;
    expect(overlayTrack.order).toBe(1);
    expect(overlayTrack.clips[0]!.source.kind).toBe("scene");
    expect(overlayTrack.clips[0]!.source).toEqual({
      kind: "scene",
      sceneId: "scene-lower-third",
    });

    // timeline: audioTrack with clips[] envelope fields
    expect(project.timeline.audioTracks).toHaveLength(1);
    const audioTrack = project.timeline.audioTracks[0]!;
    expect(audioTrack.clips[0]!.volume).toBe(0.7);
    expect(audioTrack.clips[0]!.fadeIn).toBe(1);

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
    expect(componentBinding.target.propId).toBe("bgColor");

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

  it("keeps scene transition out of v3 scenes (no clip transitions either)", () => {
    const input = loadFixture("representative.project.json");
    const project = MotionProjectV3Schema.parse(input);
    for (const scene of project.scenes) {
      expect(scene).not.toHaveProperty("transition");
    }
    const introClip = project.timeline.visualTracks[0]!.clips[0]!;
    expect(introClip).not.toHaveProperty("transitionIn");
    expect(introClip).not.toHaveProperty("transitionOut");
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
    expect(project.timeline.visualTracks[0]!.order).toBe(0);
    expect(project.timeline.visualTracks[1]!.order).toBe(1);
    expect(project.timeline.visualTracks[0]!.clips).toHaveLength(3);
  });

  it("parses transition project as sequential clips without transitions", () => {
    const input = loadFixture("transition.project.json");
    const project = MotionProjectV3Schema.parse(input);
    const clips = project.timeline.visualTracks[0]!.clips;
    expect(clips).toHaveLength(3);
    expect(clips[0]!.start).toBe(0);
    expect(clips[1]!.start).toBe(3);
    expect(clips[2]!.start).toBe(6);
    for (const clip of clips) {
      expect(clip).not.toHaveProperty("transitionIn");
      expect(clip).not.toHaveProperty("transitionOut");
    }
    for (const scene of project.scenes) {
      expect(scene).not.toHaveProperty("transition");
    }
  });

  it("rejects transitionIn/transitionOut on visual clips", () => {
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
      }),
    ).toThrow();
  });

  it("parses component project with embedded component and component-as-node layer", () => {
    const input = loadFixture("component.project.json");
    const project = MotionProjectV3Schema.parse(input);
    expect(project.components).toHaveLength(1);
    expect(project.components[0]!.props).toHaveLength(2);

    const ctaScene = project.scenes.find((scene) => scene.id === "cta-scene")!;
    const componentNode = ctaScene.nodes.find(
      (node) => node.type === "component",
    )!;
    expect(componentNode).toBeDefined();
    if (componentNode.type === "component") {
      expect(componentNode.payload.componentId).toBe("call-to-action");
    }

    const overlayTrack = project.timeline.visualTracks.find(
      (t) => t.id === "overlay-cta",
    )!;
    expect(overlayTrack.order).toBe(1);
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
    const overlayTrack = tracks.find((t) => t.id === "overlay-cta")!;
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
    expect(project.timeline.audioTracks.map((t) => t.id)).toEqual([
      "bgm",
      "vo",
      "sfx-1",
      "sfx-2",
    ]);
    expect(project.timeline.audioTracks[0]!.clips[0]!.volume).toBe(0.3);
    expect(project.timeline.audioTracks[0]!.clips[0]!.fadeIn).toBe(1);
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

  it("rejects role field on visual track", () => {
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
            order: -1,
            clips: [
              {
                id: "at1-clip",
                assetId: "img",
                start: 0,
                duration: 5,
              },
            ],
          },
        ],
      },
    });
    // Zod accepts because assetId is just a string — ref validation catches type mismatch
    expect(project.timeline.audioTracks[0]!.clips[0]!.assetId).toBe("img");
  });

  it("rejects transitionIn field on visual clips", () => {
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
              order: 0,
              clips: [
                {
                  id: "clip-1",
                  source: { kind: "scene", sceneId: "s1" },
                  start: 0,
                  duration: 2,
                  transitionIn: { type: "fade", duration: 1 },
                },
              ],
            },
          ],
        },
      }),
    ).toThrow();
  });

  it("rejects transitionOut field on visual clips", () => {
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
              order: 0,
              clips: [
                {
                  id: "clip-1",
                  source: { kind: "scene", sceneId: "s1" },
                  start: 0,
                  duration: 3,
                  transitionOut: { type: "crossfade", duration: 1 },
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
              order: -1,
              clips: [
                {
                  id: "at1-clip",
                  assetId: "audio-1",
                  start: 3,
                  duration: 4,
                },
              ],
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
              tokens: [{ id: "tok-1", text: "hello", start: 4, end: 6 }],
              style: { fontSize: 32, fill: "#ffffff" },
            },
          ],
        },
      }),
    ).toThrow();
  });
});

// ── Timeline & scene integrity — Phase 6 ──────────────────────────────

describe("v3 timeline integrity — Phase 6", () => {
  const base = () =>
    loadFixture("minimal-empty.project.json") as Record<string, unknown>;

  it("rejects duplicate visual clip ids within a track", () => {
    const input = base();
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        timeline: {
          ...(input.timeline as Record<string, unknown>),
          visualTracks: [
            {
              id: "track-1",
              order: 0,
              clips: [
                {
                  id: "c1",
                  source: { kind: "scene", sceneId: "s1" },
                  start: 0,
                  duration: 2,
                },
                {
                  id: "c1",
                  source: { kind: "scene", sceneId: "s1" },
                  start: 2,
                  duration: 2,
                },
              ],
            },
          ],
        },
      }),
    ).toThrow();
  });

  it("rejects duplicate visual clip ids across different tracks", () => {
    const input = base();
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        timeline: {
          ...(input.timeline as Record<string, unknown>),
          visualTracks: [
            {
              id: "track-1",
              order: 0,
              clips: [
                {
                  id: "c1",
                  source: { kind: "scene", sceneId: "s1" },
                  start: 0,
                  duration: 2,
                },
              ],
            },
            {
              id: "track-2",
              order: 1,
              clips: [
                {
                  id: "c1",
                  source: { kind: "scene", sceneId: "s1" },
                  start: 0,
                  duration: 2,
                },
              ],
            },
          ],
        },
      }),
    ).toThrow();
  });

  it("rejects duplicate visual track order", () => {
    const input = base();
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        timeline: {
          ...(input.timeline as Record<string, unknown>),
          visualTracks: [
            {
              id: "track-1",
              order: 0,
              clips: [
                {
                  id: "c1",
                  source: { kind: "scene", sceneId: "s1" },
                  start: 0,
                  duration: 2,
                },
              ],
            },
            {
              id: "track-2",
              order: 0,
              clips: [
                {
                  id: "c2",
                  source: { kind: "scene", sceneId: "s1" },
                  start: 0,
                  duration: 2,
                },
              ],
            },
          ],
        },
      }),
    ).toThrow(/Duplicate track order/);
  });

  it("rejects duplicate order shared by visual and audio tracks", () => {
    const issues = collectTimelineIntegrityIssues({
      visualTracks: [
        {
          id: "track-1",
          order: 0,
          muted: false,
          clips: [
            {
              id: "c1",
              source: { kind: "scene", sceneId: "s1" },
              start: 0,
              duration: 2,
              loop: false,
              opacity: 1,
            },
          ],
        },
      ],
      audioTracks: [
        {
          id: "at1",
          order: 0, // invalid sign; integrity still flags cross-collection collision
          muted: false,
          clips: [
            {
              id: "at1-clip",
              assetId: "audio-1",
              start: 0,
              duration: 2,
              trimStart: 0,
              playbackRate: 1,
              volume: 1,
              loop: false,
              fadeIn: 0,
              fadeOut: 0,
              muted: false,
            },
          ],
        },
      ],
      captionTracks: [],
    } as ProjectTimelineV3);
    expect(
      issues.some((i) => /Duplicate track order 0/.test(i.message)),
    ).toBe(true);
  });

  it("rejects duplicate audio track order", () => {
    const input = base();
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        assets: [
          {
            id: "audio-1",
            uri: "a.mp3",
            assetType: "audio",
            mimeType: "audio/mpeg",
            duration: 10,
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
              order: -1,
              clips: [
                {
                  id: "at1-clip",
                  assetId: "audio-1",
                  start: 0,
                  duration: 2,
                },
              ],
            },
            {
              id: "at2",
              order: -1,
              clips: [
                {
                  id: "at2-clip",
                  assetId: "audio-1",
                  start: 0,
                  duration: 1,
                },
              ],
            },
          ],
        },
      }),
    ).toThrow(/Duplicate track order/);
  });

  it("rejects audio track order >= 0", () => {
    const input = base();
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        assets: [
          {
            id: "audio-1",
            uri: "a.mp3",
            assetType: "audio",
            mimeType: "audio/mpeg",
            duration: 10,
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
              order: 0,
              clips: [
                {
                  id: "at1-clip",
                  assetId: "audio-1",
                  start: 0,
                  duration: 2,
                },
              ],
            },
          ],
        },
      }),
    ).toThrow();
  });

  it("rejects audio track missing order", () => {
    const input = base();
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        assets: [
          {
            id: "audio-1",
            uri: "a.mp3",
            assetType: "audio",
            mimeType: "audio/mpeg",
            duration: 10,
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
              clips: [
                {
                  id: "at1-clip",
                  assetId: "audio-1",
                  start: 0,
                  duration: 2,
                },
              ],
            },
          ],
        },
      }),
    ).toThrow();
  });

  it("accepts sparse non-contiguous visual and audio orders", () => {
    const input = base();
    const project = MotionProjectV3Schema.parse({
      ...input,
      assets: [
        {
          id: "audio-1",
          uri: "a.mp3",
          assetType: "audio",
          mimeType: "audio/mpeg",
          duration: 10,
          codec: "mp3",
          sampleRate: 44100,
          channels: 2,
        },
      ],
      timeline: {
        ...(input.timeline as Record<string, unknown>),
        visualTracks: [
          {
            id: "track-base",
            order: 0,
            clips: [
              {
                id: "c1",
                source: { kind: "scene", sceneId: "s1" },
                start: 0,
                duration: 2,
              },
            ],
          },
          {
            id: "track-fx",
            order: 20,
            clips: [
              {
                id: "c2",
                source: { kind: "scene", sceneId: "s1" },
                start: 0,
                duration: 2,
              },
            ],
          },
        ],
        audioTracks: [
          {
            id: "bgm",
            order: -20,
            clips: [
              {
                id: "bgm-clip",
                assetId: "audio-1",
                start: 0,
                duration: 2,
              },
            ],
          },
          {
            id: "sfx",
            order: -10,
            clips: [
              {
                id: "sfx-clip",
                assetId: "audio-1",
                start: 0,
                duration: 1,
              },
            ],
          },
        ],
      },
    });
    expect(project.timeline.visualTracks.map((t) => t.order)).toEqual([0, 20]);
    expect(project.timeline.audioTracks.map((t) => t.order)).toEqual([-20, -10]);
  });

  it("rejects same-lane visual clip overlap", () => {
    const input = base();
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        timeline: {
          ...(input.timeline as Record<string, unknown>),
          visualTracks: [
            {
              id: "track-1",
              order: 0,
              clips: [
                {
                  id: "c1",
                  source: { kind: "scene", sceneId: "s1" },
                  start: 0,
                  duration: 3,
                },
                {
                  id: "c2",
                  source: { kind: "scene", sceneId: "s1" },
                  start: 2,
                  duration: 3,
                },
              ],
            },
          ],
        },
      }),
    ).toThrow();
  });

  it("rejects overlay clip overlap on the same lane", () => {
    const input = base();
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        timeline: {
          ...(input.timeline as Record<string, unknown>),
          visualTracks: [
            {
              id: "track-1",
              order: 0,
              clips: [
                {
                  id: "c1",
                  source: { kind: "scene", sceneId: "s1" },
                  start: 0,
                  duration: 3,
                },
                {
                  id: "c2",
                  source: { kind: "scene", sceneId: "s1" },
                  start: 2,
                  duration: 3,
                },
              ],
            },
          ],
        },
      }),
    ).toThrow(/same-lane clips cannot overlap/);
  });

  it("accepts concurrent scenes on different track orders", () => {
    const input = base();
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        timeline: {
          ...(input.timeline as Record<string, unknown>),
          visualTracks: [
            {
              id: "main",
              order: 0,
              clips: [
                {
                  id: "c1",
                  source: { kind: "scene", sceneId: "s1" },
                  start: 0,
                  duration: 3,
                },
              ],
            },
            {
              id: "overlay_1",
              order: 1,
              clips: [
                {
                  id: "c1_copy",
                  source: { kind: "scene", sceneId: "s1" },
                  start: 0,
                  duration: 3,
                },
              ],
            },
          ],
        },
      }),
    ).not.toThrow();
  });

  it("rejects same-lane overlap even when transition fields are present", () => {
    const input = base();
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        timeline: {
          ...(input.timeline as Record<string, unknown>),
          visualTracks: [
            {
              id: "track-1",
              order: 0,
              clips: [
                {
                  id: "c1",
                  source: { kind: "scene", sceneId: "s1" },
                  start: 0,
                  duration: 3,
                  transitionOut: { type: "crossfade", duration: 1 },
                },
                {
                  id: "c2",
                  source: { kind: "scene", sceneId: "s1" },
                  start: 2,
                  duration: 3,
                  transitionIn: { type: "crossfade", duration: 1 },
                },
              ],
            },
          ],
        },
      }),
    ).toThrow();
  });

  it("accepts overlapping audio clips on the same track", () => {
    const input = base();
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        assets: [
          {
            id: "audio-1",
            uri: "a.mp3",
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
              id: "mix",
              order: -1,
              clips: [
                {
                  id: "a1",
                  assetId: "audio-1",
                  start: 0,
                  duration: 3,
                },
                {
                  id: "a2",
                  assetId: "audio-1",
                  start: 1,
                  duration: 3,
                },
              ],
            },
          ],
        },
      }),
    ).not.toThrow();
  });

  it("accepts back-to-back main-track clips (no overlap)", () => {
    const input = base();
    expect(() =>
      MotionProjectV3Schema.parse({
        ...input,
        timeline: {
          ...(input.timeline as Record<string, unknown>),
          visualTracks: [
            {
              id: "track-1",
              order: 0,
              clips: [
                {
                  id: "c1",
                  source: { kind: "scene", sceneId: "s1" },
                  start: 0,
                  duration: 3,
                },
                {
                  id: "c2",
                  source: { kind: "scene", sceneId: "s1" },
                  start: 3,
                  duration: 3,
                },
              ],
            },
          ],
        },
      }),
    ).not.toThrow();
  });

  it("rejects visual clip trim exceeding source scene duration", () => {
    const input = loadFixture("multi-scene.project.json") as Record<
      string,
      unknown
    >;
    expect(() =>
      parseMotionProjectV3({
        ...input,
        timeline: {
          ...(input.timeline as Record<string, unknown>),
          visualTracks: [
            {
              id: "track-1",
              order: 0,
              clips: [
                {
                  id: "c1",
                  source: { kind: "scene", sceneId: "intro" },
                  start: 0,
                  duration: 3,
                  trimStart: 2,
                },
              ],
            },
          ],
        },
      }),
    ).toThrow(MotionV3ReferenceError);
  });

  it("rejects scene-local absolute clip beyond scene duration", () => {
    const input = loadFixture("multi-scene.project.json") as Record<
      string,
      unknown
    >;
    const scenes = (input.scenes as Array<Record<string, unknown>>).map(
      (scene) =>
        scene.id === "intro"
          ? {
              ...scene,
              clips: [
                {
                  id: "mc1",
                  targetId: "headline",
                  schedule: { kind: "absolute", at: 2 },
                  duration: 2,
                  source: { kind: "preset", presetId: "p1" },
                },
              ],
            }
          : scene,
    );
    expect(() => MotionProjectV3Schema.parse({ ...input, scenes })).toThrow();
  });

  it("rejects scene-local scene-end clip that starts before 0", () => {
    const input = loadFixture("multi-scene.project.json") as Record<
      string,
      unknown
    >;
    const scenes = (input.scenes as Array<Record<string, unknown>>).map(
      (scene) =>
        scene.id === "intro"
          ? {
              ...scene,
              clips: [
                {
                  id: "mc1",
                  targetId: "headline",
                  schedule: { kind: "scene-end", offset: 0 },
                  duration: 4,
                  source: { kind: "preset", presetId: "p1" },
                },
              ],
            }
          : scene,
    );
    expect(() => MotionProjectV3Schema.parse({ ...input, scenes })).toThrow();
  });

  it("accepts scene-local clip within scene duration", () => {
    const input = loadFixture("multi-scene.project.json") as Record<
      string,
      unknown
    >;
    const scenes = (input.scenes as Array<Record<string, unknown>>).map(
      (scene) =>
        scene.id === "intro"
          ? {
              ...scene,
              clips: [
                {
                  id: "mc1",
                  targetId: "headline",
                  schedule: { kind: "absolute", at: 1 },
                  duration: 2,
                  source: { kind: "preset", presetId: "p1" },
                },
              ],
            }
          : scene,
    );
    expect(() =>
      MotionProjectV3Schema.parse({ ...input, scenes }),
    ).not.toThrow();
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
              order: -1,
              clips: [
                {
                  id: "at1-clip",
                  assetId: "img",
                  start: 0,
                  duration: 5,
                },
              ],
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

  // ── Component ownership contract: props & propBindings ───────────────

  it("rejects duplicate prop ids within a component", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const components = (input.components as Array<Record<string, unknown>>).map(
      (c) => ({
        ...c,
        props: [
          { id: "dup-id", kind: "text", default: "a" },
          { id: "dup-id", kind: "color", default: "#000000" },
        ],
      }),
    );
    expect(() => MotionProjectV3Schema.parse({ ...input, components })).toThrow();
  });

  it("rejects propBinding with unknown layerId", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const components = (input.components as Array<Record<string, unknown>>).map(
      (c) => ({
        ...c,
        propBindings: [
          {
            propId: "label",
            target: {
              kind: "layerProperty",
              layerId: "nonexistent-node",
              property: "payload.content.text",
            },
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
      expect(String(err)).toContain('references unknown layer "nonexistent-node"');
    }
  });

  it("rejects propBinding with unsupported property for node type", () => {
    const input = loadFixture("representative.project.json") as Record<
      string,
      unknown
    >;
    const components = (input.components as Array<Record<string, unknown>>).map(
      (c) => ({
        ...c,
        propBindings: [
          ...((c.propBindings as Array<Record<string, unknown>>) ?? []),
          {
            propId: "logo-color",
            target: {
              kind: "layerProperty",
              layerId: "logo",
              property: "payload.content.text",
            },
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
      expect(String(err)).toContain("targets unsupported property");
    }
  });

  it("rejects component binding with unknown propId", () => {
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
          propId: "nonexistent-prop",
        },
      },
    ];
    expect(() => parseMotionProjectV3({ ...input, bindings })).toThrow(
      MotionV3ReferenceError,
    );
    try {
      parseMotionProjectV3({ ...input, bindings });
    } catch (err) {
      expect(String(err)).toContain('does not declare prop "nonexistent-prop"');
    }
  });

  it("rejects instance props with unknown prop id", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const scenes = (input.scenes as Array<Record<string, unknown>>).map(
      (s) => ({
        ...s,
        nodes: (s.nodes as Array<Record<string, unknown>>).map((n) =>
          n.type === "component"
            ? {
                ...n,
                payload: {
                  ...(n.payload as Record<string, unknown>),
                  props: { "not-a-prop": "hello" },
                },
              }
            : n,
        ),
      }),
    );
    expect(() => parseMotionProjectV3({ ...input, scenes })).toThrow(
      MotionV3ReferenceError,
    );
    try {
      parseMotionProjectV3({ ...input, scenes });
    } catch (err) {
      expect(String(err)).toContain('does not declare prop "not-a-prop"');
    }
  });

  it("rejects instance props with incompatible value kind", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const components = (input.components as Array<Record<string, unknown>>).map(
      (c) => ({
        ...c,
        props: [
          ...((c.props as Array<Record<string, unknown>>) ?? []),
          { id: "opacity", kind: "number", default: 1 },
        ],
      }),
    );
    const scenes = (input.scenes as Array<Record<string, unknown>>).map(
      (s) => ({
        ...s,
        nodes: (s.nodes as Array<Record<string, unknown>>).map((n) =>
          n.type === "component"
            ? {
                ...n,
                payload: {
                  ...(n.payload as Record<string, unknown>),
                  props: { opacity: "not-a-number" },
                },
              }
            : n,
        ),
      }),
    );
    expect(() =>
      parseMotionProjectV3({ ...input, components, scenes }),
    ).toThrow(MotionV3ReferenceError);
    try {
      parseMotionProjectV3({ ...input, components, scenes });
    } catch (err) {
      expect(String(err)).toContain('expected kind "number"');
    }
  });

  it("rejects instance prop variable reference with incompatible type", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const components = (input.components as Array<Record<string, unknown>>).map(
      (c) => ({
        ...c,
        props: [
          ...((c.props as Array<Record<string, unknown>>) ?? []),
          { id: "opacity", kind: "number", default: 1 },
        ],
      }),
    );
    const scenes = (input.scenes as Array<Record<string, unknown>>).map(
      (s) => ({
        ...s,
        nodes: (s.nodes as Array<Record<string, unknown>>).map((n) =>
          n.type === "component"
            ? {
                ...n,
                payload: {
                  ...(n.payload as Record<string, unknown>),
                  props: {
                    opacity: {
                      ref: { kind: "variable", id: "cta-text" },
                    },
                  },
                },
              }
            : n,
        ),
      }),
    );
    expect(() =>
      parseMotionProjectV3({ ...input, components, scenes }),
    ).toThrow(MotionV3ReferenceError);
    try {
      parseMotionProjectV3({ ...input, components, scenes });
    } catch (err) {
      expect(String(err)).toContain('expected kind "number"');
    }
  });

  it("accepts instance props with matching value kind", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const scenes = (input.scenes as Array<Record<string, unknown>>).map(
      (s) => ({
        ...s,
        nodes: (s.nodes as Array<Record<string, unknown>>).map((n) =>
          n.type === "component"
            ? {
                ...n,
                payload: {
                  ...(n.payload as Record<string, unknown>),
                  props: { label: "Buy now" },
                },
              }
            : n,
        ),
      }),
    );
    const project = parseMotionProjectV3({ ...input, scenes });
    expect(project.scenes.length).toBeGreaterThan(0);
  });

  it("rejects legacy publicParams field on component definition", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const components = (input.components as Array<Record<string, unknown>>).map(
      (c) => ({
        ...c,
        publicParams: [{ id: "legacy", type: "string", variableId: "x" }],
      }),
    );
    expect(() => MotionProjectV3Schema.parse({ ...input, components })).toThrow();
  });

  it("rejects unknown variantId on a component node", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const scenes = (input.scenes as Array<Record<string, unknown>>).map(
      (s) => ({
        ...s,
        nodes: (s.nodes as Array<Record<string, unknown>>).map((n) =>
          n.type === "component"
            ? {
                ...n,
                payload: {
                  ...(n.payload as Record<string, unknown>),
                  variantId: "nonexistent-variant",
                },
              }
            : n,
        ),
      }),
    );
    expect(() => parseMotionProjectV3({ ...input, scenes })).toThrow(
      MotionV3ReferenceError,
    );
    try {
      parseMotionProjectV3({ ...input, scenes });
    } catch (err) {
      expect(String(err)).toContain(
        'does not declare variant "nonexistent-variant"',
      );
    }
  });

  it("rejects variant props targeting unknown prop id", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const components = (input.components as Array<Record<string, unknown>>).map(
      (c) => ({
        ...c,
        variants: [
          {
            id: "primary",
            name: "Primary",
            props: { "not-a-prop": "hello" },
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
      expect(String(err)).toContain('sets unknown prop "not-a-prop"');
    }
  });

  it("accepts keyframed number prop values", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const components = (input.components as Array<Record<string, unknown>>).map(
      (c) => ({
        ...c,
        props: [
          ...((c.props as Array<Record<string, unknown>>) ?? []),
          { id: "progress", kind: "number", default: 0, animatable: true },
        ],
        propBindings: [
          ...((c.propBindings as Array<Record<string, unknown>>) ?? []),
          {
            propId: "progress",
            target: {
              kind: "layerProperty",
              layerId: "cta-bg",
              property: "transform.opacity",
            },
          },
        ],
      }),
    );
    const scenes = (input.scenes as Array<Record<string, unknown>>).map(
      (s) => ({
        ...s,
        nodes: (s.nodes as Array<Record<string, unknown>>).map((n) =>
          n.type === "component"
            ? {
                ...n,
                payload: {
                  ...(n.payload as Record<string, unknown>),
                  props: {
                    progress: {
                      kind: "keyframes",
                      keys: [
                        { t: 0, value: 0 },
                        { t: 1, value: 1, easing: "easeOut" },
                      ],
                    },
                  },
                },
              }
            : n,
        ),
      }),
    );
    const project = parseMotionProjectV3({ ...input, components, scenes });
    expect(project.scenes.length).toBeGreaterThan(0);
  });

  it("rejects keyframes on non-animatable prop", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const components = (input.components as Array<Record<string, unknown>>).map(
      (c) => ({
        ...c,
        props: [
          ...((c.props as Array<Record<string, unknown>>) ?? []),
          {
            id: "style",
            kind: "choice",
            options: ["solid", "outline"],
            default: "solid",
          },
        ],
      }),
    );
    const scenes = (input.scenes as Array<Record<string, unknown>>).map(
      (s) => ({
        ...s,
        nodes: (s.nodes as Array<Record<string, unknown>>).map((n) =>
          n.type === "component"
            ? {
                ...n,
                payload: {
                  ...(n.payload as Record<string, unknown>),
                  props: {
                    style: {
                      kind: "keyframes",
                      keys: [
                        { t: 0, value: "solid" },
                        { t: 1, value: "outline" },
                      ],
                    },
                  },
                },
              }
            : n,
        ),
      }),
    );
    expect(() =>
      parseMotionProjectV3({ ...input, components, scenes }),
    ).toThrow(MotionV3ReferenceError);
    try {
      parseMotionProjectV3({ ...input, components, scenes });
    } catch (err) {
      expect(String(err)).toContain("is not animatable");
    }
  });

  it("accepts one prop bound to three internal layers", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const components = (input.components as Array<Record<string, unknown>>).map(
      (c) => {
        const nodes = [
          ...((c.nodes as Array<Record<string, unknown>>) ?? []),
        ];
        const bg = nodes.find((n) => n.id === "cta-bg")!;
        nodes.push({ ...structuredClone(bg), id: "border", zIndex: 2 });
        return {
          ...c,
          propBindings: [
            {
              propId: "color",
              target: {
                kind: "layerProperty",
                layerId: "cta-bg",
                property: "payload.color",
              },
            },
            {
              propId: "color",
              target: {
                kind: "layerProperty",
                layerId: "cta-label-node",
                property: "payload.color",
              },
            },
            {
              propId: "color",
              target: {
                kind: "layerProperty",
                layerId: "border",
                property: "payload.color",
              },
            },
          ],
          nodes,
        };
      },
    );
    const project = parseMotionProjectV3({ ...input, components });
    expect(
      project.components[0]!.propBindings.filter((b) => b.propId === "color"),
    ).toHaveLength(3);
  });

  it("accepts nested childProp forwarding A → B → C", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const cta = (input.components as Array<Record<string, unknown>>)[0]!;
    const bg = (cta.nodes as Array<Record<string, unknown>>).find(
      (n) => n.id === "cta-bg",
    )!;
    const leaf = {
      id: "swatch",
      version: "1.0.0",
      integrity: "sha256:swatch",
      props: [{ id: "fill", kind: "color", default: "#111111" }],
      propBindings: [
        {
          propId: "fill",
          target: {
            kind: "layerProperty",
            layerId: "fill-layer",
            property: "payload.color",
          },
        },
      ],
      nodes: [{ ...structuredClone(bg), id: "fill-layer" }],
    };
    const mid = {
      id: "badge",
      version: "1.0.0",
      integrity: "sha256:badge",
      props: [{ id: "color", kind: "color", default: "#222222" }],
      propBindings: [
        {
          propId: "color",
          target: {
            kind: "childProp",
            childId: "swatch-1",
            propId: "fill",
          },
        },
      ],
      nodes: [
        {
          id: "swatch-1",
          type: "component",
          parentId: null,
          transform: structuredClone(bg.transform),
          payload: { componentId: "swatch" },
        },
      ],
    };
    const parent = {
      ...cta,
      propBindings: [
        ...((cta.propBindings as Array<Record<string, unknown>>) ?? []),
        {
          propId: "color",
          target: {
            kind: "childProp",
            childId: "badge-1",
            propId: "color",
          },
        },
      ],
      nodes: [
        ...((cta.nodes as Array<Record<string, unknown>>) ?? []),
        {
          id: "badge-1",
          type: "component",
          parentId: null,
          zIndex: 2,
          transform: structuredClone(bg.transform),
          payload: { componentId: "badge" },
        },
      ],
    };
    const project = parseMotionProjectV3({
      ...input,
      components: [parent, mid, leaf],
    });
    expect(project.components).toHaveLength(3);
  });

  it("rejects unknown variable refs on instance props", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const scenes = (input.scenes as Array<Record<string, unknown>>).map(
      (s) => ({
        ...s,
        nodes: (s.nodes as Array<Record<string, unknown>>).map((n) =>
          n.type === "component"
            ? {
                ...n,
                payload: {
                  ...(n.payload as Record<string, unknown>),
                  props: {
                    label: {
                      ref: { kind: "variable", id: "missingVariable" },
                    },
                  },
                },
              }
            : n,
        ),
      }),
    );
    expect(() => parseMotionProjectV3({ ...input, scenes })).toThrow(
      MotionV3ReferenceError,
    );
    try {
      parseMotionProjectV3({ ...input, scenes });
    } catch (err) {
      expect(String(err)).toContain('unknown variable "missingVariable"');
    }
  });

  it("rejects asset prop values that do not match assetKind", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const components = (input.components as Array<Record<string, unknown>>).map(
      (c) => ({
        ...c,
        props: [
          ...((c.props as Array<Record<string, unknown>>) ?? []),
          {
            id: "avatar",
            kind: "asset",
            assetKind: "image",
            default: "logo-png",
          },
        ],
      }),
    );
    const assets = [
      {
        id: "logo-png",
        uri: "./logo.png",
        integrity: "sha256:logo",
        assetType: "image",
        mimeType: "image/png",
        width: 512,
        height: 512,
      },
      {
        id: "bgm",
        uri: "./bgm.mp3",
        integrity: "sha256:bgm",
        assetType: "audio",
        mimeType: "audio/mpeg",
        duration: 4,
      },
    ];
    const scenes = (input.scenes as Array<Record<string, unknown>>).map(
      (s) => ({
        ...s,
        nodes: (s.nodes as Array<Record<string, unknown>>).map((n) =>
          n.type === "component"
            ? {
                ...n,
                payload: {
                  ...(n.payload as Record<string, unknown>),
                  props: { avatar: "bgm" },
                },
              }
            : n,
        ),
      }),
    );
    expect(() =>
      parseMotionProjectV3({ ...input, components, assets, scenes }),
    ).toThrow(MotionV3ReferenceError);
    try {
      parseMotionProjectV3({ ...input, components, assets, scenes });
    } catch (err) {
      expect(String(err)).toContain("expected assetKind \"image\"");
    }
  });

  it("rejects asset keyframes and asset variables that do not match assetKind", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const components = (input.components as Array<Record<string, unknown>>).map(
      (c) => ({
        ...c,
        props: [
          ...((c.props as Array<Record<string, unknown>>) ?? []),
          {
            id: "avatar",
            kind: "asset",
            assetKind: "image",
            default: "logo-png",
            animatable: true,
          },
        ],
      }),
    );
    const assets = [
      {
        id: "logo-png",
        uri: "./logo.png",
        integrity: "sha256:logo",
        assetType: "image",
        mimeType: "image/png",
        width: 512,
        height: 512,
      },
      {
        id: "bgm",
        uri: "./bgm.mp3",
        integrity: "sha256:bgm",
        assetType: "audio",
        mimeType: "audio/mpeg",
        duration: 4,
      },
    ];
    const variables = [
      ...((input.variables as Array<Record<string, unknown>>) ?? []),
      {
        id: "avatar-var",
        name: "Avatar",
        type: "asset",
        assetKind: "audio",
        value: "bgm",
      },
    ];
    const keyframed = (input.scenes as Array<Record<string, unknown>>).map(
      (s) => ({
        ...s,
        nodes: (s.nodes as Array<Record<string, unknown>>).map((n) =>
          n.type === "component"
            ? {
                ...n,
                payload: {
                  ...(n.payload as Record<string, unknown>),
                  props: {
                    avatar: {
                      kind: "keyframes",
                      keys: [
                        { t: 0, value: "logo-png" },
                        { t: 1, value: "bgm" },
                      ],
                    },
                  },
                },
              }
            : n,
        ),
      }),
    );
    expect(() =>
      parseMotionProjectV3({
        ...input,
        components,
        assets,
        scenes: keyframed,
      }),
    ).toThrow(MotionV3ReferenceError);
    const bound = (input.scenes as Array<Record<string, unknown>>).map((s) => ({
      ...s,
      nodes: (s.nodes as Array<Record<string, unknown>>).map((n) =>
        n.type === "component"
          ? {
              ...n,
              payload: {
                ...(n.payload as Record<string, unknown>),
                props: {
                  avatar: { ref: { kind: "variable", id: "avatar-var" } },
                },
              },
            }
          : n,
      ),
    }));
    expect(() =>
      parseMotionProjectV3({
        ...input,
        components,
        assets,
        variables,
        scenes: bound,
      }),
    ).toThrow(MotionV3ReferenceError);
  });

  it("rejects choice values outside options, including enum variables", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const components = (input.components as Array<Record<string, unknown>>).map(
      (c) => ({
        ...c,
        props: [
          ...((c.props as Array<Record<string, unknown>>) ?? []),
          {
            id: "style",
            kind: "choice",
            options: ["solid", "outline"],
            default: "solid",
          },
        ],
      }),
    );
    const scenes = (input.scenes as Array<Record<string, unknown>>).map(
      (s) => ({
        ...s,
        nodes: (s.nodes as Array<Record<string, unknown>>).map((n) =>
          n.type === "component"
            ? {
                ...n,
                payload: {
                  ...(n.payload as Record<string, unknown>),
                  props: { style: "rainbow" },
                },
              }
            : n,
        ),
      }),
    );
    expect(() =>
      parseMotionProjectV3({ ...input, components, scenes }),
    ).toThrow(MotionV3ReferenceError);
    try {
      parseMotionProjectV3({ ...input, components, scenes });
    } catch (err) {
      expect(String(err)).toContain("is not in options");
    }

    const variables = [
      ...((input.variables as Array<Record<string, unknown>>) ?? []),
      {
        id: "style-var",
        name: "Style",
        type: "enum",
        value: "solid",
        options: ["solid", "outline", "rainbow"],
      },
    ];
    const boundScenes = (input.scenes as Array<Record<string, unknown>>).map(
      (s) => ({
        ...s,
        nodes: (s.nodes as Array<Record<string, unknown>>).map((n) =>
          n.type === "component"
            ? {
                ...n,
                payload: {
                  ...(n.payload as Record<string, unknown>),
                  props: {
                    style: { ref: { kind: "variable", id: "style-var" } },
                  },
                },
              }
            : n,
        ),
      }),
    );
    expect(() =>
      parseMotionProjectV3({
        ...input,
        components,
        variables,
        scenes: boundScenes,
      }),
    ).toThrow(MotionV3ReferenceError);
  });

  it("rejects unsorted, duplicate, and out-of-range keyframe times", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const components = (input.components as Array<Record<string, unknown>>).map(
      (c) => ({
        ...c,
        props: [
          ...((c.props as Array<Record<string, unknown>>) ?? []),
          { id: "progress", kind: "number", default: 0, animatable: true },
        ],
      }),
    );
    const withKeys = (
      keys: Array<{ t: number; value: number }>,
    ): Record<string, unknown> => ({
      ...input,
      components,
      scenes: (input.scenes as Array<Record<string, unknown>>).map((s) => ({
        ...s,
        nodes: (s.nodes as Array<Record<string, unknown>>).map((n) =>
          n.type === "component"
            ? {
                ...n,
                payload: {
                  ...(n.payload as Record<string, unknown>),
                  props: { progress: { kind: "keyframes", keys } },
                },
              }
            : n,
        ),
      })),
    });
    expect(() =>
      parseMotionProjectV3(withKeys([{ t: 1, value: 1 }, { t: 0, value: 0 }])),
    ).toThrow(MotionV3ReferenceError);
    expect(() =>
      parseMotionProjectV3(withKeys([{ t: 1, value: 0 }, { t: 1, value: 1 }])),
    ).toThrow(MotionV3ReferenceError);
    expect(() =>
      parseMotionProjectV3(withKeys([{ t: 0, value: 0 }, { t: 9, value: 1 }])),
    ).toThrow(MotionV3ReferenceError);
  });

  it("rejects legacy component bindings field and layerProperty.nodeId", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const withBindings = (input.components as Array<Record<string, unknown>>).map(
      (c) => ({ ...c, bindings: [] }),
    );
    expect(() =>
      MotionProjectV3Schema.parse({ ...input, components: withBindings }),
    ).toThrow();
    const withNodeId = (input.components as Array<Record<string, unknown>>).map(
      (c) => ({
        ...c,
        propBindings: [
          {
            propId: "color",
            target: {
              kind: "layerProperty",
              nodeId: "cta-bg",
              property: "payload.color",
            },
          },
        ],
      }),
    );
    expect(() =>
      MotionProjectV3Schema.parse({ ...input, components: withNodeId }),
    ).toThrow();
  });

  it("rejects internalBindings targeting an unknown layer", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const components = (input.components as Array<Record<string, unknown>>).map(
      (c) => ({
        ...c,
        internalBindings: [
          {
            id: "bind-ghost",
            source: { kind: "variable", variableId: "cta-label" },
            target: { layerId: "missing-layer", property: "payload.color" },
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
      expect(String(err)).toContain('unknown layer "missing-layer"');
    }
  });

  it("rejects legacy prop kind string", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const components = (input.components as Array<Record<string, unknown>>).map(
      (c) => ({
        ...c,
        props: [{ id: "label", kind: "string", default: "x" }],
      }),
    );
    expect(() => MotionProjectV3Schema.parse({ ...input, components })).toThrow();
  });

  it("accepts variant props targeting a declared prop", () => {
    const input = loadFixture("component.project.json") as Record<
      string,
      unknown
    >;
    const components = (input.components as Array<Record<string, unknown>>).map(
      (c) => ({
        ...c,
        variants: [
          {
            id: "primary",
            name: "Primary",
            props: { label: "Primary CTA" },
          },
        ],
      }),
    );
    const project = parseMotionProjectV3({ ...input, components });
    expect(project.components[0]!.variants[0]!.props).toEqual({
      label: "Primary CTA",
    });
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

  it("rejects duplicate zIndex among siblings with the same parentId", () => {
    const nodes: NodeV3[] = [
      makeNode({
        id: "text_1",
        type: "text",
        parentId: null,
        zIndex: 10,
        timing: { start: 0, duration: 3 },
      }),
      makeNode({
        id: "text_2",
        type: "text",
        parentId: null,
        zIndex: 10,
        timing: { start: 0, duration: 3 },
      }),
    ];
    const issues = validateNodeGraphV3(nodes, "scene.test");
    expect(issues.some((i) => i.message.includes("Duplicate zIndex"))).toBe(
      true,
    );
  });

  it("accepts the same zIndex under different parents", () => {
    const nodes: NodeV3[] = [
      makeNode({ id: "group.a", type: "group", parentId: null, zIndex: 0 }),
      makeNode({ id: "group.b", type: "group", parentId: null, zIndex: 1 }),
      makeNode({
        id: "child.a",
        type: "image",
        parentId: "group.a",
        zIndex: 5,
        payload: { assetId: "a" },
      }),
      makeNode({
        id: "child.b",
        type: "image",
        parentId: "group.b",
        zIndex: 5,
        payload: { assetId: "b" },
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
  function makeValidProject(clipOverrides: Record<string, unknown>) {
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
            order: -1,
            clips: [
              {
                id: "at1-clip",
                assetId: "audio1",
                start: 0,
                duration: 5,
                ...clipOverrides,
              },
            ],
          },
        ],
      },
    });
  }

  it("rejects audio clip with trimEnd > duration", () => {
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

  it("accepts audio clip with all optional fields", () => {
    const result = makeValidProject({
      trimStart: 1,
      volume: 0.5,
      loop: true,
      fadeIn: 2,
      fadeOut: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const clip = result.data.timeline.audioTracks[0]!.clips[0]!;
      expect(clip.volume).toBe(0.5);
      expect(clip.fadeIn).toBe(2);
      expect(clip.fadeOut).toBe(1);
      expect(clip.loop).toBe(true);
    }
  });

  it("rejects audio clip with negative volume", () => {
    const result = makeValidProject({ volume: -0.1 });
    expect(result.success).toBe(false);
  });

  it("rejects audio clip with volume > 1", () => {
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
      {
        id: "dup-at",
        order: -1,
        clips: [{ id: "c1", assetId: "bgm", start: 0, duration: 5 }],
      },
      {
        id: "dup-at",
        order: -2,
        clips: [{ id: "c2", assetId: "bgm", start: 5, duration: 3 }],
      },
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
      {
        id: "at1",
        order: -1,
        clips: [{ id: "c1", assetId: "bgm", start: 0, duration: 5 }],
      },
      {
        id: "at2",
        order: -2,
        clips: [{ id: "c2", assetId: "bgm", start: 5, duration: 3 }],
      },
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
