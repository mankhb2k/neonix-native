import type {
  EditorClip,
  EditorDocument,
  EditorLane,
  EditorNode,
  EditorState,
} from "../model";
import {
  DEFAULT_EDITOR_VIEWPORT,
  EMPTY_EDITOR_SELECTION,
} from "../model";

const MAIN_LANE: EditorLane = {
  id: "lane.main",
  name: "Main",
  kind: "main",
  order: 0,
};

const OVERLAY_LANE: EditorLane = {
  id: "lane.overlay.0",
  name: "Overlay 1",
  kind: "overlay",
  order: 1,
};

function documentFrom(input: {
  id: string;
  title: string;
  duration: number;
  nodes?: readonly EditorNode[];
  lanes?: readonly EditorLane[];
  clips?: readonly EditorClip[];
}): EditorDocument {
  return {
    id: input.id,
    title: input.title,
    duration: input.duration,
    fps: 30,
    width: 1920,
    height: 1080,
    background: "#101827",
    nodes: input.nodes ?? [],
    lanes: input.lanes ?? [MAIN_LANE],
    clips: input.clips ?? [],
  };
}

export function createBlankEditorDocument(): EditorDocument {
  return documentFrom({
    id: "mock.blank",
    title: "Untitled mock project",
    duration: 10,
  });
}

export function createRectangleEditorDocument(): EditorDocument {
  const node: EditorNode = {
    id: "node.rectangle",
    kind: "shape",
    name: "Rectangle",
    bounds: { x: 560, y: 300, width: 800, height: 480 },
    fill: "#7C3AED",
  };
  const clip: EditorClip = {
    id: "clip.rectangle",
    kind: "visual",
    laneId: MAIN_LANE.id,
    nodeId: node.id,
    name: node.name,
    startTime: 0,
    duration: 5,
  };
  return documentFrom({
    id: "mock.rectangle",
    title: "Rectangle mock project",
    duration: 5,
    nodes: [node],
    clips: [clip],
  });
}

export function createOverlapEditorDocument(): EditorDocument {
  const backdrop: EditorNode = {
    id: "node.backdrop",
    kind: "shape",
    name: "Backdrop",
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    fill: "#1E293B",
  };
  const title: EditorNode = {
    id: "node.title",
    kind: "text",
    name: "Overlap title",
    bounds: { x: 200, y: 180, width: 1520, height: 180 },
    text: "Mock overlap",
    color: "#F8FAFC",
  };
  return documentFrom({
    id: "mock.overlap",
    title: "Overlap mock project",
    duration: 8,
    nodes: [backdrop, title],
    lanes: [MAIN_LANE, OVERLAY_LANE],
    clips: [
      {
        id: "clip.backdrop",
        kind: "visual",
        laneId: MAIN_LANE.id,
        nodeId: backdrop.id,
        name: backdrop.name,
        startTime: 0,
        duration: 8,
      },
      {
        id: "clip.title",
        kind: "visual",
        laneId: OVERLAY_LANE.id,
        nodeId: title.id,
        name: title.name,
        startTime: 1,
        duration: 5,
      },
    ],
  });
}

export function createLongTimelineEditorDocument(): EditorDocument {
  const nodes: EditorNode[] = [];
  const clips: EditorClip[] = [];
  for (let index = 0; index < 12; index += 1) {
    const id = `node.segment.${index + 1}`;
    nodes.push({
      id,
      kind: "shape",
      name: `Segment ${index + 1}`,
      bounds: { x: 280, y: 240, width: 1360, height: 600 },
      fill: index % 2 === 0 ? "#0284C7" : "#0F766E",
    });
    clips.push({
      id: `clip.segment.${index + 1}`,
      kind: "visual",
      laneId: MAIN_LANE.id,
      nodeId: id,
      name: `Segment ${index + 1}`,
      startTime: index * 4,
      duration: 4,
    });
  }
  return documentFrom({
    id: "mock.long-timeline",
    title: "Long timeline mock project",
    duration: 48,
    nodes,
    clips,
  });
}

export function createMockEditorState(document = createRectangleEditorDocument()): EditorState {
  return {
    document,
    selection: EMPTY_EDITOR_SELECTION,
    playheadTime: 0,
    viewport: DEFAULT_EDITOR_VIEWPORT,
    revision: 0,
  };
}
