import {
  MIN_CLIP_SLICE_SEC,
  playheadSplitsClip,
} from "@/lib/editor/clip-clipboard";
import { DEFAULT_FRAME_DURATION } from "@/lib/editor/frame-library";
import {
  selectionClips,
  selectionNone,
  selectedClipIdsFrom,
} from "@/lib/editor/model/editor-selection";
import {
  resolveVisualPlacement,
  type VisualPlacementIntent,
} from "@/lib/editor/operations/clip-move";
import {
  isLaneLocked,
  selectionHasLockedLane,
} from "@/lib/editor/operations/lane-flags";
import {
  applyVisualPlacement,
  audioLaneIdByOrder,
  resolveAudioPlacement,
} from "@/lib/editor/store/internal/placement-adapter";
import { resolveCollisionsAfterResize } from "@/lib/editor/store/internal/resize-collision";
import {
  cloneSceneWithNewIds,
  sceneFromFrameDraft,
  uid,
} from "@/lib/editor/store/internal/scene-utils";
import { rebuildMainProject } from "@/lib/editor/store/internal/timeline-project-sync";
import {
  ensureBaseLane,
  isAudioLane,
  isBaseLane,
  isOverlayLane,
  normalizeLaneOrders,
  pruneEmptyLanes,
  resolveMainStartTime,
  type TimelineClip,
} from "@/lib/editor/timeline-clips";
import type {
  EditorStoreActions,
  EditorStoreGet,
  EditorStoreSet,
} from "@/lib/editor/store/types";
import type { MotionProject } from "@motionvideo/motion-schema";

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
  set: EditorStoreSet,
  get: EditorStoreGet,
): ClipActions {
  return {
    /* ========================================================================== */
    /* 1. SCENE DURATION & METADATA                                               */
    /* ========================================================================== */

    /** 3.7 Cập nhật thời lượng của 1 Scene */
    updateSceneDuration: (sceneId, duration) => {
      const project = get().project;
      if (!project) return;
      const nextDuration = Math.max(0.5, duration);
      set((state) => {
        const affectedIds = state.timelineClips
          .filter((clip) => clip.kind === "scene" && clip.sceneId === sceneId)
          .map((clip) => clip.id);
        let timelineClips = state.timelineClips.map((clip) =>
          clip.kind === "scene" && clip.sceneId === sceneId
            ? { ...clip, duration: nextDuration }
            : clip,
        );
        for (const clipId of affectedIds) {
          timelineClips = resolveCollisionsAfterResize(
            timelineClips,
            state.timelineLanes,
            clipId,
          );
        }
        return {
          project: {
            ...project,
            scenes: project.scenes.map((scene) =>
              scene.id === sceneId
                ? { ...scene, duration: nextDuration }
                : scene,
            ),
          },
          timelineClips,
        };
      });
    },

    /* ========================================================================== */
    /* 2. CLIP ADDITION (DRAFT / LIBRARY / TRACKS)                                */
    /* ========================================================================== */

    addClipFromDraft: (draft, target) => {
      set((state) => {
        const project = state.project;
        if (!project) return state;
        let lanes = state.timelineLanes.length
          ? state.timelineLanes
          : [ensureBaseLane([])];
        const baseLane = ensureBaseLane(lanes);
        if (!lanes.some((lane) => lane.id === baseLane.id)) {
          lanes = [...lanes, baseLane];
        }
        const duration = Math.max(
          0.5,
          draft.duration || DEFAULT_FRAME_DURATION,
        );

        if (target.track === "main") {
          if (isLaneLocked(lanes, baseLane.id)) return state;
          const scene = sceneFromFrameDraft(draft);
          const startTime = resolveMainStartTime(
            state.timelineClips,
            lanes,
            state.timelineClips
              .filter((clip) => clip.laneId === baseLane.id)
              .reduce(
                (end, clip) => Math.max(end, clip.startTime + clip.duration),
                0,
              ),
            Math.max(0.5, draft.duration || DEFAULT_FRAME_DURATION),
          );
          const clip: TimelineClip = {
            id: scene.id,
            kind: "scene",
            sceneId: scene.id,
            laneId: baseLane.id,
            startTime,
            duration: scene.duration,
            name: scene.name ?? scene.id,
          };
          const wasEmpty = state.timelineClips.length === 0;
          const timelineClips = [...state.timelineClips, clip];
          const nextProject = rebuildMainProject(
            { ...project, scenes: [...project.scenes, scene] },
            timelineClips,
            lanes,
          );
          const nextLanes = normalizeLaneOrders(lanes);
          return {
            project: nextProject,
            timelineLanes: nextLanes,
            timelineClips,
            selection: selectionClips([clip.id]),
            ...(wasEmpty
              ? {
                  timelineFitAnchorSeconds: clip.duration,
                  timelineZoomMode: "fit",
                  timelineZoomScale: 1.0,
                  timelineZoom: 50,
                  timelineFitRevision: state.timelineFitRevision + 1,
                }
              : {}),
          };
        }

        const insertNew = target.insertNewLane ?? false;
        const intent: VisualPlacementIntent = insertNew
          ? {
              type: "new-overlay-lane",
              insertOrder: target.insertOrder ?? 0,
              startTime: Math.max(0, target.startTime),
              duration,
            }
          : target.laneId
            ? {
                type: "overlay-lane",
                laneId: target.laneId,
                startTime: Math.max(0, target.startTime),
                duration,
              }
            : {
                type: "new-overlay-lane",
                insertOrder: target.insertOrder ?? 0,
                startTime: Math.max(0, target.startTime),
                duration,
              };
        const placement = applyVisualPlacement(
          lanes,
          state.timelineClips,
          intent,
        );
        if (!placement) return state;
        lanes = placement.lanes;
        // Overlay cũng là scene thật trong editor document (MODEL-01/02).
        const scene = sceneFromFrameDraft(draft);
        const clip: TimelineClip = {
          id: uid("clip"),
          kind: "scene",
          sceneId: scene.id,
          laneId: placement.laneId,
          startTime: placement.startTime,
          duration: scene.duration,
          name: draft.name,
        };
        const wasEmpty = state.timelineClips.length === 0;
        const timelineClips = [...state.timelineClips, clip];
        const nextProject = rebuildMainProject(
          { ...project, scenes: [...project.scenes, scene] },
          timelineClips,
          lanes,
        );
        const nextLanes = normalizeLaneOrders(lanes);
        return {
          project: nextProject,
          timelineLanes: nextLanes,
          timelineClips,
          selection: selectionClips([clip.id]),
          ...(wasEmpty
            ? {
                timelineFitAnchorSeconds: clip.duration,
                timelineZoomMode: "fit",
                timelineZoomScale: 1.0,
                timelineZoom: 50,
                timelineFitRevision: state.timelineFitRevision + 1,
              }
            : {}),
        };
      });
    },

    /** 3.21 Thêm audio clip + lane (CapCut-style dưới main) */
    addAudioClipFromLibrary: (item, target) => {
      set((state) => {
        const project = state.project;
        if (!project) return state;

        let lanes = state.timelineLanes.length
          ? state.timelineLanes
          : [ensureBaseLane([])];
        const baseLane = ensureBaseLane(lanes);
        if (!lanes.some((lane) => lane.id === baseLane.id)) {
          lanes = [...lanes, baseLane];
        }

        const duration = Math.max(0.5, item.duration ?? 10);
        const startTime = Math.max(0, target.startTime);
        const insertNew = target.insertNewLane ?? false;
        const placement = resolveAudioPlacement(
          lanes,
          state.timelineClips,
          startTime,
          duration,
          insertNew ? null : (target.laneId ?? null),
          insertNew || !target.laneId,
          insertNew ? (target.insertOrder ?? null) : null,
        );
        if (!placement) return state;
        lanes = placement.lanes;

        const assetId = item.assetId;
        const existingAsset = project.assets.find((a) => a.id === assetId);
        const audioAsset = existingAsset
          ? null
          : {
              id: assetId,
              assetType: "audio" as const,
              uri:
                item.src ||
                "https://actions.google.com/sounds/v1/ambiences/outdoor_theme_park.ogg",
              mimeType: "audio/mpeg" as const,
              codec: "mp3",
              duration,
              sampleRate: 44100,
              channels: 2,
            };
        const assets = audioAsset
          ? [...project.assets, audioAsset]
          : project.assets.map((asset) =>
              asset.id === assetId && asset.assetType === "audio"
                ? { ...asset, duration: asset.duration ?? duration }
                : asset,
            );

        const trackId = uid("audio");
        const newTrack = {
          id: trackId,
          role: "bgm" as const,
          assetId,
          start: placement.startTime,
          trimStart: 0,
          volume: 1,
          loop: false,
          fadeIn: 0,
          fadeOut: 0,
        };

        const clip: TimelineClip = {
          id: trackId,
          kind: "audio",
          audioTrackId: trackId,
          assetId,
          laneId: placement.laneId,
          startTime: placement.startTime,
          duration,
          name: item.title,
        };
        const wasEmpty = state.timelineClips.length === 0;
        const timelineClips = [...state.timelineClips, clip];
        const nextLanes = normalizeLaneOrders(lanes);

        return {
          project: {
            ...project,
            assets,
            timeline: {
              ...project.timeline,
              audioTracks: [...project.timeline.audioTracks, newTrack],
            },
          },
          timelineLanes: nextLanes,
          timelineClips,
          selection: selectionClips([clip.id]),
          ...(wasEmpty
            ? {
                timelineFitAnchorSeconds: clip.duration,
                timelineZoomMode: "fit",
                timelineZoomScale: 1.0,
                timelineZoom: 50,
                timelineFitRevision: state.timelineFitRevision + 1,
              }
            : {}),
        };
      });
    },

    /** Convenience: append audio at t=0 on a free audio lane. */
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
      set((state) => {
        const project = state.project;
        const existing = state.timelineClips.find((clip) => clip.id === clipId);
        if (!project || !existing) return state;
        // Lane locked → không move/placement (Phase 6).
        if (
          selectionHasLockedLane(state.timelineClips, state.timelineLanes, [
            clipId,
          ])
        ) {
          return state;
        }
        const startTime = Math.max(0, patch.startTime);
        let lanes = state.timelineLanes.length
          ? state.timelineLanes
          : [ensureBaseLane([])];
        const baseLane = ensureBaseLane(lanes);
        if (!lanes.some((lane) => lane.id === baseLane.id)) {
          lanes = [...lanes, baseLane];
        }
        const clips = state.timelineClips.filter((clip) => clip.id !== clipId);
        let nextProject = project;
        let moved: TimelineClip;
        const existingOnBase = isBaseLane(lanes, existing.laneId);
        const existingOnAudio = isAudioLane(lanes, existing.laneId);

        if (patch.track === "audio") {
          if (!existingOnAudio) return state;
          const insertNew = patch.insertNewLane ?? false;
          const preferredLaneId = insertNew
            ? null
            : (patch.laneId ??
              (patch.insertOrder != null
                ? (audioLaneIdByOrder(lanes, patch.insertOrder) ?? null)
                : existing.laneId));
          const preferredInsertOrder = insertNew
            ? (patch.insertOrder ?? null)
            : null;
          const placement = resolveAudioPlacement(
            lanes,
            clips,
            startTime,
            existing.duration,
            preferredLaneId,
            insertNew,
            preferredInsertOrder,
            clipId,
          );
          if (!placement) return state;
          lanes = placement.lanes;
          if (existing.kind !== "audio") return state;
          moved = {
            ...existing,
            kind: "audio",
            laneId: placement.laneId,
            startTime: placement.startTime,
          };
          clips.push(moved);
          lanes = pruneEmptyLanes(lanes, clips);
          nextProject = {
            ...project,
            timeline: {
              ...project.timeline,
              audioTracks: project.timeline.audioTracks.map((track) =>
                track.id === existing.audioTrackId || track.id === moved.id
                  ? { ...track, start: placement.startTime }
                  : track,
              ),
            },
          };
          return {
            project: nextProject,
            timelineLanes: lanes,
            timelineClips: clips,
            selection: selectionClips([moved.id]),
          };
        }

        if (patch.track === "overlay") {
          if (existingOnAudio || existing.kind !== "scene") return state;
          const insertNew = patch.insertNewLane ?? false;
          const intent: VisualPlacementIntent = insertNew
            ? {
                type: "new-overlay-lane",
                insertOrder: patch.insertOrder ?? 0,
                startTime,
                duration: existing.duration,
              }
            : {
                type: "overlay-lane",
                laneId: patch.laneId ?? (existingOnBase ? "" : existing.laneId),
                startTime,
                duration: existing.duration,
              };
          if (intent.type === "overlay-lane" && !intent.laneId) {
            // Main → overlay body không có laneId → tạo lane mới.
            const placement = applyVisualPlacement(
              lanes,
              clips,
              {
                type: "new-overlay-lane",
                insertOrder: patch.insertOrder ?? 0,
                startTime,
                duration: existing.duration,
              },
              clipId,
            );
            if (!placement) return state;
            lanes = placement.lanes;
            moved = {
              ...existing,
              kind: "scene",
              sceneId: existing.sceneId,
              laneId: placement.laneId,
              startTime: placement.startTime,
            };
          } else {
            const placement = applyVisualPlacement(
              lanes,
              clips,
              intent,
              clipId,
            );
            if (!placement) return state;
            lanes = placement.lanes;
            moved = {
              ...existing,
              kind: "scene",
              sceneId: existing.sceneId,
              laneId: placement.laneId,
              startTime: placement.startTime,
            };
          }
        } else {
          if (existingOnAudio || existing.kind !== "scene") return state;
          const placed = resolveVisualPlacement(
            lanes,
            clips,
            {
              type: "base",
              startTime,
              duration: existing.duration,
            },
            clipId,
          );
          if (placed.status !== "placed") return state;
          moved = {
            ...existing,
            kind: "scene",
            sceneId: existing.sceneId,
            laneId: placed.laneId,
            startTime: placed.startTime,
          };
        }

        clips.push(moved);
        lanes = pruneEmptyLanes(lanes, clips);
        nextProject = rebuildMainProject(nextProject, clips, lanes);
        return {
          project: nextProject,
          timelineLanes: lanes,
          timelineClips: clips,
          selection: selectionClips([moved.id]),
        };
      });
    },

    /* ========================================================================== */
    /* 4. CLIP DELETION & SPLITTING                                               */
    /* ========================================================================== */

    deleteSelectedClips: () => {
      set((state) => {
        const project = state.project;
        const ids = new Set(selectedClipIdsFrom(state.selection));
        if (!project || ids.size === 0) return state;
        if (
          selectionHasLockedLane(state.timelineClips, state.timelineLanes, ids)
        ) {
          return state;
        }

        const removed = state.timelineClips.filter((clip) => ids.has(clip.id));
        const remaining = state.timelineClips.filter(
          (clip) => !ids.has(clip.id),
        );
        const removedMainSceneIds = new Set(
          removed
            .filter(
              (clip) =>
                clip.kind === "scene" &&
                (isBaseLane(state.timelineLanes, clip.laneId) ||
                  isOverlayLane(state.timelineLanes, clip.laneId)),
            )
            .map((clip) => (clip.kind === "scene" ? clip.sceneId : "")),
        );
        const removedAudioIds = new Set(
          removed
            .filter((clip) => clip.kind === "audio")
            .map((clip) =>
              clip.kind === "audio" ? clip.audioTrackId : clip.id,
            ),
        );

        let nextProject: MotionProject = {
          ...project,
          scenes: project.scenes.filter(
            (scene) => !removedMainSceneIds.has(scene.id),
          ),
          timeline: {
            ...project.timeline,
            audioTracks: project.timeline.audioTracks.filter(
              (track) => !removedAudioIds.has(track.id),
            ),
          },
        };
        const lanes = pruneEmptyLanes(state.timelineLanes, remaining);
        nextProject = rebuildMainProject(nextProject, remaining, lanes);
        const isEmpty = remaining.length === 0;
        return {
          project: nextProject,
          timelineLanes: lanes,
          timelineClips: remaining,
          selection: selectionNone(),
          ...(isEmpty
            ? {
                timelineFitAnchorSeconds: null,
                timelineZoomMode: "fit",
                timelineZoomScale: 1.0,
                timelineZoom: 50,
                timelineFitRevision: state.timelineFitRevision + 1,
              }
            : {}),
        };
      });
    },

    splitSelectedClipsAt: (time) => {
      set((state) => {
        const project = state.project;
        if (!project) return state;
        if (
          selectionHasLockedLane(
            state.timelineClips,
            state.timelineLanes,
            selectedClipIdsFrom(state.selection),
          )
        ) {
          return state;
        }
        const t = Math.max(0, time);
        const selected = state.timelineClips.filter((clip) =>
          selectedClipIdsFrom(state.selection).includes(clip.id),
        );
        const splittable = selected.filter((clip) =>
          playheadSplitsClip(clip, t),
        );
        if (splittable.length === 0) return state;

        let lanes = state.timelineLanes;
        let clips = [...state.timelineClips];
        let scenes = [...project.scenes];
        let audioTracks = [...project.timeline.audioTracks];
        const newSelection: string[] = [];

        for (const clip of splittable) {
          const leftDur = t - clip.startTime;
          const rightDur = clip.startTime + clip.duration - t;
          if (leftDur < MIN_CLIP_SLICE_SEC || rightDur < MIN_CLIP_SLICE_SEC) {
            continue;
          }

          if (isBaseLane(lanes, clip.laneId) && clip.kind === "scene") {
            scenes = scenes.map((scene) =>
              scene.id === clip.sceneId
                ? { ...scene, duration: leftDur }
                : scene,
            );
            const leftScene = scenes.find((s) => s.id === clip.sceneId);
            if (!leftScene) continue;
            const rightScene = cloneSceneWithNewIds({
              ...leftScene,
              duration: rightDur,
            });
            scenes = [...scenes, rightScene];
            clips = clips.map((c) =>
              c.id === clip.id ? { ...c, duration: leftDur } : c,
            );
            const rightClip: TimelineClip = {
              id: rightScene.id,
              kind: "scene",
              sceneId: rightScene.id,
              laneId: clip.laneId,
              startTime: t,
              duration: rightDur,
              name: clip.name,
            };
            clips = [...clips, rightClip];
            newSelection.push(clip.id, rightClip.id);
          } else if (isAudioLane(lanes, clip.laneId)) {
            const trackIdKey =
              clip.kind === "audio" ? (clip.audioTrackId ?? clip.id) : clip.id;
            const track = audioTracks.find(
              (tr) => tr.id === trackIdKey || tr.id === clip.id,
            );
            clips = clips.map((c) =>
              c.id === clip.id ? { ...c, duration: leftDur } : c,
            );
            const trackId = uid("audio");
            const assetId =
              (clip.kind === "audio" ? clip.assetId : undefined) ??
              track?.assetId ??
              clip.name;
            audioTracks = [
              ...audioTracks.map((tr) =>
                tr.id === track?.id ? { ...tr, start: clip.startTime } : tr,
              ),
              {
                id: trackId,
                role: "bgm" as const,
                assetId,
                start: t,
                trimStart: (track?.trimStart ?? 0) + leftDur,
                volume: track?.volume ?? 1,
                loop: false,
                fadeIn: 0,
                fadeOut: 0,
              },
            ];
            const rightClip: TimelineClip = {
              id: trackId,
              kind: "audio",
              audioTrackId: trackId,
              assetId,
              laneId: clip.laneId,
              startTime: t,
              duration: rightDur,
              name: clip.name,
            };
            clips = [...clips, rightClip];
            newSelection.push(clip.id, rightClip.id);
          } else if (clip.kind === "scene") {
            scenes = scenes.map((scene) =>
              scene.id === clip.sceneId
                ? { ...scene, duration: leftDur }
                : scene,
            );
            const leftScene = scenes.find((s) => s.id === clip.sceneId);
            if (!leftScene) continue;
            const rightScene = cloneSceneWithNewIds({
              ...leftScene,
              duration: rightDur,
            });
            scenes = [...scenes, rightScene];
            clips = clips.map((c) =>
              c.id === clip.id ? { ...c, duration: leftDur } : c,
            );
            const rightClip: TimelineClip = {
              id: uid("clip"),
              kind: "scene",
              sceneId: rightScene.id,
              laneId: clip.laneId,
              startTime: t,
              duration: rightDur,
              name: clip.name,
            };
            clips = [...clips, rightClip];
            newSelection.push(clip.id, rightClip.id);
          }
        }

        if (newSelection.length === 0) return state;

        let nextProject: MotionProject = {
          ...project,
          scenes,
          timeline: { ...project.timeline, audioTracks },
        };
        lanes = normalizeLaneOrders(lanes);
        nextProject = rebuildMainProject(nextProject, clips, lanes);
        return {
          project: nextProject,
          timelineLanes: lanes,
          timelineClips: clips,
          selection: selectionClips(newSelection),
        };
      });
    },
  };
}
