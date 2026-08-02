import type { MotionProject, MotionScene } from "@motionvideo/motion-schema";
import type { TimelineClip, TimelineLane } from "../timeline/timeline-clips";
import {
  focusedNodeIdFrom,
  selectedClipIdFrom,
  selectedClipIdsFrom,
  selectedNodeIdFrom,
  selectedOverlayIdFrom,
  selectedSceneIdFrom,
  type EditorSelection,
} from "./editor-selection";

function firstEditableNodeId(scene: MotionScene | undefined): string | null {
  if (!scene) return null;
  const node = scene.nodes.find(
    (n) => n.type === "text" || n.type === "shape" || n.type === "path",
  );
  return node?.id ?? null;
}

export function selectSelectedClipId(selection: EditorSelection): string | null {
  return selectedClipIdFrom(selection);
}

export function selectSelectedClipIds(selection: EditorSelection): string[] {
  return selectedClipIdsFrom(selection);
}

export function selectSelectedSceneId(
  selection: EditorSelection,
  clips: TimelineClip[],
  lanes: TimelineLane[],
): string | null {
  return selectedSceneIdFrom(selection, clips, lanes);
}

export function selectSelectedNodeId(
  selection: EditorSelection,
  clips: TimelineClip[],
  lanes: TimelineLane[],
  project: MotionProject | null,
): string | null {
  const explicit = selectedNodeIdFrom(selection);
  if (explicit) return explicit;
  return focusedNodeIdFrom(
    selection,
    clips,
    lanes,
    project,
    firstEditableNodeId,
  );
}

export function selectSelectedOverlayId(
  selection: EditorSelection,
  clips: TimelineClip[],
  lanes: TimelineLane[],
): string | null {
  return selectedOverlayIdFrom(selection, clips, lanes);
}
