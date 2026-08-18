import { type ClipClipboardItem } from "@motionvideo/editor-core";
import { selectedClipIdsFrom } from "@motionvideo/editor-core";
import { selectionHasLockedLane } from "@motionvideo/editor-core";
import { isAudioLane, isBaseLane } from "@motionvideo/editor-core";
import type {
  EditorStoreActions,
  EditorStoreGet,
  EditorStoreSet,
} from "@/lib/editor/store/types";
import type { MotionLayer } from "@motionvideo/motion-protocol";

export type ClipboardActions = Pick<
  EditorStoreActions,
  | "copySelectedClips"
  | "cutSelectedClips"
  | "pasteClips"
  | "duplicateSelectedClips"
>;

export function createClipboardActions(
  set: EditorStoreSet,
  get: EditorStoreGet,
): ClipboardActions {
  return {
    /* ========================================================================== */
    /* 1. COPY & CUT OPERATIONS                                                   */
    /* ========================================================================== */

    copySelectedClips: () => {
      const state = get();
      const ids = selectedClipIdsFrom(state.selection);
      if (ids.length === 0 || !state.project) return;
      const selected = state.timelineClips
        .filter((clip) => ids.includes(clip.id))
        .sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));
      if (selected.length === 0) return;
      const origin = selected[0].startTime;
      const items: ClipClipboardItem[] = [];
      for (const clip of selected) {
        const kind = isBaseLane(state.timelineLanes, clip.laneId)
          ? "main"
          : isAudioLane(state.timelineLanes, clip.laneId)
            ? "audio"
            : "overlay";
        if (kind === "main") {
          if (clip.kind !== "scene") continue;
          const scene = state.project.layers.find((s) => s.id === clip.sceneId);
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
          const audioLayer = state.project.layers.find(
            (l): l is Extract<MotionLayer, { type: "audio" }> =>
              l.type === "audio" && (l.id === trackId || l.id === clip.id),
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
        } else {
          // Overlay: copy scene content nếu có (self-contained clipboard).
          if (clip.kind === "scene") {
            const scene = state.project.layers.find(
              (s) => s.id === clip.sceneId,
            );
            items.push({
              kind,
              name: clip.name,
              duration: clip.duration,
              offsetStart: clip.startTime - origin,
              ...(scene
                ? { scene: JSON.parse(JSON.stringify(scene)) as MotionLayer }
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
      }
      set({ timelineClipboard: items });
    },

    cutSelectedClips: () => {
      const state = get();
      const ids = selectedClipIdsFrom(state.selection);
      if (
        selectionHasLockedLane(state.timelineClips, state.timelineLanes, ids)
      ) {
        return;
      }
      get().copySelectedClips();
      get().deleteSelectedClips();
    },

    /* ========================================================================== */
    /* 2. PASTE & DUPLICATE OPERATIONS                                            */
    /* ========================================================================== */

    pasteClips: (atTime = 0) => {
      get().executeTimelineCommand({
        type: "paste-clips",
        atTime,
      });
    },

    duplicateSelectedClips: () => {
      get().executeTimelineCommand({
        type: "duplicate-selected-clips",
      });
    },
  };
}
