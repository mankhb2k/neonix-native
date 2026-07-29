"use client";

import { create } from "zustand";
import {
  type ClipClipboardItem,
  MIN_CLIP_SLICE_SEC,
  playheadSplitsClip,
} from "@/lib/editor/clip-clipboard";
import { TIMELINE_ZOOM_ON_PROJECT_LOAD } from "@/lib/editor/editor-preferences";
import {
  selectionClips,
  selectionNone,
  selectionNode,
  selectedClipIdsFrom,
  selectedSceneIdFrom,
} from "@/lib/editor/model/editor-selection";
import {
  applyRippleAfter,
  createOverlayLaneAt,
  resolveAudioPlacementIntent,
  resolveVisualPlacement,
  type AudioPlacementIntent,
  type VisualPlacementIntent,
} from "@/lib/editor/operations/clip-move";
import {
  applyLaneFlagPatch,
  isLaneLocked,
  selectionHasLockedLane,
} from "@/lib/editor/operations/lane-flags";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import { createInitialEditorState } from "@/lib/editor/store/initial-state";
import {
  cloneSceneWithNewIds,
  mapNode,
  sceneFromFrameDraft,
  uid,
  updateVariable,
} from "@/lib/editor/store/internal/scene-utils";
import {
  createAudioLane,
  clipsContentEndSeconds,
  ensureAudioClipsFromTracks,
  ensureMainLane,
  isAudioLane,
  isMainLane,
  isOverlayLane,
  migrateLanesAndClips,
  pruneEmptyLanes,
  resolveMainStartTime,
  reorderOverlayLane,
  shiftAudioLaneOrders,
  type TimelineClip,
  type TimelineLane,
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

/** Giữ mọi scene được visual clip tham chiếu; sceneOrder chỉ từ base lane. */
function rebuildMainProject(
  project: MotionProject,
  clips: TimelineClip[],
  lanes: TimelineLane[],
): MotionProject {
  const byId = new Map(project.scenes.map((scene) => [scene.id, scene]));
  const mainId = lanes.find(
    (lane) => lane.kind === "visual" && lane.role === "base",
  )?.id;
  const main = clips
    .filter((clip): clip is Extract<TimelineClip, { kind: "scene" }> =>
      clip.kind === "scene" && clip.laneId === mainId,
    )
    .sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));
  const sceneOrder = main
    .map((clip) => clip.sceneId)
    .filter((sceneId) => byId.has(sceneId));

  // Overlay/base đều giữ scene content — không xóa khi đổi lane (MODEL-02).
  const referenced = new Set(
    clips
      .filter((clip) => clip.kind === "scene")
      .map((clip) => (clip.kind === "scene" ? clip.sceneId : ""))
      .filter((sceneId) => sceneId && byId.has(sceneId)),
  );
  const orderedIds = [
    ...sceneOrder,
    ...[...referenced].filter((id) => !sceneOrder.includes(id)),
  ];
  return {
    ...project,
    scenes: orderedIds.map((sceneId) => byId.get(sceneId)!),
    timeline: { ...project.timeline, sceneOrder },
  };
}

function applyVisualPlacement(
  lanes: TimelineLane[],
  clips: TimelineClip[],
  intent: VisualPlacementIntent,
  movingClipId?: string,
): { lanes: TimelineLane[]; laneId: string; startTime: number } | null {
  const resolved = resolveVisualPlacement(
    lanes,
    clips,
    intent,
    movingClipId,
  );
  if (resolved.status === "blocked") return null;
  if (resolved.status === "create-lane") {
    const created = createOverlayLaneAt(lanes, resolved.insertOrder);
    return {
      lanes: created.lanes,
      laneId: created.lane.id,
      startTime: resolved.startTime,
    };
  }
  return {
    lanes,
    laneId: resolved.laneId,
    startTime: resolved.startTime,
  };
}

function applyAudioPlacement(
  lanes: TimelineLane[],
  clips: TimelineClip[],
  intent: AudioPlacementIntent,
  movingClipId?: string,
): { lanes: TimelineLane[]; laneId: string; startTime: number } | null {
  const resolved = resolveAudioPlacementIntent(
    lanes,
    clips,
    intent,
    movingClipId,
  );
  if (resolved.status === "blocked") return null;
  if (resolved.status === "create-lane") {
    let nextLanes = shiftAudioLaneOrders(lanes, resolved.insertOrder, 1);
    const created = createAudioLane(resolved.insertOrder);
    nextLanes = [...nextLanes, created];
    return {
      lanes: nextLanes,
      laneId: created.id,
      startTime: resolved.startTime,
    };
  }
  return {
    lanes,
    laneId: resolved.laneId,
    startTime: resolved.startTime,
  };
}

/** Map flags → intent rồi applyVisualPlacement (paste/duplicate helpers). */
function resolveOverlayPlacement(
  lanes: TimelineLane[],
  clips: TimelineClip[],
  startTime: number,
  duration: number,
  preferredLaneId: string | null,
  insertNew: boolean,
  preferredInsertOrder?: number | null,
  movingClipId?: string,
): { lanes: TimelineLane[]; laneId: string; startTime: number } | null {
  const intent: VisualPlacementIntent =
    insertNew || !preferredLaneId
      ? {
          type: "new-overlay-lane",
          insertOrder: preferredInsertOrder ?? 0,
          startTime,
          duration,
        }
      : {
          type: "overlay-lane",
          laneId: preferredLaneId,
          startTime,
          duration,
        };
  return applyVisualPlacement(lanes, clips, intent, movingClipId);
}

/** Sau resize: đẩy clip overlap trên cùng lane; ripple nếu policy bật. */
function resolveCollisionsAfterResize(
  clips: TimelineClip[],
  lanes: TimelineLane[],
  resizedClipId: string,
): TimelineClip[] {
  const resized = clips.find((clip) => clip.id === resizedClipId);
  if (!resized) return clips;
  const lane = lanes.find((l) => l.id === resized.laneId);
  const rippleMode =
    lane?.kind === "visual" ? Boolean(lane.policy.rippleMode) : false;
  const others = clips
    .filter(
      (clip) =>
        clip.laneId === resized.laneId &&
        clip.id !== resized.id &&
        clip.startTime >= resized.startTime,
    )
    .sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));

  let next = clips;
  let cursor = resized.startTime + resized.duration;
  for (const other of others) {
    if (other.startTime >= cursor) {
      cursor = other.startTime + other.duration;
      continue;
    }
    const delta = cursor - other.startTime;
    next = next.map((clip) =>
      clip.id === other.id ? { ...clip, startTime: cursor } : clip,
    );
    if (rippleMode) {
      next = applyRippleAfter(
        next,
        resized.laneId,
        other.startTime + 1e-6,
        delta,
        true,
      );
    }
    cursor += other.duration;
  }
  return next;
}

function resolveAudioPlacement(
  lanes: TimelineLane[],
  clips: TimelineClip[],
  startTime: number,
  duration: number,
  preferredLaneId: string | null,
  insertNew: boolean,
  preferredInsertOrder?: number | null,
  movingClipId?: string,
): { lanes: TimelineLane[]; laneId: string; startTime: number } | null {
  if (insertNew) {
    return applyAudioPlacement(
      lanes,
      clips,
      {
        type: "new-audio-lane",
        insertOrder: preferredInsertOrder ?? 0,
        startTime,
        duration,
      },
      movingClipId,
    );
  }
  if (!preferredLaneId) {
    // Không có lane đích → tạo lane mới thay vì scan arbitrary.
    return applyAudioPlacement(
      lanes,
      clips,
      {
        type: "new-audio-lane",
        insertOrder: preferredInsertOrder ?? 0,
        startTime,
        duration,
      },
      movingClipId,
    );
  }
  return applyAudioPlacement(
    lanes,
    clips,
    {
      type: "audio-lane",
      laneId: preferredLaneId,
      startTime,
      duration,
    },
    movingClipId,
  );
}

function audioLaneIdByOrder(
  lanes: TimelineLane[],
  order: number,
): string | undefined {
  return lanes.find((lane) => lane.kind === "audio" && lane.order === order)?.id;
}

function selectionStateForClip(clip: TimelineClip | undefined) {
  if (!clip) return { selection: selectionNone() };
  return { selection: selectionClips([clip.id]) };
}

/* ==========================================================================
   3. Tạo Zustand Store chính (useEditorStore)
   ========================================================================== */

export const useEditorStore = create<EditorState>((set, get) => ({
  ...createInitialEditorState(),

  setActiveDragItem: (item) => set({ activeDragItem: item }),
  setIsOverTimeline: (over) => set({ isOverTimeline: over }),
  setTimelineZoom: (zoom) => set({ timelineZoom: zoom }),

  /** 3.1 Nạp dự án vào Editor Store */
  loadProject: (input, overlayScenes = [], storedClips = [], storedLanes = []) => {
    const project = parseMotionProject(input);
    const { lanes: migratedLanes, clips: migratedClips } = migrateLanesAndClips(
      project,
      overlayScenes,
      storedClips,
      storedLanes,
    );
    const { lanes: withAudioLanes, clips: withAudioClips } =
      ensureAudioClipsFromTracks(project, migratedLanes, migratedClips);
    const lanes = pruneEmptyLanes(withAudioLanes, withAudioClips);
    const clips = withAudioClips;
    const mainId = lanes.find((lane) => lane.kind === "visual" && lane.role === "base")?.id;
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

  selectClip: (clipId) => {
    get().setSelectedClipIds([clipId]);
  },

  setSelectedClipIds: (clipIds) => {
    const unique = [...new Set(clipIds.filter(Boolean))];
    set({ selection: selectionClips(unique) });
  },

  clearTimelineSelection: () => {
    set({ selection: selectionNone() });
  },

  /** 3.3 Chọn Node (thành phần đồ họa) đang hoạt động */
  selectNode: (nodeId) => {
    set((state) => {
      if (!nodeId) {
        const current = state.selection;
        if (current.kind !== "node") return state;
        const clip = state.timelineClips.find(
          (c) =>
            c.kind === "scene" &&
            c.sceneId === current.sceneId &&
            isMainLane(state.timelineLanes, c.laneId),
        );
        return {
          selection: clip ? selectionClips([clip.id]) : selectionNone(),
        };
      }
      const sceneId =
        selectedSceneIdFrom(
          state.selection,
          state.timelineClips,
          state.timelineLanes,
        ) ?? state.project?.scenes[0]?.id;
      if (!sceneId) return state;
      return { selection: selectionNode(sceneId, nodeId) };
    });
  },

  /** 3.4 Thay đổi Tab Sidebar đang hiển thị */
  setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab }),

  renameLane: (laneId, name) => {
    set((state) => ({
      timelineLanes: state.timelineLanes.map((lane) =>
        lane.id === laneId ? { ...lane, name } : lane),
    }));
  },

  updateLaneFlags: (laneId, patch) => {
    set((state) => ({
      timelineLanes: applyLaneFlagPatch(state.timelineLanes, laneId, patch),
    }));
  },

  reorderLane: (laneId, newOrder) => {
    set((state) => ({
      timelineLanes: reorderOverlayLane(state.timelineLanes, laneId, newOrder),
    }));
  },

  /** 3.6 Cập nhật thông tin thương hiệu dự án */
  updateBrand: (patch) => {
    const project = get().project;
    if (!project) return;
    const brand = { ...project.metadata.brand, ...patch };
    let variables = project.variables;
    if (patch.name !== undefined) variables = updateVariable({ ...project, variables }, "project.brandName", patch.name);
    if (patch.primaryColor !== undefined) variables = updateVariable({ ...project, variables }, "project.primaryColor", patch.primaryColor);
    set({ project: { ...project, metadata: { ...project.metadata, name: patch.name ?? project.metadata.name, brand }, variables } });
  },

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

  /** 3.8 Cập nhật văn bản của Node */
  updateNodeText: (sceneId, nodeId, text) => {
    const project = get().project;
    if (!project) return;
    set({ project: mapNode(project, sceneId, nodeId, (node) => node.type === "text"
      ? { ...node, payload: { ...node.payload, text } }
      : node) });
  },

  /** 3.9 Cập nhật tọa độ X, Y của Node */
  updateNodePosition: (sceneId, nodeId, position) => {
    const project = get().project;
    if (!project) return;
    set({ project: mapNode(project, sceneId, nodeId, (node) => ({
      ...node,
      transform: { ...node.transform, x: position.x ?? node.transform.x, y: position.y ?? node.transform.y },
    })) });
  },

  /** 3.10 Cập nhật hiệu ứng hoạt họa (Animation) cho Node */
  updateNodeAnimation: (sceneId, nodeId, patch) => {
    const project = get().project;
    if (!project) return;
    set({ project: {
      ...project,
      scenes: project.scenes.map((scene) => {
        if (scene.id !== sceneId) return scene;
        const existing = scene.clips.find((clip) => clip.targetId === nodeId && clip.source.kind === "preset");
        if (!existing) {
          return {
            ...scene,
            clips: [...scene.clips, {
              id: uid("clip"),
              targetId: nodeId,
              schedule: { kind: "absolute", at: Math.max(0, patch.at ?? 0) },
              duration: Math.max(0.1, patch.duration ?? 0.6),
              playback: { iterations: 1, direction: "normal", rate: 1 },
              source: { kind: "preset", presetId: patch.presetId ?? "fade-in" },
            }],
          };
        }
        return {
          ...scene,
          clips: scene.clips.map((clip) => clip.id !== existing.id ? clip : {
            ...clip,
            schedule: patch.at !== undefined ? { kind: "absolute" as const, at: Math.max(0, patch.at) } : clip.schedule,
            duration: patch.duration !== undefined ? Math.max(0.1, patch.duration) : clip.duration,
            source: clip.source.kind === "preset" && patch.presetId !== undefined
              ? { ...clip.source, presetId: patch.presetId }
              : clip.source,
          }),
        };
      }),
    } });
  },

  /** 3.11 Thay đổi tỷ lệ khung hình video (16:9, 9:16, 1:1, ...) */
  setAspectRatio: (aspectRatio) => {
    const project = get().project;
    if (project) set({ project: { ...project, metadata: { ...project.metadata, aspectRatio } } });
  },

  addClipFromDraft: (draft, target) => {
    set((state) => {
      const project = state.project;
      if (!project) return state;
      let lanes = state.timelineLanes.length
        ? state.timelineLanes
        : [ensureMainLane([])];
      const mainLane = ensureMainLane(lanes);
      if (!lanes.some((lane) => lane.id === mainLane.id)) {
        lanes = [...lanes, mainLane];
      }
      const duration = Math.max(0.5, draft.duration || DEFAULT_FRAME_DURATION);

      if (target.track === "main") {
        if (isLaneLocked(lanes, mainLane.id)) return state;
        const scene = sceneFromFrameDraft(draft);
        const startTime = resolveMainStartTime(
          state.timelineClips,
          lanes,
          state.timelineClips
            .filter((clip) => clip.laneId === mainLane.id)
            .reduce((end, clip) => Math.max(end, clip.startTime + clip.duration), 0),
          Math.max(0.5, draft.duration || DEFAULT_FRAME_DURATION),
        );
        const clip: TimelineClip = {
          id: scene.id,
          kind: "scene",
          sceneId: scene.id,
          laneId: mainLane.id,
          startTime,
          duration: scene.duration,
          name: scene.name ?? scene.id,
        };
        const timelineClips = [...state.timelineClips, clip];
        const nextProject = rebuildMainProject(
          { ...project, scenes: [...project.scenes, scene] },
          timelineClips,
          lanes,
        );
        const nextLanes = pruneEmptyLanes(lanes, timelineClips);
        return {
          project: nextProject,
          timelineLanes: nextLanes,
          timelineClips,
          selection: selectionClips([clip.id]),
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
      const timelineClips = [...state.timelineClips, clip];
      const nextProject = rebuildMainProject(
        { ...project, scenes: [...project.scenes, scene] },
        timelineClips,
        lanes,
      );
      const nextLanes = pruneEmptyLanes(lanes, timelineClips);
      return {
        project: nextProject,
        timelineLanes: nextLanes,
        timelineClips,
        selection: selectionClips([clip.id]),
      };
    });
  },

  moveClip: (clipId, patch) => {
    set((state) => {
      const project = state.project;
      const existing = state.timelineClips.find((clip) => clip.id === clipId);
      if (!project || !existing) return state;
      // Lane locked → không move/placement (Phase 6).
      if (selectionHasLockedLane(state.timelineClips, state.timelineLanes, [clipId])) {
        return state;
      }
      const startTime = Math.max(0, patch.startTime);
      let lanes = state.timelineLanes.length
        ? state.timelineLanes
        : [ensureMainLane([])];
      const mainLane = ensureMainLane(lanes);
      if (!lanes.some((lane) => lane.id === mainLane.id)) {
        lanes = [...lanes, mainLane];
      }
      const clips = state.timelineClips.filter((clip) => clip.id !== clipId);
      let nextProject = project;
      let moved: TimelineClip;
      const existingOnMain = isMainLane(lanes, existing.laneId);
      const existingOnAudio = isAudioLane(lanes, existing.laneId);

      if (patch.track === "audio") {
        if (!existingOnAudio) return state;
        const insertNew = patch.insertNewLane ?? false;
        const preferredLaneId = insertNew
          ? null
          : (patch.laneId ??
            (patch.insertOrder != null
              ? audioLaneIdByOrder(lanes, patch.insertOrder) ?? null
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
              laneId:
                patch.laneId ??
                (existingOnMain ? "" : existing.laneId),
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

  /** 3.21 Thêm audio clip + lane (CapCut-style dưới main) */
  addAudioClipFromLibrary: (item, target) => {
    set((state) => {
      const project = state.project;
      if (!project) return state;

      let lanes = state.timelineLanes.length
        ? state.timelineLanes
        : [ensureMainLane([])];
      const mainLane = ensureMainLane(lanes);
      if (!lanes.some((lane) => lane.id === mainLane.id)) {
        lanes = [...lanes, mainLane];
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
      const timelineClips = [...state.timelineClips, clip];
      const nextLanes = pruneEmptyLanes(lanes, timelineClips);

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

  deleteSelectedClips: () => {
    set((state) => {
      const project = state.project;
      const ids = new Set(selectedClipIdsFrom(state.selection));
      if (!project || ids.size === 0) return state;
      if (selectionHasLockedLane(state.timelineClips, state.timelineLanes, ids)) {
        return state;
      }

      const removed = state.timelineClips.filter((clip) => ids.has(clip.id));
      const remaining = state.timelineClips.filter((clip) => !ids.has(clip.id));
      const removedMainSceneIds = new Set(
        removed
          .filter(
            (clip) =>
              clip.kind === "scene" &&
              (isMainLane(state.timelineLanes, clip.laneId) ||
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
      return {
        project: nextProject,
        timelineLanes: lanes,
        timelineClips: remaining,
        ...selectionStateForClip(undefined),
      };
    });
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
      const splittable = selected.filter((clip) => playheadSplitsClip(clip, t));
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

        if (isMainLane(lanes, clip.laneId) && clip.kind === "scene") {
          scenes = scenes.map((scene) =>
            scene.id === clip.sceneId ? { ...scene, duration: leftDur } : scene,
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
            clip.kind === "audio" ? clip.audioTrackId ?? clip.id : clip.id;
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
            scene.id === clip.sceneId ? { ...scene, duration: leftDur } : scene,
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
      lanes = pruneEmptyLanes(lanes, clips);
      nextProject = rebuildMainProject(nextProject, clips, lanes);
      return {
        project: nextProject,
        timelineLanes: lanes,
        timelineClips: clips,
        selection: selectionClips(newSelection),
      };
    });
  },

  /** 3.22 Cập nhật trạng thái xuất file (Exporting) */
  setExporting: (value) => set({ isExporting: value }),
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
