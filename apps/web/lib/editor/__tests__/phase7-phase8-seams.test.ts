import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  fixtureMainOnly,
  fixtureMainPlusAudioOverlap,
} from "@/lib/editor/__fixtures__/projects";
import {
  ensureAudioClipsFromTracks,
} from "@/lib/editor/timeline-clips";
import { createEditorStore } from "@/lib/editor/store/create-editor-store";
import {
  assertNever,
  clipCapabilities,
  defaultSnappingPolicy,
  executeTimelineCommand,
  setSnappingPolicy,
  validateTimelineDocument,
  type SnappingPolicy,
  type TimelineClip,
  type TimelineCommand,
  type TimelineDocument,
} from "@/lib/editor/timeline";
import {
  resolveVisualPlacement,
} from "@/lib/editor/operations/clip-move";
import {
  loadEditorProjectSnapshot,
  saveProject,
  trySaveProject,
} from "@/lib/editor/project-storage";
import {
  PROJECT_INDEX_KEY,
  projectStorageKey,
} from "@/lib/editor/persistence/storage-adapter";

describe("Phase 8 Spike A — multi-store history isolation", () => {
  it("keeps history stacks isolated across createEditorStore instances", () => {
    const store1 = createEditorStore();
    const store2 = createEditorStore();
    const { project, clips, lanes, overlayScenes } = fixtureMainOnly();
    store1.getState().loadProject(project, overlayScenes, clips, lanes);
    store2.getState().loadProject(project, overlayScenes, clips, lanes);

    store1.getState().executeTimelineCommand({
      type: "update-scene-duration",
      sceneId: "scene.main.a",
      duration: 9,
    });

    expect(store1.getState().canUndo).toBe(true);
    expect(store2.getState().canUndo).toBe(false);

    store1.getState().undo();
    expect(
      store1.getState().project?.scenes.find((s) => s.id === "scene.main.a")
        ?.duration,
    ).toBe(project.scenes.find((s) => s.id === "scene.main.a")?.duration);
    expect(store2.getState().canUndo).toBe(false);
  });
});

describe("Phase 8 Spike B — clip/trim + unknown command", () => {
  it("rejects unknown commands instead of silent no-op", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };
    const result = executeTimelineCommand(doc, {
      type: "not-a-real-command",
    } as unknown as TimelineCommand);
    expect(result.status).toBe("rejected");
    if (result.status === "rejected") {
      expect(result.reason).toBe("unknown_command");
    }
  });

  it("trims audio duration/trimStart and restores via undo/redo", () => {
    const fixture = fixtureMainPlusAudioOverlap();
    const { lanes, clips } = ensureAudioClipsFromTracks(
      fixture.project,
      fixture.lanes,
      fixture.clips,
    );
    const store = createEditorStore();
    store.getState().loadProject(fixture.project, [], clips, lanes);

    const audioClip = store
      .getState()
      .timelineClips.find((c) => c.kind === "audio" && c.audioTrackId === "audio.a");
    expect(audioClip).toBeTruthy();
    const beforeDur = audioClip!.duration;
    const beforeTrim =
      store
        .getState()
        .project?.timeline.audioTracks.find((t) => t.id === "audio.a")
        ?.trimStart ?? 0;

    const applied = store.getState().executeTimelineCommand({
      type: "clip/trim",
      clipId: audioClip!.id,
      duration: Math.max(0.5, beforeDur - 1),
      trimStart: beforeTrim + 0.5,
    });
    expect(applied.status).toBe("applied");

    const mid = store.getState();
    expect(
      mid.timelineClips.find((c) => c.id === audioClip!.id)?.duration,
    ).toBeCloseTo(Math.max(0.5, beforeDur - 1), 5);
    expect(
      mid.project?.timeline.audioTracks.find((t) => t.id === "audio.a")
        ?.trimStart,
    ).toBeCloseTo(beforeTrim + 0.5, 5);

    store.getState().undo();
    expect(
      store.getState().timelineClips.find((c) => c.id === audioClip!.id)
        ?.duration,
    ).toBeCloseTo(beforeDur, 5);
    expect(
      store
        .getState()
        .project?.timeline.audioTracks.find((t) => t.id === "audio.a")
        ?.trimStart ?? 0,
    ).toBeCloseTo(beforeTrim, 5);

    store.getState().redo();
    expect(
      store.getState().timelineClips.find((c) => c.id === audioClip!.id)
        ?.duration,
    ).toBeCloseTo(Math.max(0.5, beforeDur - 1), 5);
  });
});

describe("Phase 8 Spike C — injectable snappingPolicy", () => {
  afterEach(() => {
    setSnappingPolicy(defaultSnappingPolicy);
  });

  it("uses injected policy for visual placement", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    void project;
    const fake: SnappingPolicy = {
      resolveLaneStartTime: () => 42,
      findNearestSnapTime: (t) => ({ time: t, snapped: false }),
    };
    const result = resolveVisualPlacement(
      lanes,
      clips,
      { type: "base", startTime: 1, duration: 2 },
      undefined,
      fake,
    );
    expect(result.status).toBe("placed");
    if (result.status === "placed") {
      expect(result.startTime).toBe(42);
    }
  });

  it("honors setSnappingPolicy process default", () => {
    setSnappingPolicy({
      resolveLaneStartTime: () => 7,
      findNearestSnapTime: (t) => ({ time: t, snapped: false }),
    });
    const { clips, lanes } = fixtureMainOnly();
    const result = resolveVisualPlacement(lanes, clips, {
      type: "base",
      startTime: 0,
      duration: 1,
    });
    expect(result.status).toBe("placed");
    if (result.status === "placed") {
      expect(result.startTime).toBe(7);
    }
  });
});

describe("Phase 8 Spike D — exhaustive clip capability", () => {
  it("maps scene and audio capabilities", () => {
    const { clips } = fixtureMainOnly();
    const scene = clips.find((c) => c.kind === "scene")!;
    expect(clipCapabilities(scene).supportsTrimStart).toBe(false);
  });

  it("assertNever throws for experimental kind at runtime", () => {
    const experimental = {
      kind: "caption",
      id: "x",
      laneId: "l",
      startTime: 0,
      duration: 1,
      name: "cap",
    } as unknown as TimelineClip;
    expect(() => clipCapabilities(experimental)).toThrow(/unsupported clip kind/);
    expect(() => assertNever(experimental as never)).toThrow();
  });
});

describe("Phase 8 Spike E — transition metadata", () => {
  it("adds transition via command stub and validates dangling refs", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const doc: TimelineDocument = { project, clips, lanes };
    const a = clips[0]!;
    const b = clips[1]!;

    const applied = executeTimelineCommand(doc, {
      type: "transition/add",
      id: "tr.1",
      fromClipId: a.id,
      toClipId: b.id,
      kind: "crossfade",
    });
    expect(applied.status).toBe("applied");
    if (applied.status === "applied") {
      expect(applied.document.transitions).toEqual([
        {
          id: "tr.1",
          fromClipId: a.id,
          toClipId: b.id,
          kind: "crossfade",
        },
      ]);
      expect(validateTimelineDocument(applied.document).valid).toBe(true);
    }

    const dangling: TimelineDocument = {
      project,
      clips,
      lanes,
      transitions: [
        {
          id: "tr.bad",
          fromClipId: a.id,
          toClipId: "missing",
        },
      ],
    };
    const v = validateTimelineDocument(dangling);
    expect(v.valid).toBe(false);
  });
});

describe("P7 dirty revision + close-save smoke", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("bumps dirtyRevision on command and clears via markDocumentSaved", () => {
    const store = createEditorStore();
    const { project, clips, lanes, overlayScenes } = fixtureMainOnly();
    store.getState().loadProject(project, overlayScenes, clips, lanes);
    expect(store.getState().dirtyRevision).toBe(0);
    expect(store.getState().savedRevision).toBe(0);

    store.getState().executeTimelineCommand({
      type: "update-scene-duration",
      sceneId: "scene.main.a",
      duration: 11,
    });
    expect(store.getState().dirtyRevision).toBe(1);
    expect(store.getState().dirtyRevision).not.toBe(
      store.getState().savedRevision,
    );

    const result = trySaveProject(store.getState().project!, {
      timelineClips: store.getState().timelineClips,
      timelineLanes: store.getState().timelineLanes,
    });
    expect(result.ok).toBe(true);
    store.getState().markDocumentSaved();
    expect(store.getState().dirtyRevision).toBe(
      store.getState().savedRevision,
    );
  });

  it("flush-on-close path keeps last committed command after reload", () => {
    const store = createEditorStore();
    const { project, clips, lanes, overlayScenes } = fixtureMainOnly();
    store.getState().loadProject(project, overlayScenes, clips, lanes);

    store.getState().executeTimelineCommand({
      type: "update-scene-duration",
      sceneId: "scene.main.a",
      duration: 12.5,
    });

    // Simulate DesktopEditorShell close handshake flush.
    const state = store.getState();
    expect(state.dirtyRevision).not.toBe(state.savedRevision);
    const saved = trySaveProject(state.project!, {
      timelineClips: state.timelineClips,
      timelineLanes: state.timelineLanes,
    });
    expect(saved.ok).toBe(true);
    state.markDocumentSaved();

    const reloaded = loadEditorProjectSnapshot(project.metadata.id);
    expect(reloaded?.project.scenes.find((s) => s.id === "scene.main.a")?.duration).toBe(
      12.5,
    );
  });

  it("saves to per-project key without rewriting whole collection blob", () => {
    const a = fixtureMainOnly();
    saveProject(a.project, {
      timelineClips: a.clips,
      timelineLanes: a.lanes,
    });
    expect(window.localStorage.getItem(projectStorageKey(a.project.metadata.id))).toBeTruthy();
    expect(window.localStorage.getItem(PROJECT_INDEX_KEY)).toContain(
      a.project.metadata.id,
    );
    // Legacy whole-collection key should not be the write target for new saves.
    expect(window.localStorage.getItem("motionvideo.projects")).toBeNull();
  });
});
