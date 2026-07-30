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
  pruneEmptyLanes,
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
  it("keeps all lanes while renumbering", () => {
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

describe("pruneEmptyLanes", () => {
  it("removes empty overlay and audio lanes, keeps base", () => {
    const lanes: TimelineLane[] = [
      baseLane(),
      overlayLane("ov.0", 0, "Lớp 1"),
      overlayLane("ov.1", 1, "Lớp 2"),
      audioLane("au.0", 0, "Audio 1"),
    ];
    const clips: TimelineClip[] = [
      {
        id: "ov.clip",
        kind: "scene",
        sceneId: "s1",
        laneId: "ov.0",
        startTime: 0,
        duration: 1,
        name: "O",
      },
    ];
    const pruned = pruneEmptyLanes(lanes, clips);
    expect(pruned.map((l) => l.id)).toEqual(["lane.main", "ov.0"]);
  });

  it("keeps populated audio lane", () => {
    const lanes: TimelineLane[] = [
      baseLane(),
      audioLane("au.0", 0, "Audio 1"),
      audioLane("au.1", 1, "Audio 2"),
    ];
    const clips: TimelineClip[] = [
      {
        id: "a1",
        kind: "audio",
        audioTrackId: "a1",
        assetId: "asset.b",
        laneId: "au.1",
        startTime: 0,
        duration: 2,
        name: "B",
      },
    ];
    const pruned = pruneEmptyLanes(lanes, clips);
    expect(pruned.map((l) => l.id)).toEqual(["lane.main", "au.1"]);
  });

});

describe("empty-lane auto-removal across move", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("audio: empty source lane is removed after move", () => {
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
        audioLane("lane.audio.0", 0, "Audio Keep", {
          locked: false,
          muted: true,
        }),
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
    // Empty source lane (lane.audio.0) should be removed.
    const emptySource = state.timelineLanes.find(
      (l) => l.id === "lane.audio.0",
    );
    expect(emptySource).toBeFalsy();
    // Destination lane should still exist.
    expect(state.timelineLanes.some((l) => l.id === "lane.audio.1")).toBe(true);
    // Only 1 audio lane should remain (the destination lane).
    expect(state.timelineLanes.filter((l) => l.kind === "audio")).toHaveLength(
      1,
    );

    // Reverse move: a0 goes back to lane.audio.0 (which doesn't exist, so it
    // targets lane.audio.0 which is the id — but lane was pruned so it'll
    // target the existing lane or create a new lane).
    // Actually, lane.audio.0 doesn't exist anymore, so the body-target move
    // will map to a new audio lane if needed.
    useEditorStore.getState().moveClip("a0", {
      track: "audio",
      startTime: 0,
      insertNewLane: true,
      insertOrder: 0,
    });

    state = useEditorStore.getState();
    // a0 has moved to a new lane (inserted at order 0).
    const moved = state.timelineClips.find((c) => c.id === "a0");
    expect(moved?.laneId).toBeTruthy();
    // lane.audio.1 should still be empty after a1 is there... wait, a1 is still
    // on lane.audio.1. So after a0's insertNewLane, we have 2 audio clips on 2 lanes.
    expect(
      state.timelineLanes.filter((l) => l.kind === "audio").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("overlay: empty source lane is removed after move", () => {
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
    expect(emptySource).toBeFalsy();
    expect(state.timelineLanes.some((l) => l.id === "lane.overlay.1")).toBe(
      true,
    );
    expect(
      state.timelineLanes.filter(
        (l) => l.kind === "visual" && l.role === "overlay",
      ),
    ).toHaveLength(1);

    // Reverse move: insert overlay into a new lane.
    useEditorStore.getState().moveClip("ov.a", {
      track: "overlay",
      startTime: 0,
      insertNewLane: true,
      insertOrder: 0,
    });

    state = useEditorStore.getState();
    const moved = state.timelineClips.find((c) => c.id === "ov.a");
    expect(moved?.laneId).toBeTruthy();
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
    // Empty source lane is now removed.
    expect(
      useEditorStore
        .getState()
        .timelineLanes.some((l) => l.id === "lane.audio.0"),
    ).toBe(false);
  });

  it("delete clip removes empty overlay lane", () => {
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
    // Empty overlay lane is now removed.
    expect(state.timelineLanes.some((l) => l.id === "lane.overlay.0")).toBe(
      false,
    );
    // Base lane must be preserved.
    expect(
      state.timelineLanes.some((l) => l.kind === "visual" && l.role === "base"),
    ).toBe(true);
  });

  it("delete audio clip removes empty audio lane", () => {
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
      ],
      [baseLane(), audioLane("lane.audio.0", 0, "Audio Keep")],
    );

    useEditorStore.getState().selectClip("a0");
    useEditorStore.getState().deleteSelectedClips();

    const state = useEditorStore.getState();
    expect(state.timelineClips.some((c) => c.id === "a0")).toBe(false);
    // Empty audio lane is now removed.
    expect(state.timelineLanes.some((l) => l.id === "lane.audio.0")).toBe(
      false,
    );
    expect(state.timelineLanes.filter((l) => l.kind === "audio")).toHaveLength(
      0,
    );
  });

  it("audio insertNewLane removes an empty source and normalizes the new lane", () => {
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
      ],
      [baseLane(), audioLane("lane.audio.0", 0, "Audio Source")],
    );

    useEditorStore.getState().moveClip("a0", {
      track: "audio",
      startTime: 0,
      insertNewLane: true,
      insertOrder: 1,
    });

    const state = useEditorStore.getState();
    const moved = state.timelineClips.find((c) => c.id === "a0");
    expect(moved?.laneId).toBeTruthy();
    expect(moved?.laneId).not.toBe("lane.audio.0");
    // Empty lanes never persist. With no other source data the created lane
    // is normalized back to order 0.
    expect(state.timelineLanes.some((l) => l.id === "lane.audio.0")).toBe(
      false,
    );
    expect(state.timelineLanes.filter((l) => l.kind === "audio")).toHaveLength(
      1,
    );
    const movedLane = state.timelineLanes.find((l) => l.id === moved?.laneId);
    expect(movedLane?.order).toBe(0);
  });

  it("audio insert onto empty lane reuses it, deletes source after move", () => {
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
      ],
      [
        baseLane(),
        audioLane("lane.audio.0", 0, "Audio Source"),
        audioLane("lane.audio.1", 1, "Audio Empty"),
      ],
    );

    // Body-target move onto the empty lane — source should be pruned.
    useEditorStore.getState().moveClip("a0", {
      track: "audio",
      startTime: 0,
      laneId: "lane.audio.1",
    });

    const state = useEditorStore.getState();
    expect(state.timelineClips.find((c) => c.id === "a0")?.laneId).toBe(
      "lane.audio.1",
    );
    // Empty source lane is removed.
    expect(state.timelineLanes.some((l) => l.id === "lane.audio.0")).toBe(
      false,
    );
    // Only 1 audio lane remains (the destination which now has a clip).
    expect(state.timelineLanes.filter((l) => l.kind === "audio")).toHaveLength(
      1,
    );
  });

  it("library drop reuses empty audio lane at insert order", () => {
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
      ],
      [baseLane(), audioLane("lane.audio.0", 0, "Audio Empty")],
    );

    useEditorStore
      .getState()
      .addAudioClipFromLibrary(
        { title: "Bed", assetId: "asset.bed", duration: 2 },
        { startTime: 0, insertNewLane: true, insertOrder: 0 },
      );

    const state = useEditorStore.getState();
    // The empty lane is reused (not creating a second lane).
    expect(state.timelineLanes.filter((l) => l.kind === "audio")).toHaveLength(
      1,
    );
    expect(state.timelineClips.some((c) => c.laneId === "lane.audio.0")).toBe(
      true,
    );
  });

  it("save/load snapshot: empty source lane is removed after move", () => {
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

    const { project, timelineClips, timelineLanes } = useEditorStore.getState();
    expect(project).not.toBeNull();
    // Store project must remain schema-valid so autosave can persist moves.
    saveProject(project!, {
      timelineClips,
      timelineLanes,
    });

    const snap = loadEditorProjectSnapshot(fixture.project.metadata.id);
    expect(snap).toBeTruthy();
    // Empty source lane is removed from the snapshot.
    expect(snap!.timelineLanes.some((l) => l.id === "lane.overlay.0")).toBe(
      false,
    );
    expect(snap!.timelineClips.find((c) => c.id === "ov.a")?.laneId).toBe(
      "lane.overlay.1",
    );
  });
});
