import type { TimelineClip, TimelineLane } from "@/lib/editor/timeline-clips";
import { isAudioLane, isMainLane } from "@/lib/editor/timeline-clips";
import {
  selectedClipIdFrom,
  selectedClipIdsFrom,
  selectedNodeIdFrom,
  selectedSceneIdFrom,
  type EditorSelection,
} from "@/lib/editor/model/editor-selection";

export function selectSelectedClipId(selection: EditorSelection): string | null {
  return selectedClipIdFrom(selection);
}

export function selectSelectedClipIds(selection: EditorSelection): string[] {
  return selectedClipIdsFrom(selection);
}

export function selectSelectedSceneId(selection: EditorSelection): string | null {
  return selectedSceneIdFrom(selection);
}

export function selectSelectedNodeId(selection: EditorSelection): string | null {
  return selectedNodeIdFrom(selection);
}

/** Derive overlay id từ selection + clip/lane — không lưu riêng trong state. */
export function selectSelectedOverlayId(
  selection: EditorSelection,
  clips: TimelineClip[],
  lanes: TimelineLane[],
): string | null {
  const clipId = selectedClipIdFrom(selection);
  if (!clipId) return null;
  const clip = clips.find((c) => c.id === clipId);
  if (!clip) return null;
  if (isMainLane(lanes, clip.laneId) || isAudioLane(lanes, clip.laneId)) return null;
  return clip.id;
}
