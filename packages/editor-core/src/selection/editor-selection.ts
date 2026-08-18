/**
 * Selection union — nguồn sự thật duy nhất; field cũ derive qua selector (STATE-02).
 */
import type { MotionProject } from "@motionvideo/motion-protocol";
import type { TimelineClip, TimelineLane } from "../timeline/timeline-clips";
import { isAudioLane, isBaseLane } from "../timeline/timeline-clips";

export type EditorSelection =
  | { kind: "none" }
  | { kind: "clips"; ids: string[]; primaryId: string }
  | { kind: "node"; layerId: string };

export function selectionNone(): EditorSelection {
  return { kind: "none" };
}

export function selectionClips(
  ids: string[],
  primaryId?: string,
): EditorSelection {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return selectionNone();
  const primary =
    primaryId && unique.includes(primaryId)
      ? primaryId
      : unique[unique.length - 1];
  return { kind: "clips", ids: unique, primaryId: primary };
}

export function selectionNode(layerId: string): EditorSelection {
  return { kind: "node", layerId };
}

export function selectedClipIdFrom(selection: EditorSelection): string | null {
  return selection.kind === "clips" ? selection.primaryId : null;
}

/** Mảng rỗng ổn định — tránh selector Zustand tạo [] mới mỗi lần (infinite re-render). */
const EMPTY_CLIP_IDS: string[] = [];

export function selectedClipIdsFrom(selection: EditorSelection): string[] {
  return selection.kind === "clips" ? selection.ids : EMPTY_CLIP_IDS;
}

/**
 * Root layer đang edit: primary scene-clip (base + overlay) → `clip.sceneId`
 * chính là `rootLayerId` của scene-clip đó (protocol canonical: root layer,
 * không phải "scene"). Node selection không lưu root — derive bằng
 * `rootLayerIdOf`. Audio clip → null (Inspector không gắn root layer).
 */
export function selectedRootLayerIdFrom(
  selection: EditorSelection,
  clips: TimelineClip[] = [],
): string | null {
  if (selection.kind === "node") return null;
  if (selection.kind !== "clips") return null;
  const clip = clips.find((c) => c.id === selection.primaryId);
  if (!clip || clip.kind !== "scene") return null;
  return clip.sceneId || null;
}

export function selectedNodeIdFrom(selection: EditorSelection): string | null {
  return selection.kind === "node" ? selection.layerId : null;
}

/** Overlay clip id — derive, không lưu riêng trong state. */
export function selectedOverlayIdFrom(
  selection: EditorSelection,
  clips: TimelineClip[],
  lanes: TimelineLane[],
): string | null {
  const clipId = selectedClipIdFrom(selection);
  if (!clipId) return null;
  const clip = clips.find((c) => c.id === clipId);
  if (!clip) return null;
  if (isBaseLane(lanes, clip.laneId) || isAudioLane(lanes, clip.laneId)) {
    return null;
  }
  return clip.id;
}

/**
 * Node focus cho Inspector: explicit node selection, hoặc first editable
 * trên root layer của base clip đang chọn.
 */
export function focusedNodeIdFrom(
  selection: EditorSelection,
  clips: TimelineClip[],
  project: MotionProject | null,
  firstEditable: (
    rootLayer: MotionProject["layers"][number] | undefined,
  ) => string | null,
): string | null {
  if (selection.kind === "node") return selection.layerId;
  if (selection.kind !== "clips" || !project) return null;
  const rootLayerId = selectedRootLayerIdFrom(selection, clips);
  if (!rootLayerId) return null;
  const rootLayer = project.layers.find((s) => s.id === rootLayerId);
  return firstEditable(rootLayer);
}
