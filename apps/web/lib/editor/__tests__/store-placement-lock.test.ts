import { describe, expect, it, beforeEach } from "vitest";
import { useEditorStore } from "@/lib/editor/editor-store";
import { fixtureBasePlusOverlay } from "@/lib/editor/__fixtures__/projects";
import {
  selectionClips,
  selectedSceneIdFrom,
} from "@/lib/editor/model/editor-selection";
import { DEFAULT_VISUAL_POLICY } from "@/lib/editor/timeline-clips";

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
});
