"use client";

import { create } from "zustand";
import {
  parseMotionProject,
  type AspectRatio,
  type MotionNode,
  type MotionProject,
  type MotionScene,
} from "@motionvideo/motion-schema";
import { validateMotionProjectPresets } from "@motionvideo/template-library";
import type { FrameDraft } from "@/lib/frame-library";
import { DEFAULT_FRAME_DURATION } from "@/lib/frame-library";
import type { OverlaySceneItem } from "@/lib/overlay-scenes";
import {
  TIMELINE_ZOOM_DEFAULT,
  TIMELINE_ZOOM_ON_PROJECT_LOAD,
} from "@/components/desktop/editor/timeline/timeline-scale";
import {
  createOverlayLane,
  ensureMainLane,
  findFreeOverlayLane,
  isMainLane,
  migrateLanesAndClips,
  pruneEmptyOverlayLanes,
  resolveMainStartTime,
  reorderOverlayLane,
  shiftOverlayLaneOrders,
  type TimelineClip,
  type TimelineLane,
} from "@/lib/timeline-clips";

export type { OverlaySceneItem } from "@/lib/overlay-scenes";
export type { TimelineClip, TimelineLane } from "@/lib/timeline-clips";

/* ==========================================================================
   1. Các kiểu dữ liệu trạng thái (State Types)
   ========================================================================== */

export type SidebarTabId =
  | "frame"
  | "elements"
  | "text"
  | "upload"
  | "stickers"
  | "audio";

/** Cấu trúc State của Editor Zustand Store */
type EditorState = {
  project: MotionProject | null;
  selectedSceneId: string | null;
  selectedOverlayId: string | null;
  selectedClipId: string | null;
  selectedNodeId: string | null;
  isExporting: boolean;
  activeSidebarTab: SidebarTabId;
  overlayScenes: OverlaySceneItem[];
  timelineClips: TimelineClip[];
  timelineLanes: TimelineLane[];

  activeDragItem: {
    id: string;
    type: "frame" | "audio";
    name: string;
    duration: number;
  } | null;
  isOverTimeline: boolean;

  /** Timeline zoom — playback clock lives in playback-clock-store. */
  timelineZoom: number;

  setActiveDragItem: (
    item: {
      id: string;
      type: "frame" | "audio";
      name: string;
      duration: number;
    } | null,
  ) => void;
  setIsOverTimeline: (over: boolean) => void;
  loadProject: (
    project: MotionProject,
    overlayScenes?: OverlaySceneItem[],
    timelineClips?: TimelineClip[],
    timelineLanes?: TimelineLane[],
  ) => void;
  selectClip: (clipId: string) => void;
  selectScene: (sceneId: string) => void;
  selectOverlay: (overlayId: string) => void;
  clearTimelineSelection: () => void;
  selectNode: (nodeId: string | null) => void;
  setActiveSidebarTab: (tab: SidebarTabId) => void;
  updateBrand: (patch: Partial<MotionProject["metadata"]["brand"]>) => void;
  updateSceneDuration: (sceneId: string, duration: number) => void;
  updateNodeText: (sceneId: string, nodeId: string, text: string) => void;
  updateNodePosition: (sceneId: string, nodeId: string, position: { x?: number; y?: number }) => void;
  updateNodeAnimation: (sceneId: string, nodeId: string, patch: { presetId?: string; duration?: number; at?: number }) => void;
  setAspectRatio: (aspectRatio: AspectRatio) => void;
  addSceneFromFrame: (draft: FrameDraft) => void;
  addClipFromDraft: (
    draft: FrameDraft,
    target:
      | { track: "main" }
      | {
          track: "overlay";
          startTime: number;
          laneId?: string;
          insertNewLane?: boolean;
          /** @deprecated map to lane order */
          layerIndex?: number;
          insertNewLayer?: boolean;
        },
  ) => void;
  moveClip: (
    clipId: string,
    patch: {
      startTime: number;
      track: "main" | "overlay";
      laneId?: string;
      insertNewLane?: boolean;
      /** @deprecated */
      layerIndex?: number;
      insertNewLayer?: boolean;
    },
  ) => void;
  renameLane: (laneId: string, name: string) => void;
  reorderLane: (laneId: string, newOrder: number) => void;
  addOverlaySceneFromFrame: (
    draft: FrameDraft,
    startTime: number,
    layerIndex?: number,
    insertNewLayer?: boolean,
  ) => void;
  moveOverlayScene: (
    id: string,
    patch: {
      startTime: number;
      layerIndex: number;
      insertNewLayer?: boolean;
    },
  ) => void;
  /** Magnetic reorder on main track by drop time (midpoint rule). */
  reorderMainScene: (sceneId: string, dropTime: number) => void;
  /** Lift a main scene into an overlay lane (removes from magnetic main). */
  promoteMainSceneToOverlay: (
    sceneId: string,
    startTime: number,
    layerIndex: number,
    insertNewLayer?: boolean,
  ) => void;
  addAudioTrack: (track: { role: string; assetId: string; src?: string }) => void;
  setExporting: (value: boolean) => void;
  setTimelineZoom: (zoom: number) => void;
};

/* ==========================================================================
   2. Các hàm trợ giúp xử lý nội bộ (Helper Utilities)
   ========================================================================== */

/** Tạo ID duy nhất ngẫu nhiên với tiền tố */
function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Trích xuất văn bản từ Node dạng Text */
export function nodeText(node: MotionNode | undefined): string {
  return node?.type === "text" && typeof node.payload?.text === "string" ? node.payload.text : "";
}

/** Tìm Node đầu tiên có thể chỉnh sửa trong Scene (bỏ qua camera) */
function firstEditableNode(scene: MotionScene | undefined): MotionNode | undefined {
  return scene?.nodes.find((node) => node.type !== "camera");
}

/** Cập nhật biến số thuộc tính thương hiệu dự án */
function updateVariable(project: MotionProject, id: string, value: string): MotionProject["variables"] {
  return project.variables.map((variable) => {
    if (variable.id !== id) return variable;
    if (variable.type === "string" || variable.type === "color") return { ...variable, value };
    return variable;
  });
}

/** Cập nhật một Node cụ thể trong một Scene nhất định */
function mapNode(
  project: MotionProject,
  sceneId: string,
  nodeId: string,
  transform: (node: MotionNode) => MotionNode,
): MotionProject {
  return {
    ...project,
    scenes: project.scenes.map((scene) => scene.id === sceneId
      ? { ...scene, nodes: scene.nodes.map((node) => node.id === nodeId ? transform(node) : node) }
      : scene),
  };
}

/** Chuyển đổi FrameDraft từ thư viện thành một MotionScene hoàn chỉnh */
function sceneFromFrameDraft(draft: FrameDraft): MotionScene {
  const sceneId = uid("scene");
  const nodeId = uid("node");
  const clipId = uid("clip");
  const duration = Math.max(0.5, draft.duration || DEFAULT_FRAME_DURATION);
  return {
    id: sceneId,
    name: draft.name,
    duration,
    nodes: [
      {
        id: nodeId,
        type: "text",
        parentId: null,
        zIndex: 0,
        transform: {
          x: 540,
          y: 960,
          width: 900,
          height: 180,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          anchorX: 0.5,
          anchorY: 0.5,
          opacity: 1,
          visible: true,
          flipX: false,
          flipY: false,
        },
        payload: {
          text: draft.text || draft.name,
          fontSize: 64,
          fontWeight: 600,
          align: "center",
        },
      },
    ],
    clips: [
      {
        id: clipId,
        targetId: nodeId,
        schedule: { kind: "absolute", at: 0 },
        duration: Math.min(0.8, duration),
        playback: { iterations: 1, direction: "normal", rate: 1 },
        source: { kind: "preset", presetId: "fade-in" },
      },
    ],
  };
}

function overlayScenesFromClips(
  clips: TimelineClip[],
  lanes: TimelineLane[],
): OverlaySceneItem[] {
  const orderByLane = new Map(lanes.map((lane) => [lane.id, lane.order]));
  return clips
    .filter((clip) => !isMainLane(lanes, clip.laneId))
    .map((clip) => ({
      id: clip.id,
      name: clip.name,
      duration: clip.duration,
      startTime: clip.startTime,
      layerIndex: orderByLane.get(clip.laneId) ?? 0,
    }));
}

/** Keeps schema scenes exactly aligned with the main-track clips. */
function rebuildMainProject(
  project: MotionProject,
  clips: TimelineClip[],
  lanes: TimelineLane[],
): MotionProject {
  const byId = new Map(project.scenes.map((scene) => [scene.id, scene]));
  const mainId = lanes.find((lane) => lane.kind === "main")?.id;
  const main = clips
    .filter((clip) => clip.laneId === mainId)
    .sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));
  const sceneOrder = main
    .map((clip) => clip.sceneId)
    .filter((sceneId) => byId.has(sceneId));
  return {
    ...project,
    scenes: sceneOrder.map((sceneId) => byId.get(sceneId)!),
    timeline: { ...project.timeline, sceneOrder },
  };
}

function laneIdByOrder(lanes: TimelineLane[], order: number): string | undefined {
  return lanes.find((lane) => lane.kind === "overlay" && lane.order === order)?.id;
}

function resolveOverlayPlacement(
  lanes: TimelineLane[],
  clips: TimelineClip[],
  startTime: number,
  duration: number,
  preferredLaneId: string | null,
  insertNew: boolean,
  preferredInsertOrder?: number | null,
): { lanes: TimelineLane[]; laneId: string } {
  const result = findFreeOverlayLane(
    lanes,
    clips,
    startTime,
    duration,
    preferredLaneId,
    insertNew,
    preferredInsertOrder,
  );
  if (!result.createNew && result.laneId) {
    return { lanes, laneId: result.laneId };
  }
  let nextLanes = shiftOverlayLaneOrders(lanes, result.insertOrder, 1);
  const created = createOverlayLane(result.insertOrder);
  nextLanes = [...nextLanes, created];
  return { lanes: nextLanes, laneId: created.id };
}

/* ==========================================================================
   3. Tạo Zustand Store chính (useEditorStore)
   ========================================================================== */

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  selectedSceneId: null,
  selectedOverlayId: null,
  selectedClipId: null,
  selectedNodeId: null,
  isExporting: false,
  activeSidebarTab: "frame",
  overlayScenes: [],
  timelineClips: [],
  timelineLanes: [ensureMainLane([])],

  activeDragItem: null,
  isOverTimeline: false,
  timelineZoom: TIMELINE_ZOOM_DEFAULT,

  setActiveDragItem: (item) => set({ activeDragItem: item }),
  setIsOverTimeline: (over) => set({ isOverTimeline: over }),
  setTimelineZoom: (zoom) => set({ timelineZoom: zoom }),

  /** 3.1 Nạp dự án vào Editor Store */
  loadProject: (input, overlayScenes = [], storedClips = [], storedLanes = []) => {
    const project = parseMotionProject(input);
    const { lanes: migratedLanes, clips } = migrateLanesAndClips(
      project,
      overlayScenes,
      storedClips,
      storedLanes,
    );
    const lanes = pruneEmptyOverlayLanes(migratedLanes, clips);
    const mainId = lanes.find((lane) => lane.kind === "main")?.id;
    const firstClip =
      clips.find((clip) => clip.laneId === mainId) ?? clips[0];
    const firstIsMain = firstClip ? isMainLane(lanes, firstClip.laneId) : false;
    const firstScene = firstIsMain
      ? project.scenes.find((scene) => scene.id === firstClip!.sceneId)
      : undefined;
    set({
      project,
      timelineLanes: lanes,
      timelineClips: clips,
      timelineZoom: TIMELINE_ZOOM_ON_PROJECT_LOAD,
      selectedClipId: firstClip?.id ?? null,
      selectedSceneId: firstIsMain ? firstClip!.sceneId : null,
      selectedOverlayId: firstIsMain ? null : (firstClip?.id ?? null),
      selectedNodeId: firstEditableNode(firstScene)?.id ?? null,
      overlayScenes: overlayScenesFromClips(clips, lanes),
    });
  },

  /** 3.2 Chọn Scene đang hoạt động (clear overlay selection) */
  selectScene: (sceneId) => {
    const state = get();
    const scene = state.project?.scenes.find((candidate) => candidate.id === sceneId);
    const mainId = state.timelineLanes.find((lane) => lane.kind === "main")?.id;
    const clip = state.timelineClips.find((candidate) =>
      candidate.laneId === mainId && candidate.sceneId === sceneId);
    set({
      selectedSceneId: sceneId,
      selectedOverlayId: null,
      selectedClipId: clip?.id ?? null,
      selectedNodeId: firstEditableNode(scene)?.id ?? null,
    });
  },

  /** Chọn overlay clip trên timeline (clear main scene selection) */
  selectOverlay: (overlayId) => {
    set({
      selectedOverlayId: overlayId,
      selectedSceneId: null,
      selectedClipId: overlayId,
      selectedNodeId: null,
    });
  },

  selectClip: (clipId) => {
    const state = get();
    const clip = state.timelineClips.find((candidate) => candidate.id === clipId);
    if (!clip) return;
    const onMain = isMainLane(state.timelineLanes, clip.laneId);
    const scene = onMain
      ? state.project?.scenes.find((candidate) => candidate.id === clip.sceneId)
      : undefined;
    set({
      selectedClipId: clip.id,
      selectedSceneId: onMain ? clip.sceneId : null,
      selectedOverlayId: onMain ? null : clip.id,
      selectedNodeId: firstEditableNode(scene)?.id ?? null,
    });
  },

  clearTimelineSelection: () => {
    set({
      selectedSceneId: null,
      selectedOverlayId: null,
      selectedClipId: null,
      selectedNodeId: null,
    });
  },

  /** 3.3 Chọn Node (thành phần đồ họa) đang hoạt động */
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  /** 3.4 Thay đổi Tab Sidebar đang hiển thị */
  setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab }),

  renameLane: (laneId, name) => {
    set((state) => ({
      timelineLanes: state.timelineLanes.map((lane) =>
        lane.id === laneId ? { ...lane, name } : lane),
    }));
  },

  reorderLane: (laneId, newOrder) => {
    set((state) => ({
      timelineLanes: reorderOverlayLane(state.timelineLanes, laneId, newOrder),
      overlayScenes: overlayScenesFromClips(
        state.timelineClips,
        reorderOverlayLane(state.timelineLanes, laneId, newOrder),
      ),
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
      const timelineClips = state.timelineClips.map((clip) => clip.sceneId === sceneId
        ? { ...clip, duration: nextDuration }
        : clip);
      return {
        project: {
          ...project,
          scenes: project.scenes.map((scene) => scene.id === sceneId
            ? { ...scene, duration: nextDuration }
            : scene),
        },
        timelineClips,
        overlayScenes: overlayScenesFromClips(timelineClips, state.timelineLanes),
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

  /** Thêm Scene từ Khung hình vào Main Track nối tiếp */
  addSceneFromFrame: (draft) => {
    get().addClipFromDraft(draft, { track: "main" });
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
        const scene = sceneFromFrameDraft(draft);
        const startTime = state.timelineClips
          .filter((clip) => clip.laneId === mainLane.id)
          .reduce((end, clip) => Math.max(end, clip.startTime + clip.duration), 0);
        const clip: TimelineClip = {
          id: scene.id,
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
        const nextLanes = pruneEmptyOverlayLanes(lanes, timelineClips);
        return {
          project: nextProject,
          timelineLanes: nextLanes,
          timelineClips,
          overlayScenes: overlayScenesFromClips(timelineClips, nextLanes),
          selectedClipId: clip.id,
          selectedSceneId: scene.id,
          selectedOverlayId: null,
          selectedNodeId: firstEditableNode(scene)?.id ?? null,
        };
      }

      const insertNew =
        target.insertNewLane ?? target.insertNewLayer ?? false;
      const preferredLaneId = insertNew
        ? null
        : (target.laneId ??
          (target.layerIndex != null
            ? laneIdByOrder(lanes, target.layerIndex) ?? null
            : null));
      const preferredInsertOrder = insertNew
        ? (target.layerIndex ?? null)
        : null;
      const placement = resolveOverlayPlacement(
        lanes,
        state.timelineClips,
        Math.max(0, target.startTime),
        duration,
        preferredLaneId,
        insertNew,
        preferredInsertOrder,
      );
      lanes = placement.lanes;
      const id = uid("overlay");
      const clip: TimelineClip = {
        id,
        sceneId: id,
        laneId: placement.laneId,
        startTime: Math.max(0, target.startTime),
        duration,
        name: draft.name,
      };
      const timelineClips = [...state.timelineClips, clip];
      const nextLanes = pruneEmptyOverlayLanes(lanes, timelineClips);
      return {
        timelineLanes: nextLanes,
        timelineClips,
        overlayScenes: overlayScenesFromClips(timelineClips, nextLanes),
        selectedClipId: clip.id,
        selectedSceneId: null,
        selectedOverlayId: clip.id,
        selectedNodeId: null,
      };
    });
  },

  moveClip: (clipId, patch) => {
    set((state) => {
      const project = state.project;
      const existing = state.timelineClips.find((clip) => clip.id === clipId);
      if (!project || !existing) return state;
      const startTime = Math.max(0, patch.startTime);
      let lanes = state.timelineLanes.length
        ? state.timelineLanes
        : [ensureMainLane([])];
      const mainLane = ensureMainLane(lanes);
      if (!lanes.some((lane) => lane.id === mainLane.id)) {
        lanes = [...lanes, mainLane];
      }
      let clips = state.timelineClips.filter((clip) => clip.id !== clipId);
      let nextProject = project;
      let moved: TimelineClip;
      const existingOnMain = isMainLane(lanes, existing.laneId);

      if (patch.track === "overlay") {
        const insertNew =
          patch.insertNewLane ?? patch.insertNewLayer ?? false;
        const preferredLaneId = insertNew
          ? null
          : (patch.laneId ??
            (patch.layerIndex != null
              ? laneIdByOrder(lanes, patch.layerIndex) ?? null
              : existingOnMain ? null : existing.laneId));
        const preferredInsertOrder = insertNew
          ? (patch.layerIndex ?? null)
          : null;
        const placement = resolveOverlayPlacement(
          lanes,
          clips,
          startTime,
          existing.duration,
          preferredLaneId,
          insertNew,
          preferredInsertOrder,
        );
        lanes = placement.lanes;
        moved = {
          ...existing,
          sceneId: existingOnMain ? existing.id : existing.sceneId,
          laneId: placement.laneId,
          startTime,
          track: undefined,
          layerIndex: undefined,
        };
        if (existingOnMain) {
          nextProject = {
            ...project,
            scenes: project.scenes.filter((scene) => scene.id !== existing.sceneId),
          };
        }
      } else {
        let sceneId = existing.sceneId;
        if (!existingOnMain) {
          const scene = sceneFromFrameDraft({
            id: existing.id,
            name: existing.name,
            duration: existing.duration,
            text: existing.name,
          });
          sceneId = scene.id;
          nextProject = { ...project, scenes: [...project.scenes, scene] };
        }
        moved = {
          ...existing,
          id: existingOnMain ? existing.id : sceneId,
          sceneId,
          laneId: mainLane.id,
          startTime: resolveMainStartTime(
            clips,
            lanes,
            startTime,
            existing.duration,
          ),
          track: undefined,
          layerIndex: undefined,
        };
      }

      clips.push(moved);
      lanes = pruneEmptyOverlayLanes(lanes, clips);
      nextProject = rebuildMainProject(nextProject, clips, lanes);
      const movedOnMain = isMainLane(lanes, moved.laneId);
      const selectedScene = movedOnMain
        ? nextProject.scenes.find((scene) => scene.id === moved.sceneId)
        : undefined;
      return {
        project: nextProject,
        timelineLanes: lanes,
        timelineClips: clips,
        overlayScenes: overlayScenesFromClips(clips, lanes),
        selectedClipId: moved.id,
        selectedSceneId: movedOnMain ? moved.sceneId : null,
        selectedOverlayId: movedOnMain ? null : moved.id,
        selectedNodeId: firstEditableNode(selectedScene)?.id ?? null,
      };
    });
  },

  /**
   * Thêm Khung hình vào tầng Overlay. insertNewLayer = true đẩy các tầng trên lên +1.
   */
  addOverlaySceneFromFrame: (
    draft,
    startTime,
    layerIndex,
    insertNewLayer = false,
  ) => {
    get().addClipFromDraft(draft, {
      track: "overlay",
      startTime,
      layerIndex,
      insertNewLayer,
    });
  },

  /** Di chuyển overlay: đổi startTime / layer; insertNewLayer shift các tầng >= target */
  moveOverlayScene: (id, patch) => {
    get().moveClip(id, { ...patch, track: "overlay" });
  },

  /** Sắp xếp lại clip trên Main (magnetic) theo thời điểm thả */
  reorderMainScene: (sceneId, dropTime) => {
    const state = get();
    const mainId = state.timelineLanes.find((lane) => lane.kind === "main")?.id;
    const clip = state.timelineClips.find((candidate) =>
      candidate.laneId === mainId && candidate.sceneId === sceneId);
    if (clip) get().moveClip(clip.id, { track: "main", startTime: dropTime });
  },

  /** Đưa clip Main lên lane Overlay (xóa khỏi chuỗi magnetic) */
  promoteMainSceneToOverlay: (
    sceneId,
    startTime,
    layerIndex,
    insertNewLayer = false,
  ) => {
    const state = get();
    const mainId = state.timelineLanes.find((lane) => lane.kind === "main")?.id;
    const clip = state.timelineClips.find((candidate) =>
      candidate.laneId === mainId && candidate.sceneId === sceneId);
    if (clip) {
      get().moveClip(clip.id, {
        track: "overlay",
        startTime,
        layerIndex,
        insertNewLayer,
      });
    }
  },

  /** 3.21 Thêm đường Audio Track (nhạc nền, âm thanh) */
  addAudioTrack: (track) => {
    const project = get().project;
    if (!project) return;
    const assetId = track.assetId;
    const existingAsset = project.assets.find((a) => a.id === assetId);
    const audioAsset = existingAsset
      ? null
      : {
          id: assetId,
          assetType: "audio" as const,
          uri:
            track.src ||
            "https://actions.google.com/sounds/v1/ambiences/outdoor_theme_park.ogg",
          mimeType: "audio/mpeg" as const,
          codec: "mp3",
          duration: 10,
          sampleRate: 44100,
          channels: 2,
        };

    const assets = audioAsset
      ? [...project.assets, audioAsset]
      : project.assets;

    const newTrack = {
      id: uid("audio"),
      role: "bgm" as const,
      assetId,
      start: 0,
      trimStart: 0,
      volume: 1,
      loop: false,
      fadeIn: 0,
      fadeOut: 0,
    };

    set({
      project: {
        ...project,
        assets,
        timeline: {
          ...project.timeline,
          audioTracks: [...project.timeline.audioTracks, newTrack],
        },
      },
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
