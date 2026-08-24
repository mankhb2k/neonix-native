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
  /**
   * Layer mode: commit dạng `add-scene-node` vào scene này thay vì timeline clip.
   * `startTime` là toàn cục; local timing được dẫn xuất qua `layerContainerStart`
   * / `layerContainerDuration`.
   */
  layerSceneId?: string;
  layerContainerStart?: number;
  layerContainerDuration?: number;
  /**
   * V1 group layers: id parent group cho child layer mới.
   * `null` = root layer (mặc định). Khi set, layer mới tạo là con của group
   * và timing theo parent-relative.
   */
  layerParentId?: string | null;
  /** Layer mode: effective start của parent trong scene. */
  layerParentSceneStart?: number;
  /** Layer mode: effective duration của parent. */
  layerParentDuration?: number;
};

export type ClipMovePatch = {
  startTime: number;
  track?: "main" | "overlay" | "audio";
  laneId?: string | null;
  insertNewLane?: boolean;
  insertOrder?: number | null;
  /** Bề mặt group: không bao giờ pack hai con trên một hàng. */
  exclusiveRows?: boolean;
  /** Đổi lane với clip này (sắp xếp dọc group). */
  swapClipId?: string | null;
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
  | {
      type: "add-scene-node";
      sceneId: string;
      draft: FrameDraft;
      /** Timing local theo scene; mặc định trọn scene duration. */
      timing?: { start: number; duration: number };
      /** Cao hơn = trên. Mặc định max hiện tại + 1. */
      zIndex?: number;
      /** V1 group layers: id parent group (null = root, mặc định). */
      parentLayerId?: string | null;
    }
  | { type: "add-audio-clip"; item: AudioLibraryItem; target: PlacementTarget }
  | { type: "move-clip"; clipId: string; patch: ClipMovePatch }
  | {
      type: "move-clips";
      /** Primary là clipIds[0]; time delta chung áp trên home lane. */
      clipIds: string[];
      deltaTime: number;
      /** Optional AE row target for a vertical group move. */
      targetLaneId?: string | null;
      targetTrack?: "main" | "overlay" | "audio";
      targetInsertNewLane?: boolean;
      targetInsertOrder?: number | null;
    }
  | {
      type: "clip/trim";
      clipId: string;
      duration: number;
      startTime?: number;
      /** Offset nguồn audio — bị bỏ qua với scene clip. */
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
  | {
      type: "scene-node-added";
      sceneId: string;
      layerId: string;
    }
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
        | "invalid_protocol"
        | "duplicate_clip"
        | "unknown_command";
      message: string;
    };
