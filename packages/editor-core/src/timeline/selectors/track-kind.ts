import type { TimelineLane, TimelineTrackKind } from "../model/timeline-types";

/**
 * Ánh xạ một lane (hoặc undefined) sang visual track kind.
 * Dùng cho styling ClipStrip ở cả web & desktop.
 */
export function resolveLaneKind(
  lane: TimelineLane | undefined,
): TimelineTrackKind {
  if (!lane) return "main";
  if (lane.kind === "audio") return "audio";
  if (lane.role === "base") return "main";
  return "overlay";
}

