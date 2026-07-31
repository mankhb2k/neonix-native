import { describe, expect, it } from "vitest";
import { buildExportProject } from "@/lib/editor/export/build-export-project";
import {
  buildEditorProjectEnvelope,
  parseEditorImport,
  serializeEditorProjectEnvelope,
} from "@/lib/editor/export/editor-project-envelope";
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
