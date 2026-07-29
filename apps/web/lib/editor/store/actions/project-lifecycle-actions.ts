import { TIMELINE_ZOOM_ON_PROJECT_LOAD } from "@/lib/editor/editor-preferences";
import {
  selectionClips,
  selectionNone,
} from "@/lib/editor/model/editor-selection";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import {
  clipsContentEndSeconds,
  ensureAudioClipsFromTracks,
  migrateLanesAndClips,
  normalizeLaneOrders,
} from "@/lib/editor/timeline-clips";
import { parseMotionProject } from "@motionvideo/motion-schema";
import type {
  EditorStoreActions,
  EditorStoreSet,
} from "@/lib/editor/store/types";

export type ProjectLifecycleActions = Pick<EditorStoreActions, "loadProject">;

export function createProjectLifecycleActions(
  set: EditorStoreSet,
): ProjectLifecycleActions {
  return {
    loadProject: (
      input,
      overlayScenes = [],
      storedClips = [],
      storedLanes = [],
    ) => {
      const project = parseMotionProject(input);
      const { lanes: migratedLanes, clips: migratedClips } =
        migrateLanesAndClips(
          project,
          overlayScenes,
          storedClips,
          storedLanes,
        );
      const { lanes: withAudioLanes, clips: withAudioClips } =
        ensureAudioClipsFromTracks(project, migratedLanes, migratedClips);
      const lanes = normalizeLaneOrders(withAudioLanes);
      const clips = withAudioClips;
      const mainId = lanes.find(
        (lane) => lane.kind === "visual" && lane.role === "base",
      )?.id;
      const firstClip =
        clips.find((clip) => clip.laneId === mainId) ?? clips[0];

      // Reset transient UI/session — tránh rò state project trước sang project sau (STATE-04).
      set({
        project,
        timelineLanes: lanes,
        timelineClips: clips,
        timelineZoom: TIMELINE_ZOOM_ON_PROJECT_LOAD,
        selection: firstClip ? selectionClips([firstClip.id]) : selectionNone(),
        activeDragItem: null,
        isOverTimeline: false,
        isExporting: false,
        // Clipboard: giữ xuyên project nếu payload self-contained; hiện reset an toàn.
        timelineClipboard: null,
      });

      // Playback clock reset atomic — kể cả reload cùng project id (PLAY-01).
      usePlaybackClock.getState().reset({
        duration: clipsContentEndSeconds(clips),
        currentTime: 0,
      });
    },
  };
}
