/**
 * Rewrite envelope project from a MotionProject (property/command mutations).
 */

import type { MotionProject } from "@motionvideo/motion-schema";
import type { TimelineClip, TimelineLane } from "@motionvideo/editor-core";
import {
  parseDesktopProjectFile,
  serializeDesktopProjectEnvelope,
} from "../../../../src/shared/project-file/envelope";

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
