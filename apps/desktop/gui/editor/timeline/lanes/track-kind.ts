import type { TimelineLane } from "@motionvideo/editor-core";

export type TimelineTrackKind = "main" | "overlay" | "audio";

export function trackForLane(lane: TimelineLane | undefined): TimelineTrackKind {
  if (!lane) return "main";
  if (lane.kind === "audio") return "audio";
  if (lane.role === "base") return "main";
  return "overlay";
}
