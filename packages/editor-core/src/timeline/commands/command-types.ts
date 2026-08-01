import type { ClipClipboardItem } from "../clip-clipboard";
import type { FrameDraft } from "../../frame-draft";
import type { EditorSelection } from "../../selection/editor-selection";
import type { TimelineClip, TimelineLane } from "../model/timeline-types";
import type { TimelineDocument } from "../../document/document";

export type AudioLibraryItem = {
  title: string;
  assetId: string;
  src?: string;
  duration?: number;
};

export type PlacementTarget = {
  track?: "main" | "overlay" | "audio";
  laneId?: string | null;
  startTime?: number;
  insertNewLane?: boolean;
  insertOrder?: number | null;
};

export type ClipMovePatch = {
  startTime: number;
  track?: "main" | "overlay" | "audio";
  laneId?: string | null;
  insertNewLane?: boolean;
  insertOrder?: number | null;
};

export type TimelineLaneFlags = {
  locked?: boolean;
  visible?: boolean;
  muted?: boolean;
  rippleMode?: boolean;
};

/**
 * Discriminated Union của tất cả các Timeline Commands trong hệ thống.
 */
export type TimelineCommand =
  | { type: "update-scene-duration"; sceneId: string; duration: number }
  | { type: "add-clip-draft"; draft: FrameDraft; target: PlacementTarget }
  | { type: "add-audio-clip"; item: AudioLibraryItem; target: PlacementTarget }
  | { type: "move-clip"; clipId: string; patch: ClipMovePatch }
  | {
      type: "move-clips";
      moves: Array<{ clipId: string; patch: ClipMovePatch }>;
    }
  | {
      type: "clip/trim";
      clipId: string;
      duration: number;
      startTime?: number;
      /** Audio source offset — ignored for scene clips. */
      trimStart?: number;
    }
  | { type: "delete-selected-clips" }
  | { type: "split-selected-clips"; time: number }
  | { type: "duplicate-selected-clips" }
  | { type: "paste-clips"; atTime?: number }
  | { type: "rename-lane"; laneId: string; name: string }
  | { type: "update-lane-flags"; laneId: string; patch: TimelineLaneFlags }
  | { type: "reorder-lane"; laneId: string; newOrder: number }
  | {
      type: "transition/add";
      id: string;
      fromClipId: string;
      toClipId: string;
      kind?: "cut" | "fade" | "crossfade";
    };

/** Domain Events được phát ra sau khi thực thi thành công một command. */
export type TimelineDomainEvent =
  | { type: "clip-added"; clip: TimelineClip; lane: TimelineLane }
  | { type: "clip-moved"; clipId: string; fromLaneId: string; toLaneId: string }
  | { type: "clip-deleted"; clipIds: string[] }
  | { type: "clip-split"; originalClipId: string; newClipIds: string[] }
  | { type: "clip-trimmed"; clipId: string }
  | { type: "transition-added"; transitionId: string }
  | { type: "lane-updated"; laneId: string }
  | { type: "document-rebuilt" };

/** Kết quả trả về từ Command Runner. */
export type CommandResult =
  | {
      status: "applied";
      document: TimelineDocument;
      selection?: EditorSelection;
      clipboard?: ClipClipboardItem[];
      events: TimelineDomainEvent[];
    }
  | {
      status: "rejected";
      reason:
        | "no_project"
        | "locked"
        | "collision"
        | "missing_clip"
        | "missing_lane"
        | "empty_selection"
        | "empty_clipboard"
        | "invalid_document"
        | "unknown_command";
      message: string;
    };
