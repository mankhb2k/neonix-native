import type { MotionProject } from "@motionvideo/motion-schema";
import type { TimelineClip, TimelineLane } from "@/lib/editor/timeline-clips";
import { migrateLanesAndClips } from "@/lib/editor/timeline-clips";

/**
 * Derive base-lane scene clips from `timeline.sceneOrder` (startTime cumulative).
 */
export function sceneOrderToTimelineClips(project: MotionProject): {
  lanes: TimelineLane[];
  clips: TimelineClip[];
} {
  return migrateLanesAndClips(project, [], [], []);
}
