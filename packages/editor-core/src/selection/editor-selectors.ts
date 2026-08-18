import type { MotionLayer, MotionProject } from "@motionvideo/motion-protocol";
import type { TimelineClip, TimelineLane } from "../timeline/timeline-clips";
import {
  focusedNodeIdFrom,
  selectedClipIdFrom,
  selectedClipIdsFrom,
  selectedNodeIdFrom,
  selectedOverlayIdFrom,
  selectedRootLayerIdFrom,
  type EditorSelection,
} from "./editor-selection";

function firstEditableNodeId(
  rootLayer: MotionLayer | undefined,
): string | null {
  if (!rootLayer) return null;
  // Primitive root (text/shape/image/...) → chính nó là node edit được.
  if (rootLayer.type !== "group") return rootLayer.id;
  const node = rootLayer.children.find(
    (n) => n.type === "text" || n.type === "shape" || n.type === "path",
  );
  return node?.id ?? null;
}

export function selectSelectedClipId(
  selection: EditorSelection,
): string | null {
  return selectedClipIdFrom(selection);
}

export function selectSelectedClipIds(selection: EditorSelection): string[] {
  return selectedClipIdsFrom(selection);
}

export function selectSelectedRootLayerId(
  selection: EditorSelection,
  clips: TimelineClip[],
): string | null {
  return selectedRootLayerIdFrom(selection, clips);
}

export function selectSelectedNodeId(
  selection: EditorSelection,
  clips: TimelineClip[],
  project: MotionProject | null,
): string | null {
  const explicit = selectedNodeIdFrom(selection);
  if (explicit) return explicit;
  return focusedNodeIdFrom(selection, clips, project, firstEditableNodeId);
}

export function selectSelectedOverlayId(
  selection: EditorSelection,
  clips: TimelineClip[],
  lanes: TimelineLane[],
): string | null {
  return selectedOverlayIdFrom(selection, clips, lanes);
}
