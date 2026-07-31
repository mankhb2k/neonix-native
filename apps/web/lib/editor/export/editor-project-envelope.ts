/**
 * Editor .mt envelope — giữ clips/lanes khi download/import (không mất placement).
 */

import { parseMotionProject, type MotionProject } from "@motionvideo/motion-schema";
import { overlaysFromClips } from "@/lib/editor/persistence/project-migrations";
import type { TimelineClip, TimelineLane } from "@/lib/editor/timeline-clips";
import { parseTimelineClips, parseTimelineLanes } from "@/lib/editor/timeline-clips";

export const EDITOR_PROJECT_FORMAT = "motion-editor-project" as const;
export const EDITOR_ENVELOPE_VERSION = 1;

export type EditorProjectEnvelope = {
  format: typeof EDITOR_PROJECT_FORMAT;
  formatVersion: number;
  project: MotionProject;
  timelineClips: TimelineClip[];
  timelineLanes: TimelineLane[];
};

export function isEditorProjectEnvelope(
  value: unknown,
): value is EditorProjectEnvelope {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return row.format === EDITOR_PROJECT_FORMAT;
}

export function buildEditorProjectEnvelope(input: {
  project: MotionProject;
  timelineClips: TimelineClip[];
  timelineLanes: TimelineLane[];
}): EditorProjectEnvelope {
  return {
    format: EDITOR_PROJECT_FORMAT,
    formatVersion: EDITOR_ENVELOPE_VERSION,
    project: input.project,
    timelineClips: input.timelineClips,
    timelineLanes: input.timelineLanes,
  };
}

export function serializeEditorProjectEnvelope(
  envelope: EditorProjectEnvelope,
): string {
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

export type ParsedEditorImport =
  | {
      kind: "envelope";
      project: MotionProject;
      timelineClips: TimelineClip[];
      timelineLanes: TimelineLane[];
      overlayScenes: ReturnType<typeof overlaysFromClips>;
    }
  | {
      kind: "project";
      project: MotionProject;
      timelineClips: TimelineClip[];
      timelineLanes: TimelineLane[];
      overlayScenes: [];
    };

/** Parse .mt — envelope editor hoặc MotionProject thuần. */
export function parseEditorImport(raw: unknown): ParsedEditorImport {
  if (isEditorProjectEnvelope(raw)) {
    const project = parseMotionProject(raw.project);
    const timelineLanes = parseTimelineLanes(raw.timelineLanes);
    const timelineClips = parseTimelineClips(raw.timelineClips);
    return {
      kind: "envelope",
      project,
      timelineClips,
      timelineLanes,
      overlayScenes: overlaysFromClips(timelineClips, timelineLanes),
    };
  }
  const project = parseMotionProject(raw);
  return {
    kind: "project",
    project,
    timelineClips: [],
    timelineLanes: [],
    overlayScenes: [],
  };
}
