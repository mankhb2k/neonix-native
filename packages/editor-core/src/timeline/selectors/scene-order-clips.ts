import type { MotionProject } from "@motionvideo/motion-protocol";
import type { TimelineClip, TimelineLane } from "../model/timeline-types";
import { migrateLanesAndClips } from "../migrations/project-migration";

/**
 * Derive base-lane scene clips from `timeline.sceneOrder` (startTime cumulative).
 * Convenience wrapper around migrateLanesAndClips with empty initial state.
 */
export function sceneOrderToTimelineClips(project: MotionProject): {
  lanes: TimelineLane[];
  clips: TimelineClip[];
} {
  return migrateLanesAndClips(project, [], [], []);
}
