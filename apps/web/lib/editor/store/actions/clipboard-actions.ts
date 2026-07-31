import { type ClipClipboardItem } from "@/lib/editor/clip-clipboard";
import {
  selectedClipIdsFrom,
} from "@/lib/editor/model/editor-selection";
import {
  selectionHasLockedLane,
} from "@/lib/editor/operations/lane-flags";
import {
  isAudioLane,
  isBaseLane,
} from "@/lib/editor/timeline-clips";
import type {
  EditorStoreActions,
  EditorStoreGet,
  EditorStoreSet,
} from "@/lib/editor/store/types";
import type { MotionScene } from "@motionvideo/motion-schema";

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
          const scene = state.project.scenes.find((s) => s.id === clip.sceneId);
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
          const track = state.project.timeline.audioTracks.find(
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
        } else {
          // Overlay: copy scene content nếu có (self-contained clipboard).
          if (clip.kind === "scene") {
            const scene = state.project.scenes.find((s) => s.id === clip.sceneId);
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
      }
      set({ timelineClipboard: items });
    },

    cutSelectedClips: () => {
      const state = get();
      const ids = selectedClipIdsFrom(state.selection);
      if (selectionHasLockedLane(state.timelineClips, state.timelineLanes, ids)) {
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
