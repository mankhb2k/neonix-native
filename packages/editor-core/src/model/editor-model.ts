/**
 * Render-stack-independent editor data. These types describe authoring intent
 * for the mock editor; they intentionally do not mirror Protocol or Runtime.
 */
export type EditorBounds = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}>;

export type EditorShapeNode = Readonly<{
  id: string;
  kind: "shape";
  name: string;
  bounds: EditorBounds;
  fill: string;
}>;

export type EditorTextNode = Readonly<{
  id: string;
  kind: "text";
  name: string;
  bounds: EditorBounds;
  text: string;
  color: string;
}>;

export type EditorImageNode = Readonly<{
  id: string;
  kind: "image";
  name: string;
  bounds: EditorBounds;
  assetId: string;
}>;

export type EditorNode = EditorShapeNode | EditorTextNode | EditorImageNode;

export type EditorLaneKind = "main" | "overlay" | "audio";

export type EditorLane = Readonly<{
  id: string;
  name: string;
  kind: EditorLaneKind;
  order: number;
  locked?: boolean;
}>;

export type EditorVisualClip = Readonly<{
  id: string;
  kind: "visual";
  laneId: string;
  nodeId: string;
  name: string;
  startTime: number;
  duration: number;
}>;

export type EditorAudioClip = Readonly<{
  id: string;
  kind: "audio";
  laneId: string;
  assetId: string;
  name: string;
  startTime: number;
  duration: number;
}>;

export type EditorClip = EditorVisualClip | EditorAudioClip;

export type EditorDocument = Readonly<{
  id: string;
  title: string;
  duration: number;
  fps: number;
  width: number;
  height: number;
  background: string;
  nodes: readonly EditorNode[];
  lanes: readonly EditorLane[];
  clips: readonly EditorClip[];
}>;

export type EditorSelection =
  | Readonly<{ kind: "none" }>
  | Readonly<{ kind: "node"; nodeId: string }>
  | Readonly<{ kind: "clips"; clipIds: readonly string[] }>;

export type EditorViewportState = Readonly<{
  zoom: number;
  scrollLeft: number;
  scrollTop: number;
}>;

export type EditorState = Readonly<{
  document: EditorDocument;
  selection: EditorSelection;
  playheadTime: number;
  viewport: EditorViewportState;
  revision: number;
}>;

export type EditorExportRequest = Readonly<{
  format: "mp4" | "webm" | "json";
  range?: Readonly<{ startTime: number; endTime: number }>;
}>;

export type EditorCommand =
  | Readonly<{ type: "document/rename"; title: string }>
  | Readonly<{ type: "selection/set"; selection: EditorSelection }>
  | Readonly<{ type: "playback/seek"; time: number }>
  | Readonly<{
      type: "timeline/move-clip";
      clipId: string;
      laneId: string;
      startTime: number;
    }>
  | Readonly<{ type: "timeline/trim-clip"; clipId: string; duration: number }>
  | Readonly<{ type: "node/move"; nodeId: string; x: number; y: number }>
  | Readonly<{ type: "node/add"; node: EditorNode }>
  | Readonly<{ type: "export/request"; request: EditorExportRequest }>;

export type EditorCommandResult =
  | Readonly<{ status: "applied"; state: EditorState; command: EditorCommand }>
  | Readonly<{
      status: "rejected";
      state: EditorState;
      command: EditorCommand;
      reason: string;
    }>
  | Readonly<{
      status: "unsupported";
      state: EditorState;
      command: EditorCommand;
      reason: string;
    }>;

export type MockPreviewFrame = Readonly<{
  time: number;
  background: string;
  nodes: readonly EditorNode[];
}>;

export type EditorPreviewState =
  | Readonly<{ status: "mock"; label: string; frame: MockPreviewFrame }>
  | Readonly<{ status: "unavailable"; reason: string }>;

export type EditorExportResult =
  | Readonly<{ status: "mock"; label: string }>
  | Readonly<{ status: "unavailable"; reason: string }>;

export const EMPTY_EDITOR_SELECTION: EditorSelection = { kind: "none" };

export const DEFAULT_EDITOR_VIEWPORT: EditorViewportState = {
  zoom: 1,
  scrollLeft: 0,
  scrollTop: 0,
};
