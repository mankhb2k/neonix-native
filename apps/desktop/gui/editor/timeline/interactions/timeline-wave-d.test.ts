import { describe, expect, it } from "vitest";
import { canUndo, selectionClips, selectionNone } from "@motionvideo/editor-core";
import { buildBlankDesktopProject } from "../../../../shared/project-file/envelope";
import {
  createInitialTimelineSession,
  reduceTimelineSession,
  type TimelineSessionEvent,
  type TimelineSessionState,
} from "../../session/timeline-session";
import {
  PointerSessionController,
  resetActivePointerSessionToken,
} from "@motionvideo/editor-interactions";
import { shouldCommitPointerSession } from "@motionvideo/editor-interactions";

function reduce(
  state: TimelineSessionState,
  event: TimelineSessionEvent,
): TimelineSessionState {
  return reduceTimelineSession(state, event).state;
}

function documentWithClip(): string {
  const blank = buildBlankDesktopProject({ createId: (p) => `${p}_waved` });
  const withScene = JSON.parse(blank.documentJson) as {
    project: {
      scenes: unknown[];
      timeline: { sceneOrder: string[] };
    };
    timelineClips: unknown[];
    timelineLanes: unknown[];
  };
  withScene.project.scenes = [
    {
      id: "scene_1",
      duration: 4,
      nodes: [],
      clips: [],
    },
  ];
  withScene.project.timeline.sceneOrder = ["scene_1"];
  withScene.timelineLanes = [
    {
      id: "lane.main",
      kind: "visual",
      role: "base",
      name: "Main",
      order: -1,
      policy: { allowOverlap: false },
    },
  ];
  withScene.timelineClips = [
    {
      kind: "scene",
      id: "clip_1",
      sceneId: "scene_1",
      laneId: "lane.main",
      startTime: 0,
      duration: 4,
      name: "Scene 1",
    },
  ];
  return `${JSON.stringify(withScene, null, 2)}\n`;
}

describe("timeline session command bus (Wave D)", () => {
  it("moves clip via EXECUTE_TIMELINE_COMMAND and undoes", () => {
    let state = createInitialTimelineSession();
    state = reduce(state, {
      type: "REPLACE_DOCUMENT",
      documentJson: documentWithClip(),
    });
    expect(state.clips[0]?.startTime).toBe(0);

    state = reduce(state, {
      type: "EXECUTE_TIMELINE_COMMAND",
      entryId: "tl_1",
      label: "Move clip",
      command: {
        type: "move-clip",
        clipId: "clip_1",
        patch: { startTime: 1.5, track: "main", laneId: "lane.main" },
      },
      selection: selectionNone(),
      clipboard: [],
    });
    expect(state.clips[0]?.startTime).toBe(1.5);
    expect(canUndo(state.history)).toBe(true);

    state = reduce(state, { type: "UNDO" });
    expect(state.clips[0]?.startTime).toBe(0);
  });

  it("splits selected clip at playhead time", () => {
    let state = createInitialTimelineSession();
    state = reduce(state, {
      type: "REPLACE_DOCUMENT",
      documentJson: documentWithClip(),
    });
    state = reduce(state, {
      type: "EXECUTE_TIMELINE_COMMAND",
      entryId: "tl_split",
      command: { type: "split-selected-clips", time: 2 },
      selection: selectionClips(["clip_1"]),
      clipboard: [],
    });
    expect(state.clips.length).toBe(2);
    expect(state.loadError).toBeNull();
  });
});

describe("pointer session contract", () => {
  it("commits only on pointerup", () => {
    expect(shouldCommitPointerSession("pointerup")).toBe(true);
    expect(shouldCommitPointerSession("pointercancel")).toBe(false);
    expect(shouldCommitPointerSession("escape")).toBe(false);
  });

  it("allows only one active session", () => {
    resetActivePointerSessionToken();
    const a = new PointerSessionController({ name: "a", onStart: () => ({}) });
    const b = new PointerSessionController({ name: "b", onStart: () => ({}) });
    expect(a.start({ x: 0, y: 0 })).toBe(true);
    expect(b.start({ x: 1, y: 1 })).toBe(false);
    a.cancel();
    expect(b.start({ x: 1, y: 1 })).toBe(true);
    b.cancel();
  });
});
