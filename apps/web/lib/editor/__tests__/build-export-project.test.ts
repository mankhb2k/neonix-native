import { describe, expect, it } from "vitest";
import {
  buildExportProject,
  resolveBakedLocalTime,
} from "@/lib/editor/export/build-export-project";
import {
  buildEditorProjectEnvelope,
  parseEditorImport,
  serializeEditorProjectEnvelope,
} from "@/lib/editor/export/editor-project-envelope";
import { composeVisualLayersAtTime } from "@/lib/editor/preview/compose-layers";
import { fixtureBasePlusOverlay } from "@/lib/editor/__fixtures__/projects";
import {
  DEFAULT_VISUAL_POLICY,
  type TimelineClip,
  type TimelineLane,
} from "@/lib/editor/timeline-clips";
import { parseMotionProject } from "@motionvideo/motion-schema";

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
      timeline: {
        ...project.timeline,
        audioTracks: [
          {
            id: "audio.1",
            role: "bgm",
            assetId: "asset.audio.a",
            start: 0,
            volume: 1,
          },
        ],
      },
    });

    const baked = buildExportProject({
      project: withAsset,
      timelineClips: gapClips,
      timelineLanes: gapLanes,
    });

    expect(baked.timeline.sceneOrder.length).toBeGreaterThanOrEqual(3);
    // Tổng duration bake ≈ content end (5s) với gap pad.
    const total = baked.timeline.sceneOrder.reduce((sum, id) => {
      const scene = baked.scenes.find((s) => s.id === id);
      return sum + (scene?.duration ?? 0);
    }, 0);
    expect(total).toBeCloseTo(5, 1);

    // Overlay bake: segment có overlay phải có thêm node từ overlay scene.
    const overlaySourceNodes =
      withAsset.scenes.find((s) => s.id === "scene.overlay")?.nodes.length ?? 0;
    const baseSourceNodes =
      withAsset.scenes.find((s) => s.id === "scene.base")?.nodes.length ?? 0;
    const merged = baked.scenes.some(
      (s) => s.nodes.length >= baseSourceNodes + overlaySourceNodes,
    );
    expect(merged).toBe(true);

    const track = baked.timeline.audioTracks?.[0];
    expect(track?.volume).toBe(0);
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
    const maxNodes = Math.max(...baked.scenes.map((s) => s.nodes.length));
    const baseNodes =
      project.scenes.find((s) => s.id === "scene.base")?.nodes.length ?? 0;
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
      name: id,
      duration,
      nodes: [
        {
          id: `${id}.node`,
          type: "text" as const,
          parentId: null,
          transform: {
            x: 0,
            y: 0,
            width: 100,
            height: 40,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            anchorX: 0,
            anchorY: 0,
            opacity: 1,
            visible: true,
            flipX: false,
            flipY: false,
          },
          payload: {
            text: id,
            fontSize: 20,
            fontWeight: 400,
            align: "left" as const,
          },
          style: { fill: "#000000" },
        },
      ],
      clips: [
        {
          id: `${id}.anim`,
          targetId: `${id}.node`,
          schedule: { kind: "absolute" as const, at: 0 },
          duration,
          playback: {},
          source: {
            kind: "tracks" as const,
            tracks: [
              {
                targetId: `${id}.node`,
                property: "transform.opacity",
                keys: [
                  { t: 0, v: 0 },
                  { t: duration, v: 1 },
                ],
              },
            ],
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
      formatVersion: 2,
      metadata: {
        id: "parity.boundary",
        name: "Parity",
        aspectRatio: "16:9",
        fps: 30,
        locale: "vi-VN",
        brand: {
          name: "Parity",
          primaryColor: "#111111",
          fontFamily: "Be Vietnam Pro",
        },
      },
      dependencies: { components: [] },
      assets: [],
      variables: [],
      timeline: {
        sceneOrder: ["scene.base", "scene.overlay"],
        audioTracks: [],
      },
      scenes: [baseScene, overlayScene],
      bindings: [],
      extensions: { constraints: [], events: [] },
    });

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

      // Segment starts at floor boundary under globalTime; localStart = t0 - clip.start
      let cursor = 0;
      let segmentStart = 0;
      for (const sceneId of baked.timeline.sceneOrder) {
        const sc = baked.scenes.find((s) => s.id === sceneId)!;
        const end = cursor + sc.duration;
        if (sceneId === bakedLocal!.sceneId) {
          segmentStart = cursor;
          break;
        }
        cursor = end;
      }
      const sliceLocalStart = segmentStart - 0; // base clip starts at 0
      // Continuity: preview localTime ≡ bakedLocal + slice offset into source scene
      expect(bakedLocal!.localTime + sliceLocalStart).toBeCloseTo(
        basePreview!.localTime,
        3,
      );

      const bakedScene = baked.scenes.find((s) => s.id === bakedLocal!.sceneId);
      const anim = bakedScene?.clips?.find((c) =>
        String(c.id).includes("anim") || c.targetId?.includes("base"),
      );
      // Prefer base anim (not remapped overlay)
      const baseAnim = bakedScene?.clips?.find(
        (c) => c.targetId === "scene.base.node",
      );
      const check = baseAnim ?? anim;
      expect(check?.schedule.kind).toBe("absolute");
      if (check?.schedule.kind === "absolute") {
        expect(check.schedule.at).toBeCloseTo(0, 5);
      }
      if (check?.source.kind === "tracks") {
        expect(check.source.tracks[0].keys[0]?.t).toBeCloseTo(0, 5);
      }
    }
  });

  it("bakes base gap + overlay without dropping overlay nodes", () => {
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
    const scene = baked.scenes.find((s) => s.id === bakedAt!.sceneId);
    const overlayNodes =
      project.scenes.find((s) => s.id === "scene.overlay")?.nodes.length ?? 0;
    expect((scene?.nodes.length ?? 0) >= overlayNodes).toBe(true);
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
      timeline: {
        ...project.timeline,
        audioTracks: [
          {
            id: "audio.1",
            role: "bgm",
            assetId: "asset.audio.a",
            start: 0,
            trimStart: 1.25,
            volume: 0.8,
            fadeIn: 0.1,
            fadeOut: 0.2,
          },
        ],
      },
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
    const track = baked.timeline.audioTracks?.[0];
    expect(track?.volume).toBe(0);
    expect(track?.trimStart).toBeCloseTo(1.25, 5);
    expect(track?.fadeIn).toBeCloseTo(0.1, 5);
    expect(track?.fadeOut).toBeCloseTo(0.2, 5);
  });
});
