import type { WebProjectEnvelope } from "@/lib/editor/authoring/web-project-envelope";
import type {
  ClipClipboardItem,
  CommandResult,
  EditorSelection,
  FrameDraft,
  OverlaySceneItem,
  PlacementTarget,
  TimelineClip,
  TimelineCommand,
  TimelineLane,
} from "@motionvideo/editor-core";
import type { AspectRatio, MotionProject } from "@motionvideo/motion-protocol";
import type { StoreApi } from "zustand";

export type SidebarTabId =
  | "frame"
  | "elements"
  | "text"
  | "upload"
  | "stickers"
  | "audio";

export type EditorDragItem = {
  id: string;
  type: "frame" | "audio";
  name: string;
  duration: number;
};

export type EditorStoreState = {
  project: MotionProject | null;
  /** Authoring envelope — locks / provenance (not in renderer). */
  envelope: WebProjectEnvelope | null;
  /** Selection gốc — clip/scene/overlay/node derive qua selector (STATE-02). */
  selection: EditorSelection;
  isExporting: boolean;
  activeSidebarTab: SidebarTabId;
  timelineClips: TimelineClip[];
  timelineLanes: TimelineLane[];

  activeDragItem: EditorDragItem | null;
  isOverTimeline: boolean;

  /** Timeline zoom — playback clock lives in playback-clock-store. */
  timelineZoom: number;
  timelineZoomMode: "fit" | "manual";
  timelineZoomScale: number;
  timelineFitAnchorSeconds: number | null;
  timelineFitRevision: number;
  /** Internal clipboard for timeline clips (Copy/Cut/Paste). */
  timelineClipboard: ClipClipboardItem[] | null;

  /** Undo / Redo runtime state */
  canUndo: boolean;
  canRedo: boolean;

  /** Document dirty tracking — dirty when dirtyRevision !== savedRevision. */
  dirtyRevision: number;
  savedRevision: number;

  /** Group drill-down path (outermost first) — scopes LayersTree + Breadcrumbs. */
  groupPath: string[];
};

export type EditorStoreActions = {
  executeTimelineCommand: (command: TimelineCommand) => CommandResult;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  setActiveDragItem: (item: EditorDragItem | null) => void;
  setIsOverTimeline: (over: boolean) => void;
  loadProject: (
    project: MotionProject,
    overlayScenes?: OverlaySceneItem[],
    timelineClips?: TimelineClip[],
    timelineLanes?: TimelineLane[],
  ) => void;
  selectClip: (clipId: string) => void;
  setSelectedClipIds: (clipIds: string[]) => void;
  clearTimelineSelection: () => void;
  selectNode: (layerId: string | null) => void;
  setActiveSidebarTab: (tab: SidebarTabId) => void;
  updateBrand: (patch: { name?: string; primaryColor?: string }) => void;
  updateSceneDuration: (sceneId: string, duration: number) => void;
  updateNodeText: (rootLayerId: string, layerId: string, text: string) => void;
  updateNodePosition: (
    rootLayerId: string,
    layerId: string,
    position: { x?: number; y?: number },
  ) => void;
  updateNodeAnimation: (
    rootLayerId: string,
    layerId: string,
    patch: { presetId?: string; duration?: number; at?: number },
  ) => void;
  setAspectRatio: (aspectRatio: AspectRatio) => void;
  addClipFromDraft: (
    draft: FrameDraft,
    target?: PlacementTarget | { track: "main" },
  ) => void;
  /** track "main" = UI Main lane (domain role `base`) — API name kept for callers. */
  moveClip: (
    clipId: string,
    patch: {
      startTime: number;
      track: "main" | "overlay" | "audio";
      laneId?: string;
      insertNewLane?: boolean;
      insertOrder?: number;
    },
  ) => void;
  renameLane: (laneId: string, name: string) => void;
  /** Phase 6 — flag lane thật (lock / visible / mute). */
  updateLaneFlags: (
    laneId: string,
    patch: { locked?: boolean; visible?: boolean; muted?: boolean },
  ) => void;
  reorderLane: (laneId: string, newOrder: number) => void;
  addAudioTrack: (track: {
    role: string;
    assetId: string;
    src?: string;
    duration?: number;
  }) => void;
  addAudioClipFromLibrary: (
    item: {
      title: string;
      assetId: string;
      src?: string;
      duration?: number;
    },
    target: {
      startTime: number;
      laneId?: string;
      insertNewLane?: boolean;
      insertOrder?: number;
    },
  ) => void;
  copySelectedClips: () => void;
  cutSelectedClips: () => void;
  pasteClips: (atTime?: number) => void;
  deleteSelectedClips: () => void;
  duplicateSelectedClips: () => void;
  splitSelectedClipsAt: (time: number) => void;
  setExporting: (value: boolean) => void;
  setTimelineZoom: (zoom: number) => void;
  fitTimeline: () => void;
  /** Mark current dirtyRevision as saved (after successful persist). */
  markDocumentSaved: () => void;
  /** Stage interaction commit — one history entry per gesture. */
  commitNodeTransform: (
    rootLayerId: string,
    layerId: string,
    patch: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      rotation?: number;
    },
  ) => void;
  /** Schema inspector / property controls — optional coalesceKey for scrub sessions. */
  dispatchPropertyCommand: (
    command: import("@motionvideo/editor-core").DocumentPropertyCommand,
    options?: { coalesceKey?: string },
  ) => void;
  setElementLocked: (
    rootLayerId: string,
    layerId: string,
    locked: boolean,
  ) => void;
  setPropertyLocked: (
    rootLayerId: string,
    layerId: string,
    propertyPath: string,
    locked: boolean,
  ) => void;
  /** Apply AI generation/refine project with undoable history + generation envelope. */
  applyAiProject: (
    project: MotionProject,
    meta?: {
      generation?: WebProjectEnvelope["authoring"]["generation"];
      revision?: number;
      affectedElementKeys?: string[];
      label?: string;
    },
  ) => void;
  /** Group drill-down navigation (double-click a group → in; breadcrumb → out). */
  enterGroup: (groupId: string) => void;
  navigateGroupDepth: (depth: number) => void;
  renameLayer: (layerId: string, name: string) => void;
  toggleLayerVisible: (layerId: string, visible: boolean) => void;
  reorderLayers: (
    movingId: string,
    targetId: string,
    edge?: "before" | "after",
  ) => void;
  groupSelectedLayers: (ids: string[]) => void;
  ungroupLayer: (groupId: string) => void;
};

export type EditorStore = EditorStoreState & EditorStoreActions;

/** @deprecated Prefer EditorStore — alias for gradual migration. */
export type EditorState = EditorStore;

export type EditorStoreSet = StoreApi<EditorStore>["setState"];
export type EditorStoreGet = StoreApi<EditorStore>["getState"];
