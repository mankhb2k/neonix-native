/**
 * Apply AI proposal into editor store — one undoable transaction.
 * Merges elementMeta on refine; materializes UI timeline from root layers.
 */

import { resolveFitAnchorSeconds } from "@motionvideo/editor-core";
import { selectionClips, selectionNone } from "@motionvideo/editor-core";
import {
  ensureAudioClipsFromTracks,
  migrateLanesAndClips,
  normalizeLaneOrders,
} from "@motionvideo/editor-core";
import {
  parseMotionProject,
  type MotionProject,
} from "@motionvideo/motion-protocol";
import { deriveProjectDurationV1 } from "@motionvideo/patterns";
import {
  documentFromStoreState,
  syncProjectProtocolContract,
} from "@motionvideo/editor-core";
import type { HistoryEntry } from "@motionvideo/editor-core";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import type {
  ElementAuthoringMeta,
  WebProjectEnvelope,
} from "@/lib/editor/authoring/web-project-envelope";
import type { EditorStoreGet, EditorStoreSet } from "@/lib/editor/store/types";

export type AiApplyGenerationMeta = NonNullable<
  WebProjectEnvelope["authoring"]["generation"]
> & {
  criticScore?: number;
  warnings?: string[];
};

function mergeElementMeta(
  previous: Record<string, ElementAuthoringMeta>,
  affectedKeys: string[] | undefined,
  revision: number,
): Record<string, ElementAuthoringMeta> {
  const next = { ...previous };
  for (const key of affectedKeys ?? []) {
    const [sceneId, nodeId] = key.split("/");
    const envelopeKey = `scene:${sceneId ?? "scene"}:${nodeId ?? key}`;
    const prev = next[envelopeKey];
    next[envelopeKey] = {
      origin: "ai",
      locked: prev?.locked,
      lockedProperties: prev?.lockedProperties,
      semanticKey: prev?.semanticKey,
      userModifiedProperties: prev?.userModifiedProperties,
      lastEditedRevision: revision,
    };
  }
  return next;
}

export function applyAiProjectToStore(
  set: EditorStoreSet,
  get: EditorStoreGet,
  historyPush: (entry: HistoryEntry) => void,
  projectInput: MotionProject,
  meta?: {
    generation?: AiApplyGenerationMeta;
    revision?: number;
    affectedElementKeys?: string[];
    label?: string;
  },
): void {
  const state = get();
  const beforeDoc = documentFromStoreState(state);
  const project = syncProjectProtocolContract(parseMotionProject(projectInput));
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
  const revision = meta?.revision ?? (state.envelope?.revision ?? 0) + 1;

  const previousMeta = state.envelope?.authoring.elementMeta ?? {};
  const mergedMeta =
    meta?.affectedElementKeys && meta.affectedElementKeys.length > 0
      ? mergeElementMeta(previousMeta, meta.affectedElementKeys, revision)
      : previousMeta;

  const generation = meta?.generation
    ? {
        planId: meta.generation.planId,
        seed: meta.generation.seed,
        model: meta.generation.model,
        capabilityManifestVersion: meta.generation.capabilityManifestVersion,
        ...(meta.generation.criticScore != null
          ? { criticScore: meta.generation.criticScore }
          : {}),
        ...(meta.generation.warnings?.length
          ? { warnings: meta.generation.warnings }
          : {}),
      }
    : state.envelope?.authoring.generation;

  const nextEnvelope: WebProjectEnvelope = {
    id: project.metadata.id,
    revision,
    authoring: {
      elementMeta: mergedMeta,
      ...(generation ? { generation } : {}),
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
    duration: deriveProjectDurationV1(project.layers),
    currentTime: 0,
  });
}
