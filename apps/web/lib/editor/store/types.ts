import type { ClipClipboardItem } from "@/lib/editor/clip-clipboard";
import type { FrameDraft } from "@/lib/editor/frame-library";
import type { EditorSelection } from "@/lib/editor/model/editor-selection";
import type { OverlaySceneItem } from "@/lib/editor/overlay-scenes";
import type { TimelineClip, TimelineLane } from "@/lib/editor/timeline-clips";
import type { AspectRatio, MotionProject } from "@motionvideo/motion-schema";
import type { StoreApi } from "zustand";

import type {
  CommandResult,
  TimelineCommand,
} from "@/lib/editor/timeline/commands/command-types";

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
  selectNode: (nodeId: string | null) => void;
  setActiveSidebarTab: (tab: SidebarTabId) => void;
  updateBrand: (patch: Partial<MotionProject["metadata"]["brand"]>) => void;
  updateSceneDuration: (sceneId: string, duration: number) => void;
  updateNodeText: (sceneId: string, nodeId: string, text: string) => void;
  updateNodePosition: (
    sceneId: string,
    nodeId: string,
    position: { x?: number; y?: number },
  ) => void;
  updateNodeAnimation: (
    sceneId: string,
    nodeId: string,
    patch: { presetId?: string; duration?: number; at?: number },
  ) => void;
  setAspectRatio: (aspectRatio: AspectRatio) => void;
  addClipFromDraft: (
    draft: FrameDraft,
    target:
      | { track: "main" }
      | {
          track: "overlay";
          startTime: number;
          laneId?: string;
          insertNewLane?: boolean;
          insertOrder?: number;
        },
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
};

export type EditorStore = EditorStoreState & EditorStoreActions;

/** @deprecated Prefer EditorStore — alias for gradual migration. */
export type EditorState = EditorStore;

export type EditorStoreSet = StoreApi<EditorStore>["setState"];
export type EditorStoreGet = StoreApi<EditorStore>["getState"];
