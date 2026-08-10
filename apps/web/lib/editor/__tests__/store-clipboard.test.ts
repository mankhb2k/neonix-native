import { beforeEach, describe, expect, it } from "vitest";
import { fixtureBasePlusOverlay } from "@/lib/editor/__fixtures__/projects";
import { useEditorStore } from "@/lib/editor/editor-store";
import { DEFAULT_VISUAL_POLICY } from "@motionvideo/editor-core";

describe("editor-store clipboard", () => {
  beforeEach(() => {
    const { project, clips, lanes } = fixtureBasePlusOverlay();
    useEditorStore.getState().loadProject(project, [], clips, lanes);
  });

  it("paste overlay keeps scene + lane invariants", () => {
    const store = useEditorStore.getState();
    store.selectClip("clip.overlay");
    store.copySelectedClips();
    store.pasteClips(3);
    const overlays = useEditorStore
      .getState()
      .timelineClips.filter((c) => c.kind === "scene" && c.laneId !== "lane.main");
    expect(overlays.length).toBeGreaterThanOrEqual(2);
    const sceneIds = new Set(
      useEditorStore.getState().project!.scenes.map((s) => s.id),
    );
    for (const clip of overlays) {
      if (clip.kind === "scene") expect(sceneIds.has(clip.sceneId)).toBe(true);
    }
  });

  it("duplicate base and overlay create new clips", () => {
    const before = useEditorStore.getState().timelineClips.length;
    useEditorStore.getState().selectClip("clip.base");
    useEditorStore.getState().duplicateSelectedClips();
    useEditorStore.getState().selectClip("clip.overlay");
    useEditorStore.getState().duplicateSelectedClips();
    expect(useEditorStore.getState().timelineClips.length).toBeGreaterThan(
      before,
    );
  });

  it("split base and overlay at midpoints", () => {
    useEditorStore.getState().selectClip("clip.base");
    useEditorStore.getState().splitSelectedClipsAt(2);
    const main = useEditorStore
      .getState()
      .timelineClips.filter((c) => c.laneId === "lane.main");
    expect(main.length).toBe(2);

    useEditorStore.getState().setSelectedClipIds(
      useEditorStore
        .getState()
        .timelineClips.filter((c) => c.id.startsWith("clip.overlay") || c.laneId === "lane.overlay.0")
        .map((c) => c.id)
        .slice(0, 1),
    );
    const ov = useEditorStore
      .getState()
      .timelineClips.find((c) => c.laneId === "lane.overlay.0");
    if (ov) {
      useEditorStore.getState().selectClip(ov.id);
      useEditorStore
        .getState()
        .splitSelectedClipsAt(ov.startTime + ov.duration / 2);
      expect(
        useEditorStore
          .getState()
          .timelineClips.filter((c) => c.laneId === "lane.overlay.0").length,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it("duplicate on locked lane is no-op", () => {
    const locked = useEditorStore.getState().timelineLanes.map((lane) =>
      lane.id === "lane.main"
        ? { ...lane, locked: true, policy: { ...DEFAULT_VISUAL_POLICY } }
        : lane,
    );
    useEditorStore.setState({ timelineLanes: locked });
    const before = useEditorStore.getState().timelineClips.length;
    useEditorStore.getState().selectClip("clip.base");
    useEditorStore.getState().duplicateSelectedClips();
    expect(useEditorStore.getState().timelineClips.length).toBe(before);
  });

  it("split on locked lane is no-op", () => {
    const locked = useEditorStore.getState().timelineLanes.map((lane) =>
      lane.id === "lane.main" ? { ...lane, locked: true } : lane,
    );
    useEditorStore.setState({ timelineLanes: locked });
    useEditorStore.getState().selectClip("clip.base");
    useEditorStore.getState().splitSelectedClipsAt(2);
    expect(
      useEditorStore
        .getState()
        .timelineClips.filter((c) => c.laneId === "lane.main").length,
    ).toBe(1);
  });
});
