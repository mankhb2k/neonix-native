import { describe, expect, it } from "vitest";
import {
  buildExportProject,
  composeVisualLayersAtTime,
  DEFAULT_VISUAL_POLICY,
  resolveBakedLocalTime,
  type TimelineClip,
  type TimelineLane,
} from "@motionvideo/editor-core";
import {
  buildEditorProjectEnvelope,
  parseEditorImport,
  serializeEditorProjectEnvelope,
} from "@/lib/editor/export/editor-project-envelope";
import { fixtureBasePlusOverlay } from "@/lib/editor/__fixtures__/projects";
import {
  parseMotionProject,
  type MotionProject,
} from "@motionvideo/motion-protocol";
import { visualLayerAtoms } from "@motionvideo/motion-protocol";

describe("buildExportProject", () => {
  it("bakes base + gap + overlay + muted audio into valid MotionProject", () => {
    const { project, lanes } = fixtureBasePlusOverlay();
    // Gap trên base: clip 0–2, gap 2–3, clip 3–5
    const gapClips: TimelineClip[] = [
      {
        id: "clip.base.a",
        kind: "scene",
        sceneId: "scene.base",
        laneId: "lane.main",
        startTime: 0,
        duration: 2,
        name: "A",
      },
      {
        id: "clip.base.b",
        kind: "scene",
        sceneId: "scene.base",
        laneId: "lane.main",
        startTime: 3,
        duration: 2,
        name: "B",
      },
      {
        id: "clip.overlay",
        kind: "scene",
        sceneId: "scene.overlay",
        laneId: "lane.overlay.0",
        startTime: 1,
        duration: 2,
        name: "Ov",
      },
      {
        id: "audio.1",
        kind: "audio",
        audioTrackId: "audio.1",
        assetId: "asset.audio.a",
        laneId: "lane.audio.0",
        startTime: 0,
        duration: 4,
        name: "Bed",
      },
    ];
    const gapLanes: TimelineLane[] = [
      ...lanes,
      {
        id: "lane.audio.0",
        kind: "audio",
        role: "audio",
        order: 0,
        name: "Audio 1",
        muted: true,
      },
    ];
    const withAsset = parseMotionProject({
      ...project,
      assets: [
        {
          id: "asset.audio.a",
          assetType: "audio",
          uri: "assets/bed.mp3",
          integrity: "sha256-fixture",
          mimeType: "audio/mpeg",
          duration: 4,
          codec: "mp3",
          sampleRate: 44100,
          channels: 2,
        },
      ],
      layers: [
        ...project.layers,
        {
          id: "audio.1",
          type: "audio",
          parentLayerId: null,
          zIndex: -1,
          timing: { start: 0, duration: 4 },
          payload: {
            assetId: "asset.audio.a",
            trimStart: 0,
            playbackRate: 1,
            volume: 100,
            loop: false,
            fadeIn: 0,
            fadeOut: 0,
            muted: false,
          },
        },
      ],
    }) as MotionProject;

    const baked = buildExportProject({
      project: withAsset,
      timelineClips: gapClips,
      timelineLanes: gapLanes,
    });

    const visualLayers = baked.layers.filter((l) => l.type !== "audio");
    expect(visualLayers.length).toBeGreaterThanOrEqual(3);
    // Tổng duration bake ≈ content end (5s) với gap pad.
    const total = visualLayers.reduce(
      (sum, layer) => sum + layer.timing.duration,
      0,
    );
    expect(total).toBeCloseTo(5, 1);

    // Overlay bake: segment có overlay phải có thêm node từ overlay scene.
    const overlaySource = withAsset.layers.find(
      (s) => s.id === "scene.overlay",
    );
    const baseSource = withAsset.layers.find((s) => s.id === "scene.base");
    const overlaySourceNodes =
      overlaySource?.type === "group" ? overlaySource.children.length : 0;
    const baseSourceNodes =
      baseSource?.type === "group" ? baseSource.children.length : 0;
    const merged = visualLayers.some(
      (s) =>
        s.type === "group" &&
        s.children.length >= baseSourceNodes + overlaySourceNodes,
    );
    expect(merged).toBe(true);

    const track = baked.layers.find((l) => l.type === "audio");
    expect(track?.payload.volume).toBe(0);
  });

  it("skips hidden overlay lanes", () => {
    const { project, clips, lanes } = fixtureBasePlusOverlay();
    const hiddenLanes = lanes.map((lane) =>
      lane.id === "lane.overlay.0"
        ? { ...lane, visible: false as const }
        : lane,
    );
    const baked = buildExportProject({
      project,
      timelineClips: clips,
      timelineLanes: hiddenLanes,
    });
    const visualLayers = baked.layers.filter((l) => l.type !== "audio");
    const maxNodes = Math.max(
      ...visualLayers.map((s) => (s.type === "group" ? s.children.length : 0)),
    );
    const baseSource = project.layers.find((s) => s.id === "scene.base");
    const baseNodes =
      baseSource?.type === "group" ? baseSource.children.length : 0;
    expect(maxNodes).toBe(baseNodes);
  });
});

describe("editor project envelope", () => {
  it("roundtrips clips and lanes", () => {
    const { project, clips, lanes } = fixtureBasePlusOverlay();
    const envelope = buildEditorProjectEnvelope({
      project,
      timelineClips: clips,
      timelineLanes: lanes,
    });
    const text = serializeEditorProjectEnvelope(envelope);
    const parsed = parseEditorImport(JSON.parse(text));
    expect(parsed.kind).toBe("envelope");
    if (parsed.kind !== "envelope") return;
    expect(parsed.timelineClips).toHaveLength(clips.length);
    expect(parsed.timelineLanes).toHaveLength(lanes.length);
    expect(parsed.project.metadata.id).toBe(project.metadata.id);
  });

  it("accepts raw MotionProject", () => {
    const { project } = fixtureBasePlusOverlay();
    const parsed = parseEditorImport(project);
    expect(parsed.kind).toBe("project");
    expect(parsed.timelineClips).toEqual([]);
  });
});

describe("DEFAULT_VISUAL_POLICY smoke", () => {
  it("keeps allowOverlap false", () => {
    expect(DEFAULT_VISUAL_POLICY.allowOverlap).toBe(false);
  });
});

describe("export temporal parity (local-time bake)", () => {
  function sceneWithAbsoluteAnim(id: string, duration: number) {
    return {
      id,
      type: "group" as const,
      parentLayerId: null,
      zIndex: 0,
      ...visualLayerAtoms({ x: 0, y: 0, width: 1920, height: 1080 }),
      timing: { start: 0, duration },
      children: [
        {
          id: `${id}.node`,
          type: "text" as const,
          parentLayerId: id,
          zIndex: 0,
          timing: { start: 0, duration },
          ...visualLayerAtoms({ x: 0, y: 0, width: 100, height: 40 }),
          payload: {
            text: id,
            fontSize: 20,
            color: "#000000",
            alignment: "left" as const,
          },
        },
      ],
    };
  }

  it("preserves base local-time across overlay boundary (pre / at / post)", () => {
    const baseScene = sceneWithAbsoluteAnim("scene.base", 6);
    const overlayScene = sceneWithAbsoluteAnim("scene.overlay", 2);
    const project = parseMotionProject({
      format: "motion-project",
      formatVersion: 1,
      metadata: {
        id: "parity.boundary",
        name: "Parity",
        locale: "vi-VN",
      },
      composition: {
        width: 1920,
        height: 1080,
        fps: 30,
        background: "#111111",
        colorSpace: "srgb",
      },
      assets: [],
      components: [],
      layers: [
        { ...baseScene, zIndex: 0 },
        { ...overlayScene, zIndex: 1 },
      ],
    }) as MotionProject;

    const lanes: TimelineLane[] = [
      {
        id: "lane.main",
        kind: "visual",
        role: "base",
        order: -1,
        name: "Main",
        policy: { ...DEFAULT_VISUAL_POLICY },
      },
      {
        id: "lane.overlay.0",
        kind: "visual",
        role: "overlay",
        order: 0,
        name: "L1",
        policy: { ...DEFAULT_VISUAL_POLICY },
      },
    ];
    // Base 0–6; overlay starts at 2 → bake splits at 2
    const clips: TimelineClip[] = [
      {
        id: "clip.base",
        kind: "scene",
        sceneId: "scene.base",
        laneId: "lane.main",
        startTime: 0,
        duration: 6,
        name: "Base",
      },
      {
        id: "clip.overlay",
        kind: "scene",
        sceneId: "scene.overlay",
        laneId: "lane.overlay.0",
        startTime: 2,
        duration: 2,
        name: "Ov",
      },
    ];

    const baked = buildExportProject({
      project,
      timelineClips: clips,
      timelineLanes: lanes,
    });

    const fps = 30;
    const samples = [
      2 - 1 / fps, // before boundary
      2, // at boundary
      2 + 1 / fps, // after boundary
    ];

    for (const globalTime of samples) {
      const previewLayers = composeVisualLayersAtTime(clips, lanes, globalTime);
      const basePreview = previewLayers.find((l) => l.role === "base");
      expect(basePreview).toBeDefined();

      const bakedLocal = resolveBakedLocalTime(baked, globalTime);
      expect(bakedLocal).not.toBeNull();

      // Segment start from the baked layer this local time belongs to.
      const bakedScene = baked.layers.find((s) => s.id === bakedLocal!.layerId);
      const segmentStart = bakedScene?.timing.start ?? 0;
      // Continuity: preview localTime ≡ bakedLocal + slice offset into source scene
      expect(bakedLocal!.localTime + segmentStart).toBeCloseTo(
        basePreview!.localTime,
        3,
      );
    }
  });

  it("bakes base gap + overlay without dropping overlay layers", () => {
    const { project, lanes } = fixtureBasePlusOverlay();
    const clips: TimelineClip[] = [
      {
        id: "clip.base.a",
        kind: "scene",
        sceneId: "scene.base",
        laneId: "lane.main",
        startTime: 0,
        duration: 1,
        name: "A",
      },
      {
        id: "clip.base.b",
        kind: "scene",
        sceneId: "scene.base",
        laneId: "lane.main",
        startTime: 3,
        duration: 1,
        name: "B",
      },
      {
        id: "clip.overlay",
        kind: "scene",
        sceneId: "scene.overlay",
        laneId: "lane.overlay.0",
        startTime: 1.5,
        duration: 1,
        name: "Ov",
      },
    ];
    const baked = buildExportProject({
      project,
      timelineClips: clips,
      timelineLanes: lanes,
    });
    const midGap = 2;
    const layers = composeVisualLayersAtTime(clips, lanes, midGap);
    expect(layers.some((l) => l.role === "overlay")).toBe(true);
    const bakedAt = resolveBakedLocalTime(baked, midGap);
    expect(bakedAt).not.toBeNull();
    const scene = baked.layers.find((s) => s.id === bakedAt!.layerId);
    const overlaySource = project.layers.find((s) => s.id === "scene.overlay");
    const overlayNodes =
      overlaySource?.type === "group" ? overlaySource.children.length : 0;
    expect(
      (scene?.type === "group" ? scene.children.length : 0) >= overlayNodes,
    ).toBe(true);
  });

  it("exports muted audio at volume 0 and preserves trimStart", () => {
    const { project, lanes } = fixtureBasePlusOverlay();
    const withAsset = parseMotionProject({
      ...project,
      assets: [
        {
          id: "asset.audio.a",
          assetType: "audio",
          uri: "assets/bed.mp3",
          integrity: "sha256-fixture",
          mimeType: "audio/mpeg",
          duration: 8,
          codec: "mp3",
          sampleRate: 44100,
          channels: 2,
        },
      ],
      layers: [
        ...project.layers,
        {
          id: "audio.1",
          type: "audio",
          parentLayerId: null,
          zIndex: -1,
          timing: { start: 0, duration: 4 },
          payload: {
            assetId: "asset.audio.a",
            trimStart: 1.25,
            playbackRate: 1,
            volume: 80,
            loop: false,
            fadeIn: 0.1,
            fadeOut: 0.2,
            muted: false,
          },
        },
      ],
    });
    const clips: TimelineClip[] = [
      {
        id: "clip.base",
        kind: "scene",
        sceneId: "scene.base",
        laneId: "lane.main",
        startTime: 0,
        duration: 4,
        name: "Base",
      },
      {
        id: "audio.1",
        kind: "audio",
        audioTrackId: "audio.1",
        assetId: "asset.audio.a",
        laneId: "lane.audio.0",
        startTime: 0,
        duration: 4,
        name: "Bed",
      },
    ];
    const gapLanes: TimelineLane[] = [
      ...lanes,
      {
        id: "lane.audio.0",
        kind: "audio",
        role: "audio",
        order: 0,
        name: "Audio 1",
        muted: true,
      },
    ];
    const baked = buildExportProject({
      project: withAsset,
      timelineClips: clips,
      timelineLanes: gapLanes,
    });
    const track = baked.layers.find((l) => l.type === "audio");
    expect(track?.payload.volume).toBe(0);
    expect(track?.payload.trimStart).toBeCloseTo(1.25, 5);
    expect(track?.payload.fadeIn).toBeCloseTo(0.1, 5);
    expect(track?.payload.fadeOut).toBeCloseTo(0.2, 5);
    // Asset duration (8s) must NOT win over clip placement (4s).
    expect(track?.timing.duration).toBeCloseTo(4, 5);
  });

  it("exports audio span from clip.duration, not asset.duration", () => {
    const { project, lanes } = fixtureBasePlusOverlay();
    const withAsset = parseMotionProject({
      ...project,
      assets: [
        {
          id: "asset.audio.long",
          assetType: "audio",
          uri: "assets/bed.mp3",
          integrity: "sha256-fixture",
          mimeType: "audio/mpeg",
          duration: 8,
          codec: "mp3",
          sampleRate: 44100,
          channels: 2,
        },
      ],
      layers: [
        ...project.layers,
        {
          id: "audio.trimmed",
          type: "audio",
          parentLayerId: null,
          zIndex: -1,
          timing: { start: 0, duration: 4 },
          payload: {
            assetId: "asset.audio.long",
            trimStart: 0,
            playbackRate: 1,
            volume: 100,
            loop: false,
            fadeIn: 0,
            fadeOut: 0,
            muted: false,
          },
        },
      ],
    });
    const clips: TimelineClip[] = [
      {
        id: "clip.base",
        kind: "scene",
        sceneId: "scene.base",
        laneId: "lane.main",
        startTime: 0,
        duration: 4,
        name: "Base",
      },
      {
        id: "audio.trimmed",
        kind: "audio",
        audioTrackId: "audio.trimmed",
        assetId: "asset.audio.long",
        laneId: "lane.audio.0",
        startTime: 0,
        duration: 4,
        name: "Bed",
      },
    ];
    const audioLanes: TimelineLane[] = [
      ...lanes,
      {
        id: "lane.audio.0",
        kind: "audio",
        role: "audio",
        order: 0,
        name: "Audio 1",
      },
    ];
    const baked = buildExportProject({
      project: withAsset,
      timelineClips: clips,
      timelineLanes: audioLanes,
    });
    const track = baked.layers.find((l) => l.type === "audio");
    expect(track?.timing.duration).toBeCloseTo(4, 5);
  });
});

describe("export determinism", () => {
  it("produces identical layer ids across two exports of the same input", () => {
    const { project, clips, lanes } = fixtureBasePlusOverlay();
    const input = { project, timelineClips: clips, timelineLanes: lanes };
    const first = buildExportProject(input);
    const second = buildExportProject(input);

    const idsOf = (p: MotionProject) => p.layers.map((l) => l.id);
    expect(idsOf(first)).toEqual(idsOf(second));

    // Nested baked segment children are deterministic too.
    const nestedOf = (p: MotionProject) =>
      p.layers
        .filter((l) => l.type === "group")
        .flatMap((l) => l.children.map((c) => c.id));
    expect(nestedOf(first)).toEqual(nestedOf(second));
    expect(nestedOf(first).length).toBeGreaterThan(0);
  });
});
