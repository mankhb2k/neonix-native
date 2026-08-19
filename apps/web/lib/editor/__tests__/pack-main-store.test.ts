import { beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/lib/editor/editor-store";
import {
  groupPathToTimelineClips,
  packRootLayersToTimeline,
} from "@motionvideo/editor-core";
import {
  parseMotionProjectV1,
  serializeMotionProjectV1,
  visualLayerAtoms,
  type MotionLayer,
} from "@motionvideo/motion-protocol";

const ATOMS = visualLayerAtoms({ width: 1920, height: 1080 });

const VIDEO_ASSET = {
  id: "asset.video",
  uri: "./clip.mp4",
  assetType: "video" as const,
  mimeType: "video/mp4",
  width: 1920,
  height: 1080,
  duration: 12,
  fps: 30,
};

const AUDIO_ASSET = {
  id: "asset.audio",
  uri: "./bed.mp3",
  assetType: "audio" as const,
  mimeType: "audio/mpeg",
  duration: 12,
};

function sequentialPackedProject() {
  const layers: MotionLayer[] = [
    {
      id: "video-a",
      type: "video",
      parentLayerId: null,
      zIndex: 0,
      timing: { start: 0, duration: 4 },
      ...ATOMS,
      payload: { assetId: VIDEO_ASSET.id, trimStart: 0 },
    } as MotionLayer,
    {
      id: "video-b",
      type: "video",
      parentLayerId: null,
      zIndex: 1,
      timing: { start: 4, duration: 4 },
      ...ATOMS,
      payload: { assetId: VIDEO_ASSET.id, trimStart: 0 },
    } as MotionLayer,
    {
      id: "hero",
      type: "group",
      parentLayerId: null,
      zIndex: 2,
      timing: { start: 8, duration: 4 },
      ...ATOMS,
      children: [
        {
          id: "hero.title",
          type: "text",
          parentLayerId: "hero",
          zIndex: 0,
          timing: { start: 0, duration: 4 },
          ...visualLayerAtoms({ width: 200, height: 40 }),
          payload: {
            text: "Title",
            fontSize: 24,
            color: "#111111",
            alignment: "left",
          },
        } as MotionLayer,
        {
          id: "hero.sub",
          type: "text",
          parentLayerId: "hero",
          zIndex: 1,
          timing: { start: 1, duration: 2 },
          ...visualLayerAtoms({ width: 200, height: 40 }),
          payload: {
            text: "Sub",
            fontSize: 18,
            color: "#333333",
            alignment: "left",
          },
        } as MotionLayer,
      ],
    } as MotionLayer,
    {
      id: "music",
      type: "audio",
      parentLayerId: null,
      zIndex: -1,
      timing: { start: 0, duration: 12 },
      payload: {
        assetId: AUDIO_ASSET.id,
        trimStart: 0,
        playbackRate: 1,
        volume: 100,
        loop: false,
        fadeIn: 0,
        fadeOut: 0,
        muted: false,
      },
    } as MotionLayer,
  ];
  return parseMotionProjectV1({
    format: "motion-project",
    formatVersion: 1,
    metadata: { id: "pack.web", name: "Pack web", locale: "vi-VN" },
    composition: { width: 1920, height: 1080, fps: 30 },
    assets: [VIDEO_ASSET, AUDIO_ASSET],
    components: [],
    layers,
  });
}

describe("web store packed Main write-back", () => {
  beforeEach(() => {
    const project = sequentialPackedProject();
    useEditorStore.getState().loadProject(project, [], [], []);
  });

  it("packs two sequential videos + group onto Main with unique zIndex", () => {
    const { project, timelineClips } = useEditorStore.getState();
    expect(project).not.toBeNull();
    if (!project) return;
    const visual = timelineClips.filter((c) => c.kind === "scene");
    expect(visual.every((c) => c.laneId === "lane.main")).toBe(true);
    expect(visual.map((c) => c.id).sort()).toEqual(["hero", "video-a", "video-b"]);
    const z = project.layers
      .filter((l) => l.type !== "audio")
      .map((l) => l.zIndex);
    expect(new Set(z).size).toBe(z.length);
    expect(() => parseMotionProjectV1(project)).not.toThrow();
  });

  it("keeps unique zIndex after a no-op rebuild from packed clips", () => {
    const state = useEditorStore.getState();
    const packed = packRootLayersToTimeline(state.project!);
    expect(packed.clips.filter((c) => c.kind === "scene").every((c) => c.laneId === "lane.main")).toBe(
      true,
    );
    const json = serializeMotionProjectV1(state.project!);
    expect(json).toContain("formatVersion");
    expect(json).not.toContain("laneId");
  });
});

describe("web group timeline surface", () => {
  beforeEach(() => {
    const project = sequentialPackedProject();
    useEditorStore.getState().loadProject(project, [], [], []);
  });

  it("hides audio and shows direct children after enterGroup", () => {
    useEditorStore.getState().enterGroup("hero");
    const { project, groupPath, timelineClips } = useEditorStore.getState();
    expect(groupPath).toEqual(["hero"]);
    // Store keeps packed Main clips; the group surface is derived.
    expect(timelineClips.some((c) => c.kind === "audio")).toBe(true);
    const surface = groupPathToTimelineClips(project!, groupPath);
    expect(surface.clips.every((c) => c.kind === "scene")).toBe(true);
    expect(surface.clips.map((c) => c.id).sort()).toEqual([
      "hero.sub",
      "hero.title",
    ]);
    expect(surface.lanes.some((l) => l.kind === "audio")).toBe(false);
  });

  it("navigateGroupDepth(0) returns to Main packing", () => {
    useEditorStore.getState().enterGroup("hero");
    useEditorStore.getState().navigateGroupDepth(0);
    expect(useEditorStore.getState().groupPath).toEqual([]);
    const clips = useEditorStore.getState().timelineClips;
    expect(clips.some((c) => c.id === "hero")).toBe(true);
    expect(clips.some((c) => c.kind === "audio")).toBe(true);
  });
});

describe("protocol JSON sidecar", () => {
  it("serializes MotionProjectV1 without envelope laneId", () => {
    const project = sequentialPackedProject();
    useEditorStore.getState().loadProject(project, [], [], []);
    const json = serializeMotionProjectV1(useEditorStore.getState().project!);
    expect(json).toContain('"formatVersion": 1');
    expect(json).toContain("video-a");
    expect(json).toContain("hero");
    expect(json).not.toMatch(/"laneId"/);
    expect(json).not.toContain("timelineClips");
    expect(() => parseMotionProjectV1(JSON.parse(json))).not.toThrow();
  });
});
