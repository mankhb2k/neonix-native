import type {
  EditorStoreActions,
  EditorStoreGet,
  EditorStoreSet,
} from "@/lib/editor/store/types";

export type ClipActions = Pick<
  EditorStoreActions,
  | "updateSceneDuration"
  | "addClipFromDraft"
  | "moveClip"
  | "addAudioClipFromLibrary"
  | "addAudioTrack"
  | "deleteSelectedClips"
  | "splitSelectedClipsAt"
>;

export function createClipActions(
  _set: EditorStoreSet,
  get: EditorStoreGet,
): ClipActions {
  return {
    /* ========================================================================== */
    /* 1. SCENE DURATION & METADATA                                               */
    /* ========================================================================== */

    updateSceneDuration: (sceneId, duration) => {
      get().executeTimelineCommand({
        type: "update-scene-duration",
        sceneId,
        duration,
      });
    },

    /* ========================================================================== */
    /* 2. CLIP ADDITION (DRAFT / LIBRARY / TRACKS)                                */
    /* ========================================================================== */

    addClipFromDraft: (draft, target) => {
      get().executeTimelineCommand({
        type: "add-clip-draft",
        draft,
        target: target ?? { track: "main" },
      });
    },

    addAudioClipFromLibrary: (item, target) => {
      get().executeTimelineCommand({
        type: "add-audio-clip",
        item,
        target,
      });
    },

    addAudioTrack: (track) => {
      get().addAudioClipFromLibrary(
        {
          title: track.role,
          assetId: track.assetId,
          src: track.src,
          duration: track.duration,
        },
        { startTime: 0, insertNewLane: false },
      );
    },

    /* ========================================================================== */
    /* 3. CLIP MOVEMENT & RE-PLACEMENT                                            */
    /* ========================================================================== */

    moveClip: (clipId, patch) => {
      get().executeTimelineCommand({
        type: "move-clip",
        clipId,
        patch,
      });
    },

    /* ========================================================================== */
    /* 4. CLIP DELETION & SPLITTING                                               */
    /* ========================================================================== */

    deleteSelectedClips: () => {
      get().executeTimelineCommand({
        type: "delete-selected-clips",
      });
    },

    splitSelectedClipsAt: (time) => {
      get().executeTimelineCommand({
        type: "split-selected-clips",
        time,
      });
    },
  };
}
