import { resolveFitAnchorSeconds } from "@motionvideo/editor-core";
import { selectionClips, selectionNone } from "@motionvideo/editor-core";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import {
  clipsContentEndSeconds,
  ensureAudioClipsFromTracks,
  migrateLanesAndClips,
  normalizeLaneOrders,
} from "@motionvideo/editor-core";
import { parseProjectInput } from "@/lib/runtime/parse-project-input";
import type {
  EditorStoreActions,
  EditorStoreGet,
  EditorStoreSet,
} from "@/lib/editor/store/types";

export type ProjectLifecycleActions = Pick<EditorStoreActions, "loadProject">;

export function createProjectLifecycleActions(
  set: EditorStoreSet,
  get: EditorStoreGet,
): ProjectLifecycleActions {
  return {
    loadProject: (
      input,
      overlayScenes = [],
      storedClips = [],
      storedLanes = [],
    ) => {
      const project = parseProjectInput(input);
      const { lanes: migratedLanes, clips: migratedClips } =
        migrateLanesAndClips(project, overlayScenes, storedClips, storedLanes);
      const { lanes: withAudioLanes, clips: withAudioClips } =
        ensureAudioClipsFromTracks(project, migratedLanes, migratedClips);
      const lanes = normalizeLaneOrders(withAudioLanes);
      const clips = withAudioClips;
      const mainId = lanes.find(
        (lane) => lane.kind === "visual" && lane.role === "base",
      )?.id;
      const firstClip =
        clips.find((clip) => clip.laneId === mainId) ?? clips[0];

      const anchorSeconds = resolveFitAnchorSeconds(clips);

      // Reset transient UI/session — tránh rò state project trước sang project sau (STATE-04).
      set((state) => ({
        project,
        envelope: {
          id: project.metadata.id,
          revision: 1,
          authoring: { elementMeta: {} },
        },
        timelineLanes: lanes,
        timelineClips: clips,
        timelineZoom: 50,
        timelineZoomMode: "fit",
        timelineZoomScale: 1.0,
        timelineFitAnchorSeconds: anchorSeconds,
        timelineFitRevision: state.timelineFitRevision + 1,
        selection: firstClip ? selectionClips([firstClip.id]) : selectionNone(),
        activeDragItem: null,
        isOverTimeline: false,
        isExporting: false,
        // Clipboard: giữ xuyên project nếu payload self-contained; hiện reset an toàn.
        timelineClipboard: null,
        canUndo: false,
        canRedo: false,
        dirtyRevision: 0,
        savedRevision: 0,
        groupPath: [],
      }));
      get().clearHistory();

      // Playback clock reset atomic — kể cả reload cùng project id (PLAY-01).
      usePlaybackClock.getState().reset({
        duration: Math.max(
          clipsContentEndSeconds(clips),
          project.timeline.duration ?? 0,
        ),
        currentTime: 0,
      });
    },
  };
}
