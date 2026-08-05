import { resolveFitAnchorSeconds } from "@/lib/editor/timeline-fit";
import {
  selectionClips,
  selectionNone,
} from "@/lib/editor/model/editor-selection";
import {
  clipsContentEndSeconds,
  ensureAudioClipsFromTracks,
  migrateLanesAndClips,
  normalizeLaneOrders,
} from "@/lib/editor/timeline-clips";
import { parseMotionProject, type MotionProject } from "@motionvideo/motion-schema";
import { documentFromStoreState } from "@/lib/editor/timeline/document";
import type { HistoryEntry } from "@/lib/editor/timeline/history/history-types";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import type { WebProjectEnvelope } from "@/lib/editor/authoring/web-project-envelope";
import type {
  EditorStoreGet,
  EditorStoreSet,
} from "@/lib/editor/store/types";

export function applyAiProjectToStore(
  set: EditorStoreSet,
  get: EditorStoreGet,
  historyPush: (entry: HistoryEntry) => void,
  projectInput: MotionProject,
  meta?: {
    generation?: WebProjectEnvelope["authoring"]["generation"];
    revision?: number;
    affectedElementKeys?: string[];
    label?: string;
  },
): void {
  const state = get();
  const beforeDoc = documentFromStoreState(state);
  const project = parseMotionProject(projectInput);
  const { lanes: migratedLanes, clips: migratedClips } = migrateLanesAndClips(
    project,
    [],
    [],
    [],
  );
  const { lanes: withAudioLanes, clips: withAudioClips } =
    ensureAudioClipsFromTracks(project, migratedLanes, migratedClips);
  const lanes = normalizeLaneOrders(withAudioLanes);
  const clips = withAudioClips;
  const mainId = lanes.find(
    (lane) => lane.kind === "visual" && lane.role === "base",
  )?.id;
  const firstClip = clips.find((clip) => clip.laneId === mainId) ?? clips[0];
  const nextEnvelope: WebProjectEnvelope = {
    id: project.metadata.id,
    revision: meta?.revision ?? (state.envelope?.revision ?? 0) + 1,
    authoring: {
      elementMeta: Object.fromEntries(
        (meta?.affectedElementKeys ?? []).map((key) => {
          const [sceneId, nodeId] = key.split("/");
          return [
            `scene:${sceneId ?? "scene"}:${nodeId ?? key}`,
            {
              origin: "ai" as const,
              lastEditedRevision: meta?.revision ?? 1,
            },
          ];
        }),
      ),
      ...(meta?.generation ? { generation: meta.generation } : {}),
    },
  };

  const afterDoc = {
    project,
    lanes,
    clips,
  };
  if (beforeDoc) {
    historyPush({
      id: `hist_ai_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      label: meta?.label ?? "ai.apply",
      before: beforeDoc,
      after: afterDoc,
      beforeSelection: state.selection,
      afterSelection: firstClip
        ? selectionClips([firstClip.id])
        : selectionNone(),
    });
  }

  set({
    project,
    envelope: nextEnvelope,
    timelineLanes: lanes,
    timelineClips: clips,
    timelineZoom: 50,
    timelineZoomMode: "fit",
    timelineZoomScale: 1.0,
    timelineFitAnchorSeconds: resolveFitAnchorSeconds(clips),
    timelineFitRevision: state.timelineFitRevision + 1,
    selection: firstClip ? selectionClips([firstClip.id]) : selectionNone(),
    dirtyRevision: state.dirtyRevision + 1,
    canUndo: true,
    canRedo: false,
  });
  usePlaybackClock.getState().reset({
    duration: clipsContentEndSeconds(clips),
    currentTime: 0,
  });
}
