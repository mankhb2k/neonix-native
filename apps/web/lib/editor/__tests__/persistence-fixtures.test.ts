import { beforeEach, describe, expect, it } from "vitest";
import {
  fixtureBasePlusOverlay,
  fixtureLegacyTrackLayerIndex,
  fixtureMainOnly,
  fixtureMainPlusAudioOverlap,
  fixtureMultiSceneReferences,
} from "@/lib/editor/__fixtures__/projects";
import {
  ensureAudioClipsFromTracks,
  migrateLanesAndClips,
} from "@/lib/editor/timeline-clips";
import {
  deleteProject,
  listProjects,
  loadProject,
  loadTimelineClips,
  saveProject,
} from "@/lib/editor/project-storage";

const STORAGE_KEY = "motionvideo.projects";
const EMPTY_TIMELINE_FLAG = "motionvideo.emptyTimeline.v1";

function seedFixture(
  fixture: ReturnType<typeof fixtureMainOnly>,
  options?: { setEmptyFlag?: boolean },
) {
  const record = {
    [fixture.project.metadata.id]: {
      savedAt: new Date().toISOString(),
      project: fixture.project,
      overlayScenes: fixture.overlayScenes,
      timelineClips: fixture.clips,
      timelineLanes: fixture.lanes,
    },
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  if (options?.setEmptyFlag) {
    window.localStorage.setItem(EMPTY_TIMELINE_FLAG, "1");
  } else {
    window.localStorage.removeItem(EMPTY_TIMELINE_FLAG);
  }
}

describe("editor persistence fixtures", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("builds all regression fixtures without schema errors", () => {
    expect(fixtureMainOnly().project.scenes).toHaveLength(2);
    expect(fixtureBasePlusOverlay().clips).toHaveLength(2);
    expect(fixtureMainPlusAudioOverlap().project.timeline.audioTracks).toHaveLength(3);
    expect(fixtureLegacyTrackLayerIndex().clips.every((c) => !c.laneId)).toBe(true);
    expect(fixtureMultiSceneReferences().project.scenes).toHaveLength(2);
  });

  it("DATA-01: load path currently mutates storage when empty-timeline flag is missing", () => {
    // Characterization: bug hiện tại — đọc storage có side effect phá hủy main timeline.
    // Phase 1 sẽ đổi kỳ vọng thành: load không ghi lại localStorage.
    const fixture = fixtureMainOnly();
    seedFixture(fixture, { setEmptyFlag: false });
    const before = window.localStorage.getItem(STORAGE_KEY);

    const loaded = loadProject(fixture.project.metadata.id);

    const after = window.localStorage.getItem(STORAGE_KEY);
    expect(loaded).not.toBeNull();
    // Bug hiện tại: scenes bị xóa sau lần load đầu.
    expect(loaded!.scenes).toHaveLength(0);
    expect(after).not.toBe(before);
    expect(window.localStorage.getItem(EMPTY_TIMELINE_FLAG)).toBe("1");
  });

  it("save → load roundtrip keeps document when empty-timeline flag already applied", () => {
    const fixture = fixtureBasePlusOverlay();
    seedFixture(fixture, { setEmptyFlag: true });

    saveProject(fixture.project, {
      overlayScenes: fixture.overlayScenes,
      timelineClips: fixture.clips,
      timelineLanes: fixture.lanes,
    });

    const loaded = loadProject(fixture.project.metadata.id);
    const clips = loadTimelineClips(fixture.project.metadata.id);
    expect(loaded?.scenes.map((s) => s.id)).toEqual(["scene.base", "scene.overlay"]);
    expect(clips).toHaveLength(2);
  });

  it("corrupt record does not hide other valid projects", () => {
    const good = fixtureMainOnly();
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        bad: { savedAt: "x", project: { not: "a project" } },
        [good.project.metadata.id]: {
          savedAt: new Date().toISOString(),
          project: good.project,
          timelineClips: good.clips,
          timelineLanes: good.lanes,
          overlayScenes: [],
        },
      }),
    );
    window.localStorage.setItem(EMPTY_TIMELINE_FLAG, "1");

    const listed = listProjects();
    expect(listed.map((p) => p.project.metadata.id)).toEqual([good.project.metadata.id]);
  });

  it("deleteProject removes only the target id", () => {
    const a = fixtureMainOnly();
    const b = fixtureBasePlusOverlay();
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [a.project.metadata.id]: {
          savedAt: "2026-01-01T00:00:00.000Z",
          project: a.project,
          timelineClips: a.clips,
          timelineLanes: a.lanes,
          overlayScenes: [],
        },
        [b.project.metadata.id]: {
          savedAt: "2026-01-02T00:00:00.000Z",
          project: b.project,
          timelineClips: b.clips,
          timelineLanes: b.lanes,
          overlayScenes: b.overlayScenes,
        },
      }),
    );
    window.localStorage.setItem(EMPTY_TIMELINE_FLAG, "1");

    deleteProject(a.project.metadata.id);
    expect(listProjects().map((p) => p.project.metadata.id)).toEqual([
      b.project.metadata.id,
    ]);
  });
});

describe("timeline migration fixtures", () => {
  it("migrates legacy track/layerIndex into lanes", () => {
    const fixture = fixtureLegacyTrackLayerIndex();
    const { lanes, clips } = migrateLanesAndClips(
      fixture.project,
      fixture.overlayScenes,
      fixture.clips,
      fixture.lanes,
    );
    expect(lanes.some((l) => l.kind === "main")).toBe(true);
    expect(lanes.some((l) => l.kind === "overlay")).toBe(true);
    expect(clips.every((c) => Boolean(c.laneId))).toBe(true);
  });

  it("MODEL-03: overlapping audio tracks currently collapse onto one audio lane", () => {
    // Characterization: bug hiện tại — mọi missing track vào cùng một lane.
    // Phase 5 sẽ tách lane khi overlap.
    const fixture = fixtureMainPlusAudioOverlap();
    const { lanes, clips } = ensureAudioClipsFromTracks(
      fixture.project,
      fixture.lanes,
      fixture.clips,
    );
    const audioLanes = lanes.filter((l) => l.kind === "audio");
    const audioClips = clips.filter((c) => audioLanes.some((l) => l.id === c.laneId));
    expect(audioClips).toHaveLength(3);
    expect(audioLanes).toHaveLength(1);
  });
});
