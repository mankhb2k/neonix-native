import { beforeEach, describe, expect, it } from "vitest";
import { fixtureBasePlusOverlay } from "@/lib/editor/__fixtures__/projects";
import { useEditorStore } from "@/lib/editor/editor-store";
import {
  loadEditorProjectSnapshot,
  saveProject,
} from "@/lib/editor/project-storage";
import {
  DEFAULT_VISUAL_POLICY,
  normalizeLaneOrders,
  removeLaneExplicitly,
  type TimelineClip,
  type TimelineLane,
} from "@/lib/editor/timeline-clips";

function audioLane(
  id: string,
  order: number,
  name: string,
  flags?: { locked?: boolean; muted?: boolean },
): TimelineLane {
  return {
    id,
    kind: "audio",
    role: "audio",
    order,
    name,
    ...flags,
  };
}

function overlayLane(
  id: string,
  order: number,
  name: string,
  flags?: { locked?: boolean; visible?: boolean },
): TimelineLane {
  return {
    id,
    kind: "visual",
    role: "overlay",
    order,
    name,
    policy: { ...DEFAULT_VISUAL_POLICY },
    ...flags,
  };
}

function baseLane(): TimelineLane {
  return {
    id: "lane.main",
    kind: "visual",
    role: "base",
    order: -1,
    name: "Main",
    policy: { ...DEFAULT_VISUAL_POLICY },
  };
}

describe("normalizeLaneOrders / removeLaneExplicitly", () => {
  it("keeps empty overlay and audio lanes while renumbering", () => {
    const lanes: TimelineLane[] = [
      baseLane(),
      overlayLane("ov.0", 5, "Lớp 1"),
      overlayLane("ov.1", 9, "Lớp 2"),
      audioLane("au.0", 3, "Audio 1"),
      audioLane("au.1", 7, "Audio 2"),
    ];
    const next = normalizeLaneOrders(lanes);
    expect(next.map((l) => l.id)).toEqual([
      "lane.main",
      "ov.0",
      "ov.1",
      "au.0",
      "au.1",
    ]);
    expect(next.find((l) => l.id === "ov.1")?.order).toBe(1);
    expect(next.find((l) => l.id === "au.1")?.order).toBe(1);
  });

  it("blocks removing base or occupied lanes", () => {
    const lanes = [
      baseLane(),
      overlayLane("ov.0", 0, "Lớp 1"),
      audioLane("au.0", 0, "Audio 1"),
    ];
    const clips: TimelineClip[] = [
      {
        id: "c1",
        kind: "scene",
        sceneId: "scene.overlay",
        laneId: "ov.0",
        startTime: 0,
        duration: 1,
        name: "O",
      },
    ];
    expect(removeLaneExplicitly(lanes, clips, "lane.main")).toBe("blocked");
    expect(removeLaneExplicitly(lanes, clips, "ov.0")).toBe("blocked");
    const removed = removeLaneExplicitly(lanes, clips, "au.0");
    expect(removed).not.toBe("blocked");
    if (removed !== "blocked") {
      expect(removed.some((l) => l.id === "au.0")).toBe(false);
      expect(removed.some((l) => l.id === "ov.0")).toBe(true);
    }
  });
});

describe("empty-lane persistence across move", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("audio: empty source lane survives move and reverse move", () => {
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
          id: "a0",
          kind: "audio",
          audioTrackId: "a0",
          assetId: "asset.a",
          laneId: "lane.audio.0",
          startTime: 0,
          duration: 2,
          name: "A",
        },
        {
          id: "a1",
          kind: "audio",
          audioTrackId: "a1",
          assetId: "asset.b",
          laneId: "lane.audio.1",
          startTime: 3,
          duration: 2,
          name: "B",
        },
      ],
      [
        baseLane(),
        audioLane("lane.audio.0", 0, "Audio Keep", { locked: false, muted: true }),
        audioLane("lane.audio.1", 1, "Audio Dest"),
      ],
    );

    useEditorStore.getState().moveClip("a0", {
      track: "audio",
      startTime: 0,
      laneId: "lane.audio.1",
    });

    let state = useEditorStore.getState();
    expect(state.timelineClips.find((c) => c.id === "a0")?.laneId).toBe(
      "lane.audio.1",
    );
    const emptySource = state.timelineLanes.find((l) => l.id === "lane.audio.0");
    expect(emptySource).toBeTruthy();
    expect(emptySource?.name).toBe("Audio Keep");
    expect(emptySource?.muted).toBe(true);

    useEditorStore.getState().moveClip("a0", {
      track: "audio",
      startTime: 0,
      laneId: "lane.audio.0",
    });

    state = useEditorStore.getState();
    expect(state.timelineClips.find((c) => c.id === "a0")?.laneId).toBe(
      "lane.audio.0",
    );
    expect(state.timelineLanes.some((l) => l.id === "lane.audio.1")).toBe(true);
  });

  it("overlay: empty source lane survives move and reverse move", () => {
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
          id: "ov.a",
          kind: "scene",
          sceneId: "scene.overlay",
          laneId: "lane.overlay.0",
          startTime: 0,
          duration: 1,
          name: "A",
        },
        {
          id: "ov.b",
          kind: "scene",
          sceneId: "scene.overlay",
          laneId: "lane.overlay.1",
          startTime: 2,
          duration: 1,
          name: "B",
        },
      ],
      [
        baseLane(),
        overlayLane("lane.overlay.0", 0, "Lớp Keep", { visible: false }),
        overlayLane("lane.overlay.1", 1, "Lớp Dest"),
      ],
    );

    useEditorStore.getState().moveClip("ov.a", {
      track: "overlay",
      startTime: 0,
      laneId: "lane.overlay.1",
    });

    let state = useEditorStore.getState();
    expect(state.timelineClips.find((c) => c.id === "ov.a")?.laneId).toBe(
      "lane.overlay.1",
    );
    const emptySource = state.timelineLanes.find(
      (l) => l.id === "lane.overlay.0",
    );
    expect(emptySource).toBeTruthy();
    expect(emptySource?.name).toBe("Lớp Keep");
    expect(emptySource?.visible).toBe(false);

    useEditorStore.getState().moveClip("ov.a", {
      track: "overlay",
      startTime: 0,
      laneId: "lane.overlay.0",
    });

    state = useEditorStore.getState();
    expect(state.timelineClips.find((c) => c.id === "ov.a")?.laneId).toBe(
      "lane.overlay.0",
    );
    expect(state.timelineLanes.some((l) => l.id === "lane.overlay.1")).toBe(
      true,
    );
  });

  it("target collision keeps laneId and snaps startTime", () => {
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
          id: "a0",
          kind: "audio",
          audioTrackId: "a0",
          assetId: "asset.a",
          laneId: "lane.audio.0",
          startTime: 0,
          duration: 2,
          name: "A",
        },
        {
          id: "blocker",
          kind: "audio",
          audioTrackId: "blocker",
          assetId: "asset.b",
          laneId: "lane.audio.1",
          startTime: 0,
          duration: 3,
          name: "Blocker",
        },
      ],
      [
        baseLane(),
        audioLane("lane.audio.0", 0, "Audio 1"),
        audioLane("lane.audio.1", 1, "Audio 2"),
      ],
    );

    useEditorStore.getState().moveClip("a0", {
      track: "audio",
      startTime: 1,
      laneId: "lane.audio.1",
    });

    const moved = useEditorStore
      .getState()
      .timelineClips.find((c) => c.id === "a0");
    expect(moved?.laneId).toBe("lane.audio.1");
    expect(moved?.startTime).not.toBe(1);
    expect(
      moved!.startTime >= 3 || moved!.startTime + moved!.duration <= 0,
    ).toBe(true);
    expect(
      useEditorStore.getState().timelineLanes.some((l) => l.id === "lane.audio.0"),
    ).toBe(true);
  });

  it("delete clip keeps empty lane", () => {
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
          id: "ov.a",
          kind: "scene",
          sceneId: "scene.overlay",
          laneId: "lane.overlay.0",
          startTime: 0,
          duration: 1,
          name: "A",
        },
      ],
      [baseLane(), overlayLane("lane.overlay.0", 0, "Lớp 1")],
    );

    useEditorStore.getState().selectClip("ov.a");
    useEditorStore.getState().deleteSelectedClips();

    const state = useEditorStore.getState();
    expect(state.timelineClips.some((c) => c.id === "ov.a")).toBe(false);
    expect(state.timelineLanes.some((l) => l.id === "lane.overlay.0")).toBe(
      true,
    );
  });

  it("save/load snapshot keeps empty lanes after move", () => {
    const fixture = fixtureBasePlusOverlay();
    useEditorStore.getState().loadProject(
      fixture.project,
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
          id: "ov.a",
          kind: "scene",
          sceneId: "scene.overlay",
          laneId: "lane.overlay.0",
          startTime: 0,
          duration: 1,
          name: "A",
        },
        {
          id: "ov.b",
          kind: "scene",
          sceneId: "scene.overlay",
          laneId: "lane.overlay.1",
          startTime: 2,
          duration: 1,
          name: "B",
        },
      ],
      [
        baseLane(),
        overlayLane("lane.overlay.0", 0, "Lớp 1"),
        overlayLane("lane.overlay.1", 1, "Lớp 2"),
      ],
    );

    useEditorStore.getState().moveClip("ov.a", {
      track: "overlay",
      startTime: 0,
      laneId: "lane.overlay.1",
    });

    const { timelineClips, timelineLanes } = useEditorStore.getState();
    saveProject(fixture.project, {
      timelineClips,
      timelineLanes,
    });

    const snap = loadEditorProjectSnapshot(fixture.project.metadata.id);
    expect(snap).toBeTruthy();
    expect(snap!.timelineLanes.some((l) => l.id === "lane.overlay.0")).toBe(
      true,
    );
    expect(snap!.timelineClips.find((c) => c.id === "ov.a")?.laneId).toBe(
      "lane.overlay.1",
    );
  });
});
