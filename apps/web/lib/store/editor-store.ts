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
import { TIMELINE_ZOOM_DEFAULT } from "@/components/desktop/editor/timeline/timeline-scale";

export type { OverlaySceneItem } from "@/lib/overlay-scenes";

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
  selectedNodeId: string | null;
  isExporting: boolean;
  activeSidebarTab: SidebarTabId;
  overlayScenes: OverlaySceneItem[];

  activeDragItem: {
    id: string;
    type: "frame" | "audio";
    name: string;
    duration: number;
  } | null;
  isOverTimeline: boolean;

  /** Shared playback / scrub clock (seconds on full main timeline) */
  currentTime: number;
  isPlaying: boolean;
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
  loadProject: (project: MotionProject, overlayScenes?: OverlaySceneItem[]) => void;
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
  addAudioTrack: (track: { role: string; assetId: string; src?: string }) => void;
  setExporting: (value: boolean) => void;
  setCurrentTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  togglePlaying: () => void;
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

/* ==========================================================================
   3. Tạo Zustand Store chính (useEditorStore)
   ========================================================================== */

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  selectedSceneId: null,
  selectedOverlayId: null,
  selectedNodeId: null,
  isExporting: false,
  activeSidebarTab: "frame",
  overlayScenes: [],

  activeDragItem: null,
  isOverTimeline: false,
  currentTime: 0,
  isPlaying: false,
  timelineZoom: TIMELINE_ZOOM_DEFAULT,

  setActiveDragItem: (item) => set({ activeDragItem: item }),
  setIsOverTimeline: (over) => set({ isOverTimeline: over }),
  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  togglePlaying: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setTimelineZoom: (zoom) => set({ timelineZoom: zoom }),

  /** 3.1 Nạp dự án vào Editor Store */
  loadProject: (input, overlayScenes = []) => {
    const project = parseMotionProject(input);
    const firstScene = project.scenes.find((scene) => scene.id === project.timeline.sceneOrder[0]) ?? project.scenes[0];
    set({
      project,
      selectedSceneId: firstScene?.id ?? null,
      selectedOverlayId: null,
      selectedNodeId: firstEditableNode(firstScene)?.id ?? null,
      overlayScenes,
      currentTime: 0,
      isPlaying: false,
    });
  },

  /** 3.2 Chọn Scene đang hoạt động (clear overlay selection) */
  selectScene: (sceneId) => {
    const scene = get().project?.scenes.find((candidate) => candidate.id === sceneId);
    set({
      selectedSceneId: sceneId,
      selectedOverlayId: null,
      selectedNodeId: firstEditableNode(scene)?.id ?? null,
    });
  },

  /** Chọn overlay clip trên timeline (clear main scene selection) */
  selectOverlay: (overlayId) => {
    set({
      selectedOverlayId: overlayId,
      selectedSceneId: null,
      selectedNodeId: null,
    });
  },

  clearTimelineSelection: () => {
    set({
      selectedSceneId: null,
      selectedOverlayId: null,
      selectedNodeId: null,
    });
  },

  /** 3.3 Chọn Node (thành phần đồ họa) đang hoạt động */
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  /** 3.4 Thay đổi Tab Sidebar đang hiển thị */
  setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab }),

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
    set({ project: { ...project, scenes: project.scenes.map((scene) => scene.id === sceneId ? { ...scene, duration: Math.max(0.5, duration) } : scene) } });
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
    const project = get().project;
    if (!project) return;
    const scene = sceneFromFrameDraft(draft);
    set({
      project: {
        ...project,
        scenes: [...project.scenes, scene],
        timeline: {
          ...project.timeline,
          sceneOrder: [...project.timeline.sceneOrder, scene.id],
        },
      },
      selectedSceneId: scene.id,
      selectedOverlayId: null,
      selectedNodeId: firstEditableNode(scene)?.id ?? null,
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
    set((state) => {
      let targetLayer = layerIndex;
      if (targetLayer === undefined) {
        const maxLayer = state.overlayScenes.reduce(
          (max, item) => Math.max(max, item.layerIndex),
          -1,
        );
        targetLayer = maxLayer + 1;
      }
      targetLayer = Math.max(0, targetLayer);

      let updatedScenes = state.overlayScenes;
      if (insertNewLayer) {
        // Tự động dịch chuyển các tầng phía trên lên +1 khi chèn dải băng mới vào giữa
        updatedScenes = state.overlayScenes.map((item) => {
          if (item.layerIndex >= targetLayer!) {
            return { ...item, layerIndex: item.layerIndex + 1 };
          }
          return item;
        });
      }

      const newOverlay: OverlaySceneItem = {
        id: uid("overlay"),
        name: draft.name,
        duration: draft.duration ?? DEFAULT_FRAME_DURATION,
        startTime: Math.max(0, startTime),
        layerIndex: targetLayer,
      };

      return {
        overlayScenes: [...updatedScenes, newOverlay],
        selectedOverlayId: newOverlay.id,
        selectedSceneId: null,
        selectedNodeId: null,
      };
    });
  },

  /** Di chuyển overlay: đổi startTime / layer; insertNewLayer shift các tầng >= target */
  moveOverlayScene: (id, patch) => {
    set((state) => {
      const existing = state.overlayScenes.find((item) => item.id === id);
      if (!existing) return state;

      const targetLayer = Math.max(0, patch.layerIndex);
      const startTime = Math.max(0, patch.startTime);
      let others = state.overlayScenes.filter((item) => item.id !== id);

      if (patch.insertNewLayer) {
        others = others.map((item) =>
          item.layerIndex >= targetLayer
            ? { ...item, layerIndex: item.layerIndex + 1 }
            : item,
        );
      }

      return {
        overlayScenes: [
          ...others,
          {
            ...existing,
            startTime,
            layerIndex: targetLayer,
          },
        ],
        selectedOverlayId: id,
        selectedSceneId: null,
        selectedNodeId: null,
      };
    });
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
