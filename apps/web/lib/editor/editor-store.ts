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
import type { FrameDraft } from "@/lib/editor/frame-library";
import { DEFAULT_FRAME_DURATION } from "@/lib/editor/frame-library";
import type { OverlaySceneItem } from "@/lib/editor/overlay-scenes";
import {
  type ClipClipboardItem,
  MIN_CLIP_SLICE_SEC,
  playheadSplitsClip,
} from "@/lib/editor/clip-clipboard";
import {
  TIMELINE_ZOOM_DEFAULT,
  TIMELINE_ZOOM_ON_PROJECT_LOAD,
} from "@/lib/editor/editor-preferences";
import {
  applyLaneFlagPatch,
  selectionHasLockedLane,
} from "@/lib/editor/operations/lane-flags";
import {
  createAudioLane,
  createOverlayLane,
  clipsContentEndSeconds,
  ensureAudioClipsFromTracks,
  ensureMainLane,
  findFreeAudioLane,
  findFreeOverlayLane,
  isAudioLane,
  isMainLane,
  isOverlayLane,
  isSceneClip,
  migrateLanesAndClips,
  pruneEmptyLanes,
  resolveMainStartTime,
  reorderOverlayLane,
  shiftAudioLaneOrders,
  shiftOverlayLaneOrders,
  type TimelineClip,
  type TimelineLane,
} from "@/lib/editor/timeline-clips";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";

function sceneIdOf(clip: TimelineClip): string | null {
  return clip.kind === "scene" ? clip.sceneId : null;
}

export type { OverlaySceneItem } from "@/lib/editor/overlay-scenes";
export type { TimelineClip, TimelineLane } from "@/lib/editor/timeline-clips";

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
  /** Multi-select on timeline (marquee / shift). Primary = last id = selectedClipId. */
  selectedClipIds: string[];
  selectedNodeId: string | null;
  isExporting: boolean;
  activeSidebarTab: SidebarTabId;
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
  /** Internal clipboard for timeline clips (Copy/Cut/Paste). */
  timelineClipboard: ClipClipboardItem[] | null;

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
  setSelectedClipIds: (clipIds: string[]) => void;
  clearTimelineSelection: () => void;
  selectNode: (nodeId: string | null) => void;
  setActiveSidebarTab: (tab: SidebarTabId) => void;
  updateBrand: (patch: Partial<MotionProject["metadata"]["brand"]>) => void;
  updateSceneDuration: (sceneId: string, duration: number) => void;
  updateNodeText: (sceneId: string, nodeId: string, text: string) => void;
  updateNodePosition: (sceneId: string, nodeId: string, position: { x?: number; y?: number }) => void;
  updateNodeAnimation: (sceneId: string, nodeId: string, patch: { presetId?: string; duration?: number; at?: number }) => void;
  setAspectRatio: (aspectRatio: AspectRatio) => void;
  addClipFromDraft: (
    draft: FrameDraft,
    target:
      | { track: "main" }
      | {
          track: "overlay";
          startTime: number;
          laneId?: string;
          insertNewLane?: boolean;
          insertOrder?: number;
        },
  ) => void;
  moveClip: (
    clipId: string,
    patch: {
      startTime: number;
      track: "main" | "overlay" | "audio";
      laneId?: string;
      insertNewLane?: boolean;
      insertOrder?: number;
    },
  ) => void;
  renameLane: (laneId: string, name: string) => void;
  /** Phase 6 — flag lane thật (lock / visible / mute). */
  updateLaneFlags: (
    laneId: string,
    patch: { locked?: boolean; visible?: boolean; muted?: boolean },
  ) => void;
  reorderLane: (laneId: string, newOrder: number) => void;
  addAudioTrack: (track: {
    role: string;
    assetId: string;
    src?: string;
    duration?: number;
  }) => void;
  addAudioClipFromLibrary: (
    item: {
      title: string;
      assetId: string;
      src?: string;
      duration?: number;
    },
    target: {
      startTime: number;
      laneId?: string;
      insertNewLane?: boolean;
      insertOrder?: number;
    },
  ) => void;
  copySelectedClips: () => void;
  cutSelectedClips: () => void;
  pasteClips: (atTime?: number) => void;
  deleteSelectedClips: () => void;
  duplicateSelectedClips: () => void;
  splitSelectedClipsAt: (time: number) => void;
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
    .filter((clip) => clip.kind === "scene" && clip.laneId === mainId)
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

function resolveAudioPlacement(
  lanes: TimelineLane[],
  clips: TimelineClip[],
  startTime: number,
  duration: number,
  preferredLaneId: string | null,
  insertNew: boolean,
  preferredInsertOrder?: number | null,
): { lanes: TimelineLane[]; laneId: string } {
  const result = findFreeAudioLane(
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
  let nextLanes = shiftAudioLaneOrders(lanes, result.insertOrder, 1);
  const created = createAudioLane(result.insertOrder);
  nextLanes = [...nextLanes, created];
  return { lanes: nextLanes, laneId: created.id };
}

function audioLaneIdByOrder(
  lanes: TimelineLane[],
  order: number,
): string | undefined {
  return lanes.find((lane) => lane.kind === "audio" && lane.order === order)?.id;
}

function cloneSceneWithNewIds(scene: MotionScene): MotionScene {
  const cloned = JSON.parse(JSON.stringify(scene)) as MotionScene;
  const idMap = new Map<string, string>();
  const newSceneId = uid("scene");
  idMap.set(scene.id, newSceneId);
  cloned.id = newSceneId;
  cloned.nodes = (cloned.nodes ?? []).map((node) => {
    const nextId = uid("node");
    idMap.set(node.id, nextId);
    return { ...node, id: nextId };
  });
  cloned.nodes = cloned.nodes.map((node) => ({
    ...node,
    parentId:
      node.parentId && idMap.has(node.parentId)
        ? idMap.get(node.parentId)!
        : node.parentId,
  }));
  cloned.clips = (cloned.clips ?? []).map((clip) => ({
    ...clip,
    id: uid("clip"),
    targetId:
      clip.targetId && idMap.has(clip.targetId)
        ? idMap.get(clip.targetId)!
        : clip.targetId,
  }));
  return cloned;
}

function selectionStateForClip(
  clip: TimelineClip | undefined,
  lanes: TimelineLane[],
  project: MotionProject | null,
) {
  if (!clip) {
    return {
      selectedClipId: null as string | null,
      selectedClipIds: [] as string[],
      selectedSceneId: null as string | null,
      selectedOverlayId: null as string | null,
      selectedNodeId: null as string | null,
    };
  }
  const onMain = isMainLane(lanes, clip.laneId);
  const onAudio = isAudioLane(lanes, clip.laneId);
  const scene = onMain
    ? project?.scenes.find((candidate) => candidate.id === clip.sceneId)
    : undefined;
  return {
    selectedClipId: clip.id,
    selectedClipIds: [clip.id],
    selectedSceneId: onMain ? clip.sceneId : null,
    selectedOverlayId: onMain || onAudio ? null : clip.id,
    selectedNodeId: firstEditableNode(scene)?.id ?? null,
  };
}

/* ==========================================================================
   3. Tạo Zustand Store chính (useEditorStore)
   ========================================================================== */

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  selectedSceneId: null,
  selectedOverlayId: null,
  selectedClipId: null,
  selectedClipIds: [],
  selectedNodeId: null,
  isExporting: false,
  activeSidebarTab: "frame",
  timelineClips: [],
  timelineLanes: [ensureMainLane([])],

  activeDragItem: null,
  isOverTimeline: false,
  timelineZoom: TIMELINE_ZOOM_DEFAULT,
  timelineClipboard: null as ClipClipboardItem[] | null,

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
    const firstIsMain = firstClip ? isMainLane(lanes, firstClip.laneId) : false;
    const firstIsAudio = firstClip ? isAudioLane(lanes, firstClip.laneId) : false;
    const firstScene = firstIsMain
      ? project.scenes.find((scene) => scene.id === firstClip!.sceneId)
      : undefined;

    // Reset transient UI/session — tránh rò state project trước sang project sau (STATE-04).
    set({
      project,
      timelineLanes: lanes,
      timelineClips: clips,
      timelineZoom: TIMELINE_ZOOM_ON_PROJECT_LOAD,
      selectedClipId: firstClip?.id ?? null,
      selectedClipIds: firstClip ? [firstClip.id] : [],
      selectedSceneId: firstIsMain ? firstClip!.sceneId : null,
      selectedOverlayId:
        firstIsMain || firstIsAudio || !firstClip ? null : firstClip.id,
      selectedNodeId: firstEditableNode(firstScene)?.id ?? null,
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
    const state = get();
    const unique = [...new Set(clipIds.filter(Boolean))];
    const primaryId = unique[unique.length - 1] ?? null;
    if (!primaryId) {
      set({
        selectedClipIds: [],
        selectedClipId: null,
        selectedSceneId: null,
        selectedOverlayId: null,
        selectedNodeId: null,
      });
      return;
    }
    const clip = state.timelineClips.find((candidate) => candidate.id === primaryId);
    if (!clip) {
      set({
        selectedClipIds: unique,
        selectedClipId: primaryId,
        selectedSceneId: null,
        selectedOverlayId: null,
        selectedNodeId: null,
      });
      return;
    }
    const onMain = isMainLane(state.timelineLanes, clip.laneId);
    const onAudio = isAudioLane(state.timelineLanes, clip.laneId);
    const scene = onMain
      ? state.project?.scenes.find((candidate) => candidate.id === clip.sceneId)
      : undefined;
    set({
      selectedClipIds: unique,
      selectedClipId: clip.id,
      selectedSceneId: onMain ? clip.sceneId : null,
      selectedOverlayId: onMain || onAudio ? null : clip.id,
      selectedNodeId: firstEditableNode(scene)?.id ?? null,
    });
  },

  clearTimelineSelection: () => {
    set({
      selectedSceneId: null,
      selectedOverlayId: null,
      selectedClipId: null,
      selectedClipIds: [],
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
        const scene = sceneFromFrameDraft(draft);
        const startTime = state.timelineClips
          .filter((clip) => clip.laneId === mainLane.id)
          .reduce((end, clip) => Math.max(end, clip.startTime + clip.duration), 0);
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
          selectedClipId: clip.id,
          selectedClipIds: [clip.id],
          selectedSceneId: scene.id,
          selectedOverlayId: null,
          selectedNodeId: firstEditableNode(scene)?.id ?? null,
        };
      }

      const insertNew = target.insertNewLane ?? false;
      const preferredLaneId = insertNew ? null : (target.laneId ?? null);
      const preferredInsertOrder = insertNew
        ? (target.insertOrder ?? null)
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
      // Overlay cũng là scene thật trong editor document (MODEL-01/02).
      const scene = sceneFromFrameDraft(draft);
      const clip: TimelineClip = {
        id: uid("clip"),
        kind: "scene",
        sceneId: scene.id,
        laneId: placement.laneId,
        startTime: Math.max(0, target.startTime),
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
        selectedClipId: clip.id,
        selectedClipIds: [clip.id],
        selectedSceneId: null,
        selectedOverlayId: clip.id,
        selectedNodeId: firstEditableNode(scene)?.id ?? null,
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
      let clips = state.timelineClips.filter((clip) => clip.id !== clipId);
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
        );
        lanes = placement.lanes;
        if (existing.kind !== "audio") return state;
        moved = {
          ...existing,
          kind: "audio",
          laneId: placement.laneId,
          startTime,
        };
        clips.push(moved);
        lanes = pruneEmptyLanes(lanes, clips);
        nextProject = {
          ...project,
          timeline: {
            ...project.timeline,
            audioTracks: project.timeline.audioTracks.map((track) =>
              track.id === existing.audioTrackId || track.id === moved.id
                ? { ...track, start: startTime }
                : track,
            ),
          },
        };
        return {
          project: nextProject,
          timelineLanes: lanes,
          timelineClips: clips,
          selectedClipId: moved.id,
          selectedClipIds: [moved.id],
          selectedSceneId: null,
          selectedOverlayId: null,
          selectedNodeId: null,
        };
      }

      if (patch.track === "overlay") {
        if (existingOnAudio || existing.kind !== "scene") return state;
        const insertNew = patch.insertNewLane ?? false;
        const preferredLaneId = insertNew
          ? null
          : (patch.laneId ??
            (existingOnMain ? null : existing.laneId));
        const preferredInsertOrder = insertNew
          ? (patch.insertOrder ?? null)
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
        // Chỉ đổi lane/startTime — giữ nguyên sceneId/content (MODEL-02).
        moved = {
          ...existing,
          kind: "scene",
          sceneId: existing.sceneId,
          laneId: placement.laneId,
          startTime,
        };
      } else {
        if (existingOnAudio || existing.kind !== "scene") return state;
        // Base placement — giữ nguyên scene, chỉ đổi lane + start.
        moved = {
          ...existing,
          kind: "scene",
          sceneId: existing.sceneId,
          laneId: mainLane.id,
          startTime: resolveMainStartTime(
            clips,
            lanes,
            startTime,
            existing.duration,
          ),
        };
      }

      clips.push(moved);
      lanes = pruneEmptyLanes(lanes, clips);
      nextProject = rebuildMainProject(nextProject, clips, lanes);
      const movedOnMain = isMainLane(lanes, moved.laneId);
      const selectedScene = movedOnMain
        ? nextProject.scenes.find((scene) => scene.id === moved.sceneId)
        : undefined;
      return {
        project: nextProject,
        timelineLanes: lanes,
        timelineClips: clips,
        selectedClipId: moved.id,
        selectedClipIds: [moved.id],
        selectedSceneId: movedOnMain ? moved.sceneId : null,
        selectedOverlayId: movedOnMain ? null : moved.id,
        selectedNodeId: firstEditableNode(selectedScene)?.id ?? null,
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
      const preferredLaneId = insertNew ? null : (target.laneId ?? null);
      const preferredInsertOrder = insertNew
        ? (target.insertOrder ?? null)
        : null;
      const placement = resolveAudioPlacement(
        lanes,
        state.timelineClips,
        startTime,
        duration,
        preferredLaneId,
        insertNew,
        preferredInsertOrder,
      );
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
        start: startTime,
        trimStart: 0,
        volume: 1,
        loop: false,
        fadeIn: 0,
        fadeOut: 0,
      };

      const clip: TimelineClip = {
        id: trackId,
        kind: "audio",
        sceneId: "",
        audioTrackId: trackId,
        assetId,
        laneId: placement.laneId,
        startTime,
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
        selectedClipId: clip.id,
        selectedClipIds: [clip.id],
        selectedSceneId: null,
        selectedOverlayId: null,
        selectedNodeId: null,
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
    const ids = state.selectedClipIds;
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
    get().copySelectedClips();
    get().deleteSelectedClips();
  },

  deleteSelectedClips: () => {
    set((state) => {
      const project = state.project;
      const ids = new Set(state.selectedClipIds);
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
        ...selectionStateForClip(undefined, lanes, nextProject),
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
          const scene = cloneSceneWithNewIds({
            ...item.scene,
            duration: item.duration,
            name: item.name,
          });
          scenes = [...scenes, scene];
          const clip: TimelineClip = {
            id: scene.id,
            kind: "scene",
            sceneId: scene.id,
            laneId: mainLane.id,
            startTime,
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
            false,
            null,
          );
          lanes = placement.lanes;
          const trackId = uid("audio");
          audioTracks = [
            ...audioTracks,
            {
              id: trackId,
              role: "bgm" as const,
              assetId: item.audioAssetId ?? item.name,
              start: startTime,
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
            sceneId: "",
            audioTrackId: trackId,
            assetId: item.audioAssetId ?? item.name,
            laneId: placement.laneId,
            startTime,
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
            false,
            null,
          );
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
            startTime,
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
            false,
            null,
          );
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
            startTime,
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
      const primary = clips.find((c) => c.id === newIds[newIds.length - 1]);
      return {
        project: nextProject,
        timelineLanes: lanes,
        timelineClips: clips,
        selectedClipIds: newIds,
        selectedClipId: primary?.id ?? null,
        selectedSceneId:
          primary && isMainLane(lanes, primary.laneId) ? primary.sceneId : null,
        selectedOverlayId:
          primary &&
          !isMainLane(lanes, primary.laneId) &&
          !isAudioLane(lanes, primary.laneId)
            ? primary.id
            : null,
        selectedNodeId: null,
      };
    });
  },

  duplicateSelectedClips: () => {
    set((s) => {
      const project = s.project;
      if (!project) return s;
      let lanes = s.timelineLanes;
      let clips = [...s.timelineClips];
      let scenes = [...project.scenes];
      let audioTracks = [...project.timeline.audioTracks];
      const newIds: string[] = [];
      const toDup = clips
        .filter((c) => s.selectedClipIds.includes(c.id))
        .sort((a, b) => a.startTime - b.startTime);

      if (toDup.length === 0) return s;

      for (const clip of toDup) {
        const startTime = clip.startTime + clip.duration;
        if (isMainLane(lanes, clip.laneId) && clip.kind === "scene") {
          const scene = scenes.find((sc) => sc.id === clip.sceneId);
          if (!scene) continue;
          const cloned = cloneSceneWithNewIds(scene);
          scenes = [...scenes, cloned];
          const next: TimelineClip = {
            id: cloned.id,
            kind: "scene",
            sceneId: cloned.id,
            laneId: clip.laneId,
            startTime,
            duration: clip.duration,
            name: clip.name,
          };
          clips = [...clips, next];
          newIds.push(next.id);
        } else if (isAudioLane(lanes, clip.laneId)) {
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
              start: startTime,
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
            sceneId: "",
            audioTrackId: trackId,
            assetId:
              (clip.kind === "audio" ? clip.assetId : undefined) ??
              track?.assetId ??
              clip.name,
            laneId: placement.laneId,
            startTime,
            duration: clip.duration,
            name: clip.name,
          };
          clips = [...clips, next];
          newIds.push(next.id);
        } else if (clip.kind === "scene") {
          const placement = resolveOverlayPlacement(
            lanes,
            clips,
            startTime,
            clip.duration,
            clip.laneId,
            false,
            null,
          );
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
              startTime,
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
      const primary = clips.find((c) => c.id === newIds[newIds.length - 1]);
      return {
        project: nextProject,
        timelineLanes: lanes,
        timelineClips: clips,
        selectedClipIds: newIds,
        selectedClipId: primary?.id ?? null,
        selectedSceneId:
          primary && isMainLane(lanes, primary.laneId) ? primary.sceneId : null,
        selectedOverlayId:
          primary &&
          !isMainLane(lanes, primary.laneId) &&
          !isAudioLane(lanes, primary.laneId)
            ? primary.id
            : null,
        selectedNodeId: null,
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
          state.selectedClipIds,
        )
      ) {
        return state;
      }
      const t = Math.max(0, time);
      const selected = state.timelineClips.filter((clip) =>
        state.selectedClipIds.includes(clip.id),
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
            sceneId: "",
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
      const primaryId = newSelection[newSelection.length - 1];
      const primary = clips.find((c) => c.id === primaryId);
      return {
        project: nextProject,
        timelineLanes: lanes,
        timelineClips: clips,
        selectedClipIds: newSelection,
        selectedClipId: primaryId,
        selectedSceneId:
          primary && isMainLane(lanes, primary.laneId) ? primary.sceneId : null,
        selectedOverlayId:
          primary &&
          !isMainLane(lanes, primary.laneId) &&
          !isAudioLane(lanes, primary.laneId)
            ? primary.id
            : null,
        selectedNodeId: null,
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
