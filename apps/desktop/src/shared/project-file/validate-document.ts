/**
 * Full document validation before atomic save (Wave E).
 */

import {
  parseMotionProject,
  type MotionProject,
} from "@motionvideo/motion-schema";
import {
  validateTimelineDocument,
  type TimelineClip,
  type TimelineLane,
} from "@motionvideo/editor-core";
import {
  parseDesktopProjectFile,
  ProjectFileParseError,
  type DesktopProjectEnvelope,
} from "./envelope";

export function validateDesktopDocumentJson(documentJson: string): {
  envelope: DesktopProjectEnvelope;
  project: MotionProject;
} {
  let envelope: DesktopProjectEnvelope;
  try {
    envelope = parseDesktopProjectFile(documentJson);
  } catch (error) {
    if (error instanceof ProjectFileParseError) throw error;
    throw new ProjectFileParseError(
      "CORRUPT_FILE",
      error instanceof Error ? error.message : "Invalid project JSON.",
    );
  }

  let project: MotionProject;
  try {
    project = parseMotionProject(envelope.project);
  } catch (error) {
    throw new ProjectFileParseError(
      "CORRUPT_FILE",
      error instanceof Error
        ? `Invalid MotionProject: ${error.message}`
        : "Invalid MotionProject.",
    );
  }

  const clips = envelope.timelineClips as TimelineClip[];
  const lanes = envelope.timelineLanes as TimelineLane[];
  const validation = validateTimelineDocument({
    project,
    clips,
    lanes,
  });
  if (!validation.valid) {
    throw new ProjectFileParseError(
      "CORRUPT_FILE",
      `Timeline invariants violated: ${validation.violations
        .map((v) => v.message)
        .join("; ")}`,
    );
  }

  return { envelope, project };
}
