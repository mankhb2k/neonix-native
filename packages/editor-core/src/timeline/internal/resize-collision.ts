import { applyRippleAfter } from "../../operations/clip-move";
import type { TimelineClip, TimelineLane } from "../timeline-clips";

/** Sau resize: đẩy clip overlap trên cùng lane; ripple nếu policy bật. */
export function resolveCollisionsAfterResize(
  clips: TimelineClip[],
  lanes: TimelineLane[],
  resizedClipId: string,
): TimelineClip[] {
  const resized = clips.find((clip) => clip.id === resizedClipId);
  if (!resized) return clips;
  const lane = lanes.find((l) => l.id === resized.laneId);
  const rippleMode =
    lane?.kind === "visual" ? Boolean(lane.policy.rippleMode) : false;
  const others = clips
    .filter(
      (clip) =>
        clip.laneId === resized.laneId &&
        clip.id !== resized.id &&
        clip.startTime >= resized.startTime,
    )
    .sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));

  let next = clips;
  let cursor = resized.startTime + resized.duration;
  for (const other of others) {
    if (other.startTime >= cursor) {
      cursor = other.startTime + other.duration;
      continue;
    }
    const delta = cursor - other.startTime;
    next = next.map((clip) =>
      clip.id === other.id ? { ...clip, startTime: cursor } : clip,
    );
    if (rippleMode) {
      next = applyRippleAfter(
        next,
        resized.laneId,
        other.startTime + 1e-6,
        delta,
        true,
      );
    }
    cursor += other.duration;
  }
  return next;
}
