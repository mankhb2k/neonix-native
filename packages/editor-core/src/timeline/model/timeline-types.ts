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

export type TrackFamily = "visual" | "audio";
export type VisualTrackRole = "base" | "overlay";
export type AudioTrackRole = "audio";
export type TimelineLaneRole = VisualTrackRole | AudioTrackRole;

export type VisualTimelineLane = {
  id: string;
  kind: "visual";
  role: VisualTrackRole;
  order: number;
  name: string;
  policy: VisualLanePolicy;
  locked?: boolean;
  visible?: boolean;
};

export type AudioTimelineLane = {
  id: string;
  kind: "audio";
  role: AudioTrackRole;
  order: number;
  name: string;
  locked?: boolean;
  muted?: boolean;
};

export type TimelineLane = VisualTimelineLane | AudioTimelineLane;

/** Interaction track kind used when a drop targets a track without a lane id. */
export type TimelineTrackKind = "main" | "overlay" | "audio";

type TimelineClipBase = {
  id: string;
  laneId: string;
  startTime: number;
  duration: number;
  name: string;
};

export type VisualMediaType = "shape" | "image" | "video" | "text";

export type TimelinePosterStatus =
  | "pending"
  | "ready"
  | "failed"
  | "unsupported";

export type SceneTimelineClip = TimelineClipBase & {
  kind: "scene";
  sceneId: string;
  /** V2 layer type used for media-aware timeline chrome. */
  mediaType?: VisualMediaType;
  /** Embedded video audio output state; never controls visual visibility. */
  muted?: boolean;
  /** True when this video owns a linked embedded-audio component. */
  embeddedAudio?: boolean;
  /** Source duration in seconds, when known from the referenced video asset. */
  sourceDuration?: number;
  /** Source trim offset in seconds. */
  trimStart?: number;
  /** Ephemeral signed/original preview URL used only by editor chrome. */
  posterUrl?: string;
  /** Preview lifecycle state; never persisted in the Protocol V2 document. */
  posterStatus?: TimelinePosterStatus;
};

export type AudioTimelineClip = TimelineClipBase & {
  kind: "audio";
  audioTrackId: string;
  assetId: string;
  /** Derived audio presentation state; the track mute remains the source of truth. */
  muted?: boolean;
};

export type TimelineClip = SceneTimelineClip | AudioTimelineClip;

