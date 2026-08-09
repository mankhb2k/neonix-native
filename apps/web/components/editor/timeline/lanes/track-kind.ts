/**
 * Web track-kind adapter — re-exports from editor-core.
 */

export {
  resolveLaneTrackKind,
  type TimelineTrackKind,
} from "@motionvideo/editor-core";

/** @deprecated Use resolveLaneTrackKind instead. */
export type DesignLaneRole = "base" | "overlay" | "audio";

/** @deprecated Use resolveLaneTrackKind instead. */
export function trackKindForRole(role: DesignLaneRole): TimelineTrackKind {
  if (role === "audio") return "audio";
  if (role === "base") return "main";
  return "overlay";
}
