import { assertNever } from "./assert-never";
import type { TimelineClip } from "./model/timeline-types";

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
