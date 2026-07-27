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

export type SceneRole = "hook" | "pain" | "benefit" | "demo" | "offer" | "cta" | "logo";

type EditorState = {
  project: MotionProject | null;
  selectedSceneId: string | null;
  selectedNodeId: string | null;
  sceneClipboard: MotionScene | null;
  isExporting: boolean;
  activeSidebarTab: string;
  sidebarOpen: boolean;
  loadProject: (project: MotionProject) => void;
  selectScene: (sceneId: string) => void;
  selectNode: (nodeId: string | null) => void;
  setActiveSidebarTab: (tab: string) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  updateBrand: (patch: Partial<MotionProject["metadata"]["brand"]>) => void;
  updateSceneDuration: (sceneId: string, duration: number) => void;
  updateNodeText: (sceneId: string, nodeId: string, text: string) => void;
  updateNodePosition: (sceneId: string, nodeId: string, position: { x?: number; y?: number }) => void;
  updateNodeAnimation: (sceneId: string, nodeId: string, patch: { presetId?: string; duration?: number; at?: number }) => void;
  setAspectRatio: (aspectRatio: AspectRatio) => void;
  copyScene: (sceneId: string) => void;
  cutScene: (sceneId: string) => void;
  pasteScene: (afterSceneId: string) => void;
  duplicateScene: (sceneId: string) => void;
  renameScene: (sceneId: string, role: SceneRole) => void;
  deleteScene: (sceneId: string) => void;
  addSceneFromFrame: (draft: FrameDraft) => void;
  addAudioTrack: (track: { role: string; assetId: string; src?: string }) => void;
  setExporting: (value: boolean) => void;
};

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function nodeText(node: MotionNode | undefined): string {
  return node?.type === "text" && typeof node.payload?.text === "string" ? node.payload.text : "";
}

function firstEditableNode(scene: MotionScene | undefined): MotionNode | undefined {
  return scene?.nodes.find((node) => node.type !== "camera");
}

function updateVariable(project: MotionProject, id: string, value: string): MotionProject["variables"] {
  return project.variables.map((variable) => {
    if (variable.id !== id) return variable;
    if (variable.type === "string" || variable.type === "color") return { ...variable, value };
    return variable;
  });
}

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

function cloneScene(scene: MotionScene): MotionScene {
  const sceneId = uid("scene");
  const nodeIds = new Map(scene.nodes.map((node) => [node.id, uid("node")]));
  const clipIds = new Map(scene.clips.map((clip) => [clip.id, uid("clip")]));
  return {
    ...structuredClone(scene),
    id: sceneId,
    name: `${scene.name ?? scene.id} copy`,
    nodes: scene.nodes.map((node) => ({
      ...structuredClone(node),
      id: nodeIds.get(node.id)!,
      parentId: node.parentId ? nodeIds.get(node.parentId) ?? null : null,
      mask: node.mask
        ? { ...node.mask, sourceNodeId: nodeIds.get(node.mask.sourceNodeId) ?? node.mask.sourceNodeId }
        : undefined,
    })),
    clips: scene.clips.map((clip) => ({
      ...structuredClone(clip),
      id: clipIds.get(clip.id)!,
      targetId: clip.targetId ? nodeIds.get(clip.targetId) ?? clip.targetId : clip.targetId,
      schedule: clip.schedule.kind === "absolute"
        ? clip.schedule
        : {
            ...clip.schedule,
            clipId: clipIds.get(clip.schedule.clipId) ?? clip.schedule.clipId,
          },
      source: clip.source.kind === "tracks"
        ? { ...clip.source, tracks: clip.source.tracks.map((track) => ({ ...track, targetId: nodeIds.get(track.targetId) ?? track.targetId })) }
        : clip.source,
    })),
  };
}

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

function insertAfter<T extends { id: string }>(items: T[], afterId: string, item: T): T[] {
  const index = items.findIndex((candidate) => candidate.id === afterId);
  if (index < 0) return [...items, item];
  const next = [...items];
  next.splice(index + 1, 0, item);
  return next;
}

function insertOrder(order: string[], afterId: string, id: string): string[] {
  const index = order.indexOf(afterId);
  if (index < 0) return [...order, id];
  const next = [...order];
  next.splice(index + 1, 0, id);
  return next;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  selectedSceneId: null,
  selectedNodeId: null,
  sceneClipboard: null,
  isExporting: false,
  activeSidebarTab: "frame",
  sidebarOpen: true,

  loadProject: (input) => {
    const project = parseMotionProject(input);
    const firstScene = project.scenes.find((scene) => scene.id === project.timeline.sceneOrder[0]) ?? project.scenes[0];
    set({ project, selectedSceneId: firstScene?.id ?? null, selectedNodeId: firstEditableNode(firstScene)?.id ?? null });
  },

  selectScene: (sceneId) => {
    const scene = get().project?.scenes.find((candidate) => candidate.id === sceneId);
    set({ selectedSceneId: sceneId, selectedNodeId: firstEditableNode(scene)?.id ?? null });
  },

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab, sidebarOpen: true }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  updateBrand: (patch) => {
    const project = get().project;
    if (!project) return;
    const brand = { ...project.metadata.brand, ...patch };
    let variables = project.variables;
    if (patch.name !== undefined) variables = updateVariable({ ...project, variables }, "project.brandName", patch.name);
    if (patch.primaryColor !== undefined) variables = updateVariable({ ...project, variables }, "project.primaryColor", patch.primaryColor);
    set({ project: { ...project, metadata: { ...project.metadata, name: patch.name ?? project.metadata.name, brand }, variables } });
  },

  updateSceneDuration: (sceneId, duration) => {
    const project = get().project;
    if (!project) return;
    set({ project: { ...project, scenes: project.scenes.map((scene) => scene.id === sceneId ? { ...scene, duration: Math.max(0.5, duration) } : scene) } });
  },

  updateNodeText: (sceneId, nodeId, text) => {
    const project = get().project;
    if (!project) return;
    set({ project: mapNode(project, sceneId, nodeId, (node) => node.type === "text"
      ? { ...node, payload: { ...node.payload, text } }
      : node) });
  },

  updateNodePosition: (sceneId, nodeId, position) => {
    const project = get().project;
    if (!project) return;
    set({ project: mapNode(project, sceneId, nodeId, (node) => ({
      ...node,
      transform: { ...node.transform, x: position.x ?? node.transform.x, y: position.y ?? node.transform.y },
    })) });
  },

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

  setAspectRatio: (aspectRatio) => {
    const project = get().project;
    if (project) set({ project: { ...project, metadata: { ...project.metadata, aspectRatio } } });
  },

  copyScene: (sceneId) => {
    const scene = get().project?.scenes.find((candidate) => candidate.id === sceneId);
    if (scene) set({ sceneClipboard: structuredClone(scene) });
  },

  cutScene: (sceneId) => {
    if ((get().project?.scenes.length ?? 0) < 1) return;
    get().copyScene(sceneId);
    get().deleteScene(sceneId);
  },

  pasteScene: (afterSceneId) => {
    const { project, sceneClipboard } = get();
    if (!project || !sceneClipboard) return;
    const scene = cloneScene(sceneClipboard);
    set({
      project: {
        ...project,
        scenes: insertAfter(project.scenes, afterSceneId, scene),
        timeline: { ...project.timeline, sceneOrder: insertOrder(project.timeline.sceneOrder, afterSceneId, scene.id) },
      },
      selectedSceneId: scene.id,
      selectedNodeId: firstEditableNode(scene)?.id ?? null,
    });
  },

  duplicateScene: (sceneId) => {
    const project = get().project;
    const source = project?.scenes.find((scene) => scene.id === sceneId);
    if (!project || !source) return;
    const scene = cloneScene(source);
    set({
      project: {
        ...project,
        scenes: insertAfter(project.scenes, sceneId, scene),
        timeline: { ...project.timeline, sceneOrder: insertOrder(project.timeline.sceneOrder, sceneId, scene.id) },
      },
      selectedSceneId: scene.id,
      selectedNodeId: firstEditableNode(scene)?.id ?? null,
    });
  },

  renameScene: (sceneId, role) => {
    const project = get().project;
    if (!project) return;
    set({ project: { ...project, scenes: project.scenes.map((scene) => scene.id === sceneId ? { ...scene, name: role, semantic: { role, tags: [] } } : scene) } });
  },

  deleteScene: (sceneId) => {
    const project = get().project;
    if (!project) return;
    const scenes = project.scenes.filter((scene) => scene.id !== sceneId);
    const sceneOrder = project.timeline.sceneOrder.filter((id) => id !== sceneId);
    const next = scenes.find((scene) => scene.id === sceneOrder[0]) ?? scenes[0];
    set({
      project: {
        ...project,
        scenes,
        timeline: { ...project.timeline, sceneOrder },
        bindings: project.bindings.filter((binding) => binding.target.sceneId !== sceneId),
      },
      selectedSceneId: next?.id ?? null,
      selectedNodeId: firstEditableNode(next)?.id ?? null,
    });
  },

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
      selectedNodeId: firstEditableNode(scene)?.id ?? null,
    });
  },

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
      ? [...project.assets, audioAsset as any]
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

  setExporting: (value) => set({ isExporting: value }),
}));

export function validateEditorProject(project: MotionProject): MotionProject {
  const sanitizedAssets = project.assets.map((asset) => {
    if ((asset as any).assetType === "audio") {
      const a = asset as any;
      return {
        ...a,
        mimeType:
          a.mimeType === "audio/mp3" || !a.mimeType
            ? "audio/mpeg"
            : a.mimeType,
        codec: a.codec ?? "mp3",
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
