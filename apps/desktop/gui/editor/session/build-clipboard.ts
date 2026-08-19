/**
 * Build ClipClipboardItem[] from current selection (leaf port — no web imports).
 */

import {
  isAudioLane,
  isBaseLane,
  selectedClipIdsFrom,
  type ClipClipboardItem,
  type EditorSelection,
  type TimelineClip,
  type TimelineLane,
} from "@motionvideo/editor-core";
import type { MotionLayer, MotionProject } from "@motionvideo/motion-protocol";

export function buildClipboardFromSelection(input: {
  selection: EditorSelection;
  clips: TimelineClip[];
  lanes: TimelineLane[];
  project: MotionProject | null;
}): ClipClipboardItem[] {
  const { selection, clips, lanes, project } = input;
  if (!project) return [];
  const ids = selectedClipIdsFrom(selection);
  if (ids.length === 0) return [];
  const selected = clips
    .filter((clip) => ids.includes(clip.id))
    .sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));
  if (selected.length === 0) return [];
  const origin = selected[0].startTime;
  const items: ClipClipboardItem[] = [];
  for (const clip of selected) {
    const kind = isBaseLane(lanes, clip.laneId)
      ? "main"
      : isAudioLane(lanes, clip.laneId)
        ? "audio"
        : "overlay";
    if (kind === "main") {
      if (clip.kind !== "scene") continue;
      const scene = project.layers.find((layer) => layer.id === clip.sceneId);
      if (!scene) continue;
      items.push({
        kind,
        name: clip.name,
        duration: clip.duration,
        offsetStart: clip.startTime - origin,
        scene: JSON.parse(JSON.stringify(scene)) as MotionLayer,
      });
    } else if (kind === "audio") {
      const trackId = clip.kind === "audio" ? clip.audioTrackId : clip.id;
      const audioLayer = project.layers.find(
        (layer): layer is Extract<MotionLayer, { type: "audio" }> =>
          layer.type === "audio" &&
          (layer.id === trackId || layer.id === clip.id),
      );
      items.push({
        kind,
        name: clip.name,
        duration: clip.duration,
        offsetStart: clip.startTime - origin,
        audioAssetId:
          (clip.kind === "audio" ? clip.assetId : undefined) ??
          audioLayer?.payload.assetId ??
          clip.name,
        trimStart: audioLayer?.payload.trimStart ?? 0,
        volume: audioLayer?.payload.volume ?? 100,
        fadeIn: audioLayer?.payload.fadeIn ?? 0,
        fadeOut: audioLayer?.payload.fadeOut ?? 0,
        loop: audioLayer?.payload.loop ?? false,
      });
    } else if (clip.kind === "scene") {
      const scene = project.layers.find((layer) => layer.id === clip.sceneId);
      items.push({
        kind,
        name: clip.name,
        duration: clip.duration,
        offsetStart: clip.startTime - origin,
        scene: scene
          ? (JSON.parse(JSON.stringify(scene)) as MotionLayer)
          : undefined,
      });
    } else {
      items.push({
        kind,
        name: clip.name,
        duration: clip.duration,
        offsetStart: clip.startTime - origin,
      });
    }
  }
  return items;
}
