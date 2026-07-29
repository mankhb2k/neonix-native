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
  CURRENT_STORAGE_VERSION,
  deleteProject,
  listProjects,
  loadEditorProjectSnapshot,
  loadProject,
  loadTimelineClips,
  migrateStoredProject,
  overlaysFromClips,
  saveProject,
} from "@/lib/editor/project-storage";

const STORAGE_KEY = "motionvideo.projects";

function seedFixture(fixture: ReturnType<typeof fixtureMainOnly>) {
  const record = {
    [fixture.project.metadata.id]: {
      storageVersion: CURRENT_STORAGE_VERSION,
      savedAt: new Date().toISOString(),
      project: fixture.project,
      overlayScenes: fixture.overlayScenes,
      timelineClips: fixture.clips,
      timelineLanes: fixture.lanes,
    },
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
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

  it("DATA-01: load path does not mutate localStorage", () => {
    const fixture = fixtureMainOnly();
    // Seed legacy record không có storageVersion và không có empty-timeline flag.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        [fixture.project.metadata.id]: {
          savedAt: new Date().toISOString(),
          project: fixture.project,
          overlayScenes: fixture.overlayScenes,
          timelineClips: fixture.clips,
          timelineLanes: fixture.lanes,
        },
      }),
    );
    const before = window.localStorage.getItem(STORAGE_KEY);

    const loaded = loadProject(fixture.project.metadata.id);

    const after = window.localStorage.getItem(STORAGE_KEY);
    expect(loaded).not.toBeNull();
    expect(loaded!.scenes).toHaveLength(2);
    expect(after).toBe(before);
  });

  it("save → load roundtrip keeps document", () => {
    const fixture = fixtureBasePlusOverlay();
    seedFixture(fixture);

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

  it("loadEditorProjectSnapshot reads project + clips + lanes once", () => {
    const fixture = fixtureBasePlusOverlay();
    seedFixture(fixture);
    const snap = loadEditorProjectSnapshot(fixture.project.metadata.id);
    expect(snap?.project.metadata.id).toBe(fixture.project.metadata.id);
    expect(snap?.timelineClips).toHaveLength(2);
    expect(snap?.timelineLanes.some((l) => l.kind === "main")).toBe(true);
    expect(snap?.overlayScenes.every((o) => o.id === "clip.overlay")).toBe(true);
  });

  it("migrateStoredProject is idempotent", () => {
    const fixture = fixtureLegacyTrackLayerIndex();
    const once = migrateStoredProject({
      storageVersion: 0,
      savedAt: "2026-01-01T00:00:00.000Z",
      project: fixture.project,
      overlayScenes: fixture.overlayScenes,
      timelineClips: fixture.clips,
      timelineLanes: fixture.lanes,
    });
    const twice = migrateStoredProject(once);
    expect(twice).toEqual(once);
    expect(twice.storageVersion).toBe(CURRENT_STORAGE_VERSION);
  });

  it("DATA-03: overlaysFromClips ignores audio lanes", () => {
    const lanes = [
      { id: "lane.main", kind: "main" as const, name: "Main", order: -1 },
      { id: "lane.ov", kind: "overlay" as const, name: "Lớp 1", order: 0 },
      { id: "lane.au", kind: "audio" as const, name: "Audio 1", order: 0 },
    ];
    const clips = [
      {
        id: "c1",
        sceneId: "s1",
        laneId: "lane.ov",
        startTime: 0,
        duration: 1,
        name: "Ov",
      },
      {
        id: "audio.x",
        sceneId: "audio.x",
        laneId: "lane.au",
        startTime: 0,
        duration: 2,
        name: "Au",
      },
    ];
    const overlays = overlaysFromClips(clips, lanes);
    expect(overlays.map((o) => o.id)).toEqual(["c1"]);
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
