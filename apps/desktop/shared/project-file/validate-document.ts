/**
 * Full document validation before atomic save / on open (Wave 3).
 */

import {
  parseTimelineClipsStrict,
  parseTimelineLanesStrict,
  TimelineParseError,
  validateTimelineDocument,
  type TimelineClip,
  type TimelineLane,
} from "@motionvideo/editor-core";
import {
  parseMotionProject,
  migrateMotionProjectV2ToV3,
  type MotionProject,
} from "@motionvideo/motion-protocol";
import {
  parseDesktopProjectFile,
  ProjectFileParseError,
  type DesktopProjectEnvelope,
} from "./envelope";

/** Version-aware: legacy v2 projects inside old .mt files are migrated. */
function parseEnvelopeProject(project: DesktopProjectEnvelope["project"]): MotionProject {
  if (project.formatVersion === 2) {
    return migrateMotionProjectV2ToV3(project as never).project;
  }
  return parseMotionProject(project);
}

export function validateDesktopDocumentJson(documentJson: string): {
  envelope: DesktopProjectEnvelope;
  project: MotionProject;
  clips: TimelineClip[];
  lanes: TimelineLane[];
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
    project = parseEnvelopeProject(envelope.project);
  } catch (error) {
    throw new ProjectFileParseError(
      "CORRUPT_FILE",
      error instanceof Error
        ? `Invalid MotionProject: ${error.message}`
        : "Invalid MotionProject.",
    );
  }

  let clips: TimelineClip[];
  let lanes: TimelineLane[];
  try {
    lanes = parseTimelineLanesStrict(envelope.timelineLanes);
    clips = parseTimelineClipsStrict(envelope.timelineClips);
  } catch (error) {
    throw new ProjectFileParseError(
      "CORRUPT_FILE",
      error instanceof TimelineParseError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Invalid timeline structure.",
    );
  }

  // Canonicalize parsed structure back onto the envelope.
  envelope.timelineClips = clips;
  envelope.timelineLanes = lanes;

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

  return { envelope, project, clips, lanes };
}
