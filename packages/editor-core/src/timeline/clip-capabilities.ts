import { assertNever } from "./assert-never";
import type {
  TimelineClip,
  TimelineLane,
  TimelineTrackKind,
} from "./model/timeline-types";

/** Clip family ↔ track kind (main/overlay/audio). */
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
 * Exhaustive capability map for known clip kinds.
 * Adding a new TimelineClip kind without updating this switch fails compile.
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
