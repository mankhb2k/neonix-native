import { deriveProjectDurationV1 } from "@motionvideo/motion-protocol";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import { parseProjectInput } from "@/lib/runtime/parse-project-input";
import {
  ensureAudioClipsFromTracks,
  migrateLanesAndClips,
  normalizeLaneOrders,
  resolveFitAnchorSeconds,
  sanitizeEditorProject,
  selectionClips,
  selectionNone,
} from "@motionvideo/editor-core";
import type { WebProjectEnvelope } from "@/lib/editor/authoring/web-project-envelope";
import { createEmptyEnvelope } from "@/lib/editor/authoring/web-project-envelope";
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
      storedEnvelope: WebProjectEnvelope | null = null,
    ) => {
      const project = sanitizeEditorProject(parseProjectInput(input));
      const envelope =
        storedEnvelope ?? createEmptyEnvelope(project.metadata.id);
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
        envelope,
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
        duration: deriveProjectDurationV1(project.layers),
        currentTime: 0,
      });
    },
  };
}
