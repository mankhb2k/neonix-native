import { describe, expect, it, beforeEach } from "vitest";
import { useEditorStore } from "@/lib/editor/editor-store";
import { fixtureBasePlusOverlay } from "@/lib/editor/__fixtures__/projects";
import {
  selectionClips,
  selectedSceneIdFrom,
} from "@motionvideo/editor-core";
import { DEFAULT_VISUAL_POLICY } from "@motionvideo/editor-core";

describe("editor-store placement + lock", () => {
  beforeEach(() => {
    const { project, clips, lanes } = fixtureBasePlusOverlay();
    useEditorStore.getState().loadProject(project, [], clips, lanes);
  });

  it("paste main resolves collision instead of raw startTime", () => {
    const store = useEditorStore.getState();
    store.selectClip("clip.base");
    store.copySelectedClips();
    store.pasteClips(0);
    const clips = useEditorStore
      .getState()
      .timelineClips.filter(
        (c) => c.kind === "scene" && c.laneId === "lane.main",
      );
    expect(clips.length).toBe(2);
    const sorted = [...clips].sort((a, b) => a.startTime - b.startTime);
    expect(sorted[1].startTime).toBeGreaterThanOrEqual(
      sorted[0].startTime + sorted[0].duration,
    );
  });

  it("cut on locked lane is no-op (no clipboard)", () => {
    const locked = useEditorStore.getState().timelineLanes.map((lane) =>
      lane.id === "lane.main" ? { ...lane, locked: true } : lane,
    );
    useEditorStore.setState({ timelineLanes: locked, timelineClipboard: null });
    useEditorStore.getState().selectClip("clip.base");
    useEditorStore.getState().cutSelectedClips();
    expect(useEditorStore.getState().timelineClipboard).toBeNull();
    expect(
      useEditorStore.getState().timelineClips.some((c) => c.id === "clip.base"),
    ).toBe(true);
  });

  it("updateSceneDuration pushes overlapping clip on same lane", () => {
    const { project } = fixtureBasePlusOverlay();
    useEditorStore.getState().loadProject(
      project,
      [],
      [
        {
          id: "a",
          kind: "scene",
          sceneId: "scene.base",
          laneId: "lane.main",
          startTime: 0,
          duration: 2,
          name: "A",
        },
        {
          id: "b",
          kind: "scene",
          sceneId: "scene.overlay",
          laneId: "lane.main",
          startTime: 2,
          duration: 2,
          name: "B",
        },
      ],
      [
        {
          id: "lane.main",
          kind: "visual",
          role: "base",
          order: -1,
          name: "Main",
          policy: { ...DEFAULT_VISUAL_POLICY },
        },
      ],
    );
    useEditorStore.getState().updateSceneDuration("scene.base", 3);
    const clips = useEditorStore.getState().timelineClips;
    const a = clips.find((c) => c.id === "a")!;
    const b = clips.find((c) => c.id === "b")!;
    expect(a.duration).toBe(3);
    expect(b.startTime).toBeGreaterThanOrEqual(a.startTime + a.duration);
  });

  it("selectedSceneIdFrom works for overlay via store selection", () => {
    const { timelineClips, timelineLanes } = useEditorStore.getState();
    useEditorStore.setState({
      selection: selectionClips(["clip.overlay"]),
    });
    expect(
      selectedSceneIdFrom(
        useEditorStore.getState().selection,
        timelineClips,
        timelineLanes,
      ),
    ).toBe("scene.overlay");
  });

  it("moveClip overlay→overlay changes laneId", () => {
    const { project, clips, lanes } = fixtureBasePlusOverlay();
    useEditorStore.getState().loadProject(project, [], clips, lanes);
    // loadProject prune empty — gắn lane đích sau load.
    useEditorStore.setState((s) => ({
      timelineLanes: [
        ...s.timelineLanes,
        {
          id: "lane.overlay.1",
          kind: "visual",
          role: "overlay",
          order: 1,
          name: "Lớp 2",
          policy: { ...DEFAULT_VISUAL_POLICY },
        },
      ],
    }));
    useEditorStore.getState().moveClip("clip.overlay", {
      track: "overlay",
      startTime: 0,
      laneId: "lane.overlay.1",
    });
    const moved = useEditorStore
      .getState()
      .timelineClips.find((c) => c.id === "clip.overlay");
    expect(moved?.laneId).toBe("lane.overlay.1");
  });

  it("moveClip insertNewLane creates a new overlay lane", () => {
    const originLaneId = useEditorStore
      .getState()
      .timelineClips.find((c) => c.id === "clip.overlay")?.laneId;
    useEditorStore.getState().moveClip("clip.overlay", {
      track: "overlay",
      startTime: 0.5,
      insertNewLane: true,
      insertOrder: 1,
    });
    const moved = useEditorStore
      .getState()
      .timelineClips.find((c) => c.id === "clip.overlay");
    expect(moved?.laneId).toBeTruthy();
    expect(moved?.laneId).not.toBe(originLaneId);
    const dest = useEditorStore
      .getState()
      .timelineLanes.find((l) => l.id === moved?.laneId);
    expect(dest?.kind).toBe("visual");
    expect(dest && dest.kind === "visual" ? dest.role : null).toBe("overlay");
  });

  it("audio body collision keeps laneId and snaps startTime", () => {
    const { project } = fixtureBasePlusOverlay();
    useEditorStore.getState().loadProject(
      project,
      [],
      [
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
          id: "a1",
          kind: "audio",
          audioTrackId: "a1",
          assetId: "asset.a",
          laneId: "lane.audio.0",
          startTime: 0,
          duration: 3,
          name: "A1",
        },
        {
          id: "a2",
          kind: "audio",
          audioTrackId: "a2",
          assetId: "asset.b",
          laneId: "lane.audio.0",
          startTime: 5,
          duration: 2,
          name: "A2",
        },
      ],
      [
        {
          id: "lane.main",
          kind: "visual",
          role: "base",
          order: -1,
          name: "Main",
          policy: { ...DEFAULT_VISUAL_POLICY },
        },
        {
          id: "lane.audio.0",
          kind: "audio",
          role: "audio",
          order: 0,
          name: "Audio 1",
        },
      ],
    );
    useEditorStore.getState().moveClip("a2", {
      track: "audio",
      startTime: 1,
      laneId: "lane.audio.0",
    });
    const moved = useEditorStore.getState().timelineClips.find((c) => c.id === "a2");
    expect(moved?.laneId).toBe("lane.audio.0");
    expect(moved?.startTime).not.toBe(1);
    // Nearest snap away from [0,3)
    expect(
      moved!.startTime >= 3 || moved!.startTime + moved!.duration <= 0,
    ).toBe(true);
  });
});
