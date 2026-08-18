import type { TimelineLane, TimelineTrackKind } from "../model/timeline-types";

/**
 * Map a single lane (or undefined) to its visual track kind.
 * Used by both web & desktop ClipStrip styling.
 */
export function resolveLaneTrackKind(
  lane: TimelineLane | undefined,
): TimelineTrackKind {
  if (!lane) return "main";
  if (lane.kind === "audio") return "audio";
  if (lane.role === "base") return "main";
  return "overlay";
}
