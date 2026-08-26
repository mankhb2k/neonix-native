import type { TimelineClip, TimelineLane } from "./model/timeline-types";

/** Clip family ↔ lane kind (visual/audio). */
export function clipAcceptsLane(
  clip: Pick<TimelineClip, "kind">,
  lane: Pick<TimelineLane, "kind">,
): boolean {
  if (clip.kind === "audio") return lane.kind === "audio";
  return lane.kind === "visual";
}
