/**
 * Hydrate desktop .mt envelope into timeline session document fields.
 */

import {
  parseTimelineClips,
  parseTimelineLanes,
  type TimelineClip,
  type TimelineLane,
} from "@motionvideo/editor-core";
import {
  parseMotionProject,
  type MotionProject,
} from "@motionvideo/motion-schema";
import {
  parseDesktopProjectFile,
  type DesktopProjectEnvelope,
} from "../../../shared/project-file/envelope";

export type LoadedTimelineDocument = {
  projectId: string;
  projectName: string;
  fps: number;
  project: MotionProject;
  clips: TimelineClip[];
  lanes: TimelineLane[];
  envelope: DesktopProjectEnvelope;
};

export function loadTimelineFromDocumentJson(
  documentJson: string,
): LoadedTimelineDocument {
  const envelope = parseDesktopProjectFile(documentJson);
  const project = parseMotionProject(envelope.project);
  const clips = parseTimelineClips(envelope.timelineClips);
  const lanes = parseTimelineLanes(envelope.timelineLanes);
  const fps = Math.max(1, Math.round(project.metadata.fps ?? 30));

  return {
    projectId: project.metadata.id,
    projectName: project.metadata.name,
    fps,
    project,
    clips,
    lanes,
    envelope,
  };
}
