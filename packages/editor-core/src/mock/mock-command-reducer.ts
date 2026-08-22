import type {
  EditorClip,
  EditorCommand,
  EditorCommandResult,
  EditorDocument,
  EditorLane,
  EditorNode,
  EditorState,
} from "../model";

function applied(state: EditorState, command: EditorCommand): EditorCommandResult {
  return { status: "applied", state: { ...state, revision: state.revision + 1 }, command };
}

function rejected(state: EditorState, command: EditorCommand, reason: string): EditorCommandResult {
  return { status: "rejected", state, command, reason };
}

function replaceDocument(state: EditorState, document: EditorDocument): EditorState {
  return { ...state, document };
}

function isLaneCompatible(clip: EditorClip, lane: EditorLane): boolean {
  return clip.kind === "audio" ? lane.kind === "audio" : lane.kind !== "audio";
}

function documentWithNodeMoved(document: EditorDocument, nodeId: string, x: number, y: number): EditorDocument {
  return {
    ...document,
    nodes: document.nodes.map((node): EditorNode =>
      node.id === nodeId ? { ...node, bounds: { ...node.bounds, x, y } } : node,
    ),
  };
}

/** Deterministic mock reducer. It never mutates the input state or calls a host. */
export function applyMockEditorCommand(
  state: EditorState,
  command: EditorCommand,
): EditorCommandResult {
  switch (command.type) {
    case "document/rename": {
      const title = command.title.trim();
      if (!title) return rejected(state, command, "A document title is required");
      return applied(replaceDocument(state, { ...state.document, title }), command);
    }
    case "selection/set":
      return applied({ ...state, selection: command.selection }, command);
    case "playback/seek":
      return applied(
        {
          ...state,
          playheadTime: Math.min(Math.max(0, command.time), state.document.duration),
        },
        command,
      );
    case "timeline/move-clip": {
      const clip = state.document.clips.find((item) => item.id === command.clipId);
      const lane = state.document.lanes.find((item) => item.id === command.laneId);
      if (!clip) return rejected(state, command, `Unknown clip: ${command.clipId}`);
      if (!lane) return rejected(state, command, `Unknown lane: ${command.laneId}`);
      if (lane.locked) return rejected(state, command, `Lane is locked: ${lane.id}`);
      if (!isLaneCompatible(clip, lane)) return rejected(state, command, "Clip and lane kinds are incompatible");
      const startTime = Math.max(0, command.startTime);
      const clips = state.document.clips.map((item) =>
        item.id === clip.id ? { ...item, laneId: lane.id, startTime } : item,
      );
      const duration = Math.max(
        state.document.duration,
        ...clips.map((item) => item.startTime + item.duration),
      );
      return applied(replaceDocument(state, { ...state.document, clips, duration }), command);
    }
    case "timeline/trim-clip": {
      if (!(command.duration > 0)) return rejected(state, command, "Clip duration must be positive");
      const found = state.document.clips.some((clip) => clip.id === command.clipId);
      if (!found) return rejected(state, command, `Unknown clip: ${command.clipId}`);
      const clips = state.document.clips.map((clip) =>
        clip.id === command.clipId ? { ...clip, duration: command.duration } : clip,
      );
      const duration = Math.max(...clips.map((clip) => clip.startTime + clip.duration), 0);
      return applied(replaceDocument(state, { ...state.document, clips, duration }), command);
    }
    case "node/move": {
      const found = state.document.nodes.some((node) => node.id === command.nodeId);
      if (!found) return rejected(state, command, `Unknown node: ${command.nodeId}`);
      return applied(
        replaceDocument(
          state,
          documentWithNodeMoved(state.document, command.nodeId, command.x, command.y),
        ),
        command,
      );
    }
    case "node/add": {
      if (state.document.nodes.some((node) => node.id === command.node.id)) {
        return rejected(state, command, `Duplicate node: ${command.node.id}`);
      }
      return applied(
        replaceDocument(state, {
          ...state.document,
          nodes: [...state.document.nodes, command.node],
        }),
        command,
      );
    }
    case "export/request":
      return {
        status: "unsupported",
        state,
        command,
        reason: "Export is not implemented in mock mode",
      };
  }
}
