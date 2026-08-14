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
import type {
  MotionProject,
} from "@motionvideo/motion-protocol";
import type {
  MotionScene,
} from "@motionvideo/motion-protocol/runtime";

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
      const scene = project.scenes.find((s) => s.id === clip.sceneId);
      if (!scene) continue;
      items.push({
        kind,
        name: clip.name,
        duration: clip.duration,
        offsetStart: clip.startTime - origin,
        scene: JSON.parse(JSON.stringify(scene)) as MotionScene,
      });
    } else if (kind === "audio") {
      const trackId = clip.kind === "audio" ? clip.audioTrackId : clip.id;
      const track = project.timeline.audioTracks.find(
        (t) => t.id === trackId || t.id === clip.id,
      );
      items.push({
        kind,
        name: clip.name,
        duration: clip.duration,
        offsetStart: clip.startTime - origin,
        audioAssetId:
          (clip.kind === "audio" ? clip.assetId : undefined) ??
          track?.assetId ??
          clip.name,
        trimStart: track?.trimStart ?? 0,
        volume: track?.volume ?? 1,
        fadeIn: track?.fadeIn ?? 0,
        fadeOut: track?.fadeOut ?? 0,
        loop: track?.loop ?? false,
        audioRole: track?.role,
      });
    } else if (clip.kind === "scene") {
      const scene = project.scenes.find((s) => s.id === clip.sceneId);
      items.push({
        kind,
        name: clip.name,
        duration: clip.duration,
        offsetStart: clip.startTime - origin,
        ...(scene
          ? { scene: JSON.parse(JSON.stringify(scene)) as MotionScene }
          : {}),
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
