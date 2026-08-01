/**
 * Rewrite envelope project from a MotionProject (property/command mutations).
 */

import {
  parseDesktopProjectFile,
  serializeDesktopProjectEnvelope,
} from "../../../shared/project-file/envelope";
import type { TimelineClip, TimelineLane } from "@motionvideo/editor-core";
import type { MotionProject } from "@motionvideo/motion-schema";

export function serializeProjectIntoDocumentJson(
  baseDocumentJson: string,
  project: MotionProject,
  clips?: TimelineClip[],
  lanes?: TimelineLane[],
): string {
  const envelope = parseDesktopProjectFile(baseDocumentJson);
  envelope.project = project as unknown as typeof envelope.project;
  if (clips) envelope.timelineClips = clips;
  if (lanes) envelope.timelineLanes = lanes;
  return serializeDesktopProjectEnvelope(envelope);
}
