"use client";

import { create } from "zustand";
import { type ClipClipboardItem } from "@/lib/editor/clip-clipboard";
import {
  selectionClips,
  selectedClipIdsFrom,
} from "@/lib/editor/model/editor-selection";
import {
  isLaneLocked,
  selectionHasLockedLane,
} from "@/lib/editor/operations/lane-flags";
import { createClipActions } from "@/lib/editor/store/actions/clip-actions";
import { createDocumentActions } from "@/lib/editor/store/actions/document-actions";
import { createLaneActions } from "@/lib/editor/store/actions/lane-actions";
import { createProjectLifecycleActions } from "@/lib/editor/store/actions/project-lifecycle-actions";
import { createSelectionActions } from "@/lib/editor/store/actions/selection-actions";
import { createUiActions } from "@/lib/editor/store/actions/ui-actions";
import { createInitialEditorState } from "@/lib/editor/store/initial-state";
import {
  resolveAudioPlacement,
  resolveOverlayPlacement,
} from "@/lib/editor/store/internal/placement-adapter";
import {
  cloneSceneWithNewIds,
  sceneFromFrameDraft,
  uid,
} from "@/lib/editor/store/internal/scene-utils";
import { rebuildMainProject } from "@/lib/editor/store/internal/timeline-project-sync";
import {
  ensureMainLane,
  isAudioLane,
  isMainLane,
  pruneEmptyLanes,
  resolveMainStartTime,
  type TimelineClip,
} from "@/lib/editor/timeline-clips";
import {
  parseMotionProject,
  type MotionProject,
  type MotionScene,
} from "@motionvideo/motion-schema";
import { validateMotionProjectPresets } from "@motionvideo/template-library";
import type { EditorState } from "@/lib/editor/store/types";

export type { OverlaySceneItem } from "@/lib/editor/overlay-scenes";
export type { TimelineClip, TimelineLane } from "@/lib/editor/timeline-clips";
export type {
  EditorState,
  EditorStore,
  EditorStoreActions,
  EditorStoreState,
  SidebarTabId,
} from "@/lib/editor/store/types";
export { nodeText } from "@/lib/editor/store/internal/scene-utils";

/* ==========================================================================
   2. Các hàm trợ giúp xử lý nội bộ (Helper Utilities)
   ========================================================================== */

/* ==========================================================================
   3. Tạo Zustand Store chính (useEditorStore)
   ========================================================================== */

export const useEditorStore = create<EditorState>((set, get) => ({
  ...createInitialEditorState(),
  ...createUiActions(set),
  ...createSelectionActions(set, get),
  ...createLaneActions(set),
  ...createDocumentActions(set, get),
  ...createProjectLifecycleActions(set),

  ...createClipActions(set, get),

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
      const kind = isMainLane(state.timelineLanes, clip.laneId)
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
    // Locked → no-op hoàn toàn (không copy rồi fail delete).
    if (selectionHasLockedLane(state.timelineClips, state.timelineLanes, ids)) {
      return;
    }
    get().copySelectedClips();
    get().deleteSelectedClips();
  },

  pasteClips: (atTime = 0) => {
    const clipboard = get().timelineClipboard;
    if (!clipboard || clipboard.length === 0) return;
    const pasteAt = Math.max(0, atTime);
    const newIds: string[] = [];

    set((state) => {
      const project = state.project;
      if (!project || !clipboard.length) return state;
      let lanes = state.timelineLanes.length
        ? state.timelineLanes
        : [ensureMainLane([])];
      const mainLane = ensureMainLane(lanes);
      if (!lanes.some((lane) => lane.id === mainLane.id)) {
        lanes = [...lanes, mainLane];
      }
      let clips = [...state.timelineClips];
      let nextProject = project;
      let scenes = [...project.scenes];
      let audioTracks = [...project.timeline.audioTracks];

      for (const item of clipboard) {
        const startTime = pasteAt + item.offsetStart;
        if (item.kind === "main" && item.scene) {
          if (isLaneLocked(lanes, mainLane.id)) continue;
          const scene = cloneSceneWithNewIds({
            ...item.scene,
            duration: item.duration,
            name: item.name,
          });
          scenes = [...scenes, scene];
          const resolvedStart = resolveMainStartTime(
            clips,
            lanes,
            startTime,
            item.duration,
          );
          const clip: TimelineClip = {
            id: scene.id,
            kind: "scene",
            sceneId: scene.id,
            laneId: mainLane.id,
            startTime: resolvedStart,
            duration: item.duration,
            name: item.name,
          };
          clips = [...clips, clip];
          newIds.push(clip.id);
        } else if (item.kind === "audio") {
          const placement = resolveAudioPlacement(
            lanes,
            clips,
            startTime,
            item.duration,
            null,
            true,
            null,
          );
          if (!placement) continue;
          lanes = placement.lanes;
          const trackId = uid("audio");
          audioTracks = [
            ...audioTracks,
            {
              id: trackId,
              role: "bgm" as const,
              assetId: item.audioAssetId ?? item.name,
              start: placement.startTime,
              trimStart: 0,
              volume: 1,
              loop: false,
              fadeIn: 0,
              fadeOut: 0,
            },
          ];
          const clip: TimelineClip = {
            id: trackId,
            kind: "audio",
            audioTrackId: trackId,
            assetId: item.audioAssetId ?? item.name,
            laneId: placement.laneId,
            startTime: placement.startTime,
            duration: item.duration,
            name: item.name,
          };
          clips = [...clips, clip];
          newIds.push(clip.id);
        } else if (item.scene) {
          // Overlay với scene content — giữ scene thật.
          const placement = resolveOverlayPlacement(
            lanes,
            clips,
            startTime,
            item.duration,
            null,
            true,
            null,
          );
          if (!placement) continue;
          lanes = placement.lanes;
          const scene = cloneSceneWithNewIds({
            ...item.scene,
            duration: item.duration,
            name: item.name,
          });
          scenes = [...scenes, scene];
          const clip: TimelineClip = {
            id: uid("clip"),
            kind: "scene",
            sceneId: scene.id,
            laneId: placement.laneId,
            startTime: placement.startTime,
            duration: item.duration,
            name: item.name,
          };
          clips = [...clips, clip];
          newIds.push(clip.id);
        } else {
          const placement = resolveOverlayPlacement(
            lanes,
            clips,
            startTime,
            item.duration,
            null,
            true,
            null,
          );
          if (!placement) continue;
          lanes = placement.lanes;
          const scene = sceneFromFrameDraft({
            id: uid("draft"),
            name: item.name,
            duration: item.duration,
            text: item.name,
          });
          scenes = [...scenes, scene];
          const clip: TimelineClip = {
            id: uid("clip"),
            kind: "scene",
            sceneId: scene.id,
            laneId: placement.laneId,
            startTime: placement.startTime,
            duration: item.duration,
            name: item.name,
          };
          clips = [...clips, clip];
          newIds.push(clip.id);
        }
      }

      nextProject = {
        ...nextProject,
        scenes,
        timeline: { ...nextProject.timeline, audioTracks },
      };
      lanes = pruneEmptyLanes(lanes, clips);
      nextProject = rebuildMainProject(nextProject, clips, lanes);
      return {
        project: nextProject,
        timelineLanes: lanes,
        timelineClips: clips,
        selection: selectionClips(newIds),
      };
    });
  },

  duplicateSelectedClips: () => {
    set((s) => {
      const project = s.project;
      if (!project) return s;
      const selectedIds = selectedClipIdsFrom(s.selection);
      if (selectionHasLockedLane(s.timelineClips, s.timelineLanes, selectedIds)) {
        return s;
      }
      let lanes = s.timelineLanes;
      let clips = [...s.timelineClips];
      let scenes = [...project.scenes];
      let audioTracks = [...project.timeline.audioTracks];
      const newIds: string[] = [];
      const toDup = clips
        .filter((c) => selectedIds.includes(c.id))
        .sort((a, b) => a.startTime - b.startTime);

      if (toDup.length === 0) return s;

      for (const clip of toDup) {
        const startTime = clip.startTime + clip.duration;
        if (isMainLane(lanes, clip.laneId) && clip.kind === "scene") {
          if (isLaneLocked(lanes, clip.laneId)) continue;
          const scene = scenes.find((sc) => sc.id === clip.sceneId);
          if (!scene) continue;
          const cloned = cloneSceneWithNewIds(scene);
          scenes = [...scenes, cloned];
          const resolvedStart = resolveMainStartTime(
            clips,
            lanes,
            startTime,
            clip.duration,
          );
          const next: TimelineClip = {
            id: cloned.id,
            kind: "scene",
            sceneId: cloned.id,
            laneId: clip.laneId,
            startTime: resolvedStart,
            duration: clip.duration,
            name: clip.name,
          };
          clips = [...clips, next];
          newIds.push(next.id);
        } else if (isAudioLane(lanes, clip.laneId)) {
          if (isLaneLocked(lanes, clip.laneId)) continue;
          const trackIdKey =
            clip.kind === "audio" ? clip.audioTrackId ?? clip.id : clip.id;
          const track = audioTracks.find((t) => t.id === trackIdKey || t.id === clip.id);
          const placement = resolveAudioPlacement(
            lanes,
            clips,
            startTime,
            clip.duration,
            clip.laneId,
            false,
            null,
          );
          if (!placement) continue;
          lanes = placement.lanes;
          const trackId = uid("audio");
          audioTracks = [
            ...audioTracks,
            {
              id: trackId,
              role: "bgm" as const,
              assetId:
                (clip.kind === "audio" ? clip.assetId : undefined) ??
                track?.assetId ??
                clip.name,
              start: placement.startTime,
              trimStart: 0,
              volume: 1,
              loop: false,
              fadeIn: 0,
              fadeOut: 0,
            },
          ];
          const next: TimelineClip = {
            id: trackId,
            kind: "audio",
            audioTrackId: trackId,
            assetId:
              (clip.kind === "audio" ? clip.assetId : undefined) ??
              track?.assetId ??
              clip.name,
            laneId: placement.laneId,
            startTime: placement.startTime,
            duration: clip.duration,
            name: clip.name,
          };
          clips = [...clips, next];
          newIds.push(next.id);
        } else if (clip.kind === "scene") {
          if (isLaneLocked(lanes, clip.laneId)) continue;
          const placement = resolveOverlayPlacement(
            lanes,
            clips,
            startTime,
            clip.duration,
            clip.laneId,
            false,
            null,
          );
          if (!placement) continue;
          lanes = placement.lanes;
          const scene = scenes.find((sc) => sc.id === clip.sceneId);
          if (scene) {
            const cloned = cloneSceneWithNewIds(scene);
            scenes = [...scenes, cloned];
            const next: TimelineClip = {
              id: uid("clip"),
              kind: "scene",
              sceneId: cloned.id,
              laneId: placement.laneId,
              startTime: placement.startTime,
              duration: clip.duration,
              name: clip.name,
            };
            clips = [...clips, next];
            newIds.push(next.id);
          }
        }
      }

      let nextProject: MotionProject = {
        ...project,
        scenes,
        timeline: { ...project.timeline, audioTracks },
      };
      lanes = pruneEmptyLanes(lanes, clips);
      nextProject = rebuildMainProject(nextProject, clips, lanes);
      return {
        project: nextProject,
        timelineLanes: lanes,
        timelineClips: clips,
        selection: selectionClips(newIds),
      };
    });
  },

}));


/* ==========================================================================
   4. Kiểm tra và chuẩn hóa cấu trúc dữ liệu dự án (Project Validation)
   ========================================================================== */

/** Kiểm tra và chuẩn hóa dự án (sanitize audio assets & validate presets) */
export function validateEditorProject(project: MotionProject): MotionProject {
  const sanitizedAssets = project.assets.map((asset) => {
    if (asset.assetType === "audio") {
      return {
        ...asset,
        mimeType: asset.mimeType ?? "audio/mpeg",
        codec: asset.codec ?? "mp3",
      };
    }
    return asset;
  });
  const sanitizedProject = { ...project, assets: sanitizedAssets };
  const parsed = parseMotionProject(sanitizedProject);
  const presets = validateMotionProjectPresets(parsed);
  if (!presets.ok)
    throw new Error(
      `Unknown presets: ${presets.unknown.map((item) => item.preset).join(", ")}`,
    );
  return parsed;
}
