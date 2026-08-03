import { describe, expect, it } from "vitest";
import {
  canUndo,
  resolvePropertyTargets,
  selectionClips,
} from "@motionvideo/editor-core";
import { buildBlankDesktopProject } from "../../../../shared/project-file/envelope";
import {
  createInitialTimelineSession,
  reduceTimelineSession,
  type TimelineSessionEvent,
  type TimelineSessionState,
} from "../../session/timeline-session";

function reduce(
  state: TimelineSessionState,
  event: TimelineSessionEvent,
): TimelineSessionState {
  return reduceTimelineSession(state, event).state;
}

describe("timeline session property bus", () => {
  it("executes property command, dirties session JSON, and undoes", () => {
    const blank = buildBlankDesktopProject({
      createId: (p) => `${p}_p8`,
    });
    let state = createInitialTimelineSession();
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
        duration: 3,
        nodes: [
          {
            id: "node_1",
            type: "text",
            parentId: null,
            transform: {
              x: 10,
              y: 20,
              width: 100,
              height: 40,
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              anchorX: 0,
              anchorY: 0,
              opacity: 1,
              visible: true,
              flipX: false,
              flipY: false,
            },
            payload: {
              text: "Hi",
              fontSize: 24,
              fontWeight: 600,
              align: "left",
            },
            style: { fill: "#111111" },
          },
        ],
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
        duration: 3,
        name: "Scene 1",
      },
    ];
    const documentJson = `${JSON.stringify(withScene, null, 2)}\n`;

    state = reduce(state, {
      type: "REPLACE_DOCUMENT",
      documentJson,
    });
    expect(state.project).not.toBeNull();
    expect(state.clips).toHaveLength(1);

    const selection = selectionClips(["clip_1"]);
    const targets = resolvePropertyTargets(
      selection,
      state.project,
      state.clips,
      state.lanes,
    );

    state = reduce(state, {
      type: "EXECUTE_PROPERTY_COMMAND",
      command: {
        type: "set-node-transform",
        targets,
        patch: { x: 77 },
      },
      label: "transform.x",
      coalesceKey: "scrub:transform.x:clips:clip_1",
      entryId: "e1",
      selection,
    });
    expect(state.project!.scenes[0]!.nodes[0]!.transform.x).toBe(77);
    expect(canUndo(state.history)).toBe(true);
    expect(state.sessionDocumentJson).toContain('"x": 77');

    state = reduce(state, {
      type: "EXECUTE_PROPERTY_COMMAND",
      command: {
        type: "set-node-transform",
        targets,
        patch: { x: 88 },
      },
      label: "transform.x",
      coalesceKey: "scrub:transform.x:clips:clip_1",
      entryId: "e2",
      selection,
    });
    expect(state.history.past).toHaveLength(1);

    state = reduce(state, { type: "UNDO" });
    expect(state.project!.scenes[0]!.nodes[0]!.transform.x).toBe(10);
  });
});
