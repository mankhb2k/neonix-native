import { assertNever } from "./assert-never";
import type {
  TimelineClip,
  TimelineLane,
  TimelineTrackKind,
} from "./model/timeline-types";

/** Clip family ↔ lane kind (main/overlay/audio).
 * @deprecated Dùng clipAcceptsLane (nhận TimelineLane) thay thế.
 */
export function clipAcceptsTrack(
  clip: Pick<TimelineClip, "kind">,
  track: TimelineTrackKind,
): boolean {
  if (clip.kind === "audio") return track === "audio";
  return track === "main" || track === "overlay";
}

/** Clip family ↔ lane kind (visual/audio). */
export function clipAcceptsLane(
  clip: Pick<TimelineClip, "kind">,
  lane: Pick<TimelineLane, "kind">,
): boolean {
  if (clip.kind === "audio") return lane.kind === "audio";
  return lane.kind === "visual";
}

export type ClipCapability = {
  kind: TimelineClip["kind"];
  hasSceneBinding: boolean;
  hasAudioBinding: boolean;
  supportsTrimStart: boolean;
};

/**
 * Bản đồ capability đầy đủ cho từng clip kind.
 * Thêm TimelineClip kind mới mà không cập nhật switch này sẽ lỗi compile.
 */
export function clipCapabilities(clip: TimelineClip): ClipCapability {
  switch (clip.kind) {
    case "scene":
      return {
        kind: "scene",
        hasSceneBinding: true,
        hasAudioBinding: false,
        supportsTrimStart: false,
      };
    case "audio":
      return {
        kind: "audio",
        hasSceneBinding: false,
        hasAudioBinding: true,
        supportsTrimStart: true,
      };
    default:
      return assertNever(clip, "unsupported clip kind");
  }
}
