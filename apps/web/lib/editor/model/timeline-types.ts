/**
 * Domain timeline types — discriminated union thật (scene | audio).
 * role nằm ở lane, không nằm ở clip.
 */

export type VisualLanePolicy = {
  /** Visual lane không cho overlap trong cùng lane. */
  allowOverlap: false;
  /** Ripple/magnetic — mặc định tắt. */
  rippleMode: boolean;
};

export const DEFAULT_VISUAL_POLICY: VisualLanePolicy = {
  allowOverlap: false,
  rippleMode: false,
};

export type VisualTimelineLane = {
  id: string;
  kind: "visual";
  role: "base" | "overlay";
  order: number;
  name: string;
  policy: VisualLanePolicy;
  locked?: boolean;
  visible?: boolean;
};

export type AudioTimelineLane = {
  id: string;
  kind: "audio";
  role: "audio";
  order: number;
  name: string;
  locked?: boolean;
  muted?: boolean;
};

export type TimelineLane = VisualTimelineLane | AudioTimelineLane;

/** @deprecated Legacy persistence kind — migrator map sang visual/audio. */
export type LegacyTimelineLaneKind = "main" | "overlay" | "audio";

/** @deprecated Prefer laneId; kept for migrate/parse of older saves. */
export type TimelineTrackKind = "main" | "overlay" | "audio";

type TimelineClipBase = {
  id: string;
  laneId: string;
  startTime: number;
  duration: number;
  name: string;
};

export type SceneTimelineClip = TimelineClipBase & {
  kind: "scene";
  sceneId: string;
};

export type AudioTimelineClip = TimelineClipBase & {
  kind: "audio";
  audioTrackId: string;
  assetId: string;
};

export type TimelineClip = SceneTimelineClip | AudioTimelineClip;

export function isSceneClip(clip: TimelineClip): clip is SceneTimelineClip {
  return clip.kind === "scene";
}

export function isAudioClip(clip: TimelineClip): clip is AudioTimelineClip {
  return clip.kind === "audio";
}

export function isVisualLane(lane: TimelineLane): lane is VisualTimelineLane {
  return lane.kind === "visual";
}

export function isBaseLaneObj(lane: TimelineLane): boolean {
  return lane.kind === "visual" && lane.role === "base";
}

export function isOverlayLaneObj(lane: TimelineLane): boolean {
  return lane.kind === "visual" && lane.role === "overlay";
}

export function clipSceneId(clip: TimelineClip): string | null {
  return clip.kind === "scene" && clip.sceneId ? clip.sceneId : null;
}
