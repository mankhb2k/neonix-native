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
      targetId: clip.targetId ? nodeIds.get(clip.targetId) : undefined,
      schedule: clip.schedule.kind === "absolute"
        ? clip.schedule
        : { ...clip.schedule, clipId: clipIds.get(clip.schedule.clipId) ?? clip.schedule.clipId },
      source: clip.source.kind === "tracks"
        ? { ...clip.source, tracks: clip.source.tracks.map((track) => ({ ...track, targetId: nodeIds.get(track.targetId) ?? track.targetId })) }
        : clip.source,
    })),
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
    if ((get().project?.scenes.length ?? 0) <= 1) return;
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
    if (!project || project.scenes.length <= 1) return;
    const scenes = project.scenes.filter((scene) => scene.id !== sceneId);
    const sceneOrder = project.timeline.sceneOrder.filter((id) => id !== sceneId);
    const next = scenes.find((scene) => scene.id === sceneOrder[0]) ?? scenes[0];
    if (!next) return;
    set({
      project: {
        ...project,
        scenes,
        timeline: { ...project.timeline, sceneOrder },
        bindings: project.bindings.filter((binding) => binding.target.sceneId !== sceneId),
      },
      selectedSceneId: next.id,
      selectedNodeId: firstEditableNode(next)?.id ?? null,
    });
  },

  setExporting: (value) => set({ isExporting: value }),
}));

export function validateEditorProject(project: MotionProject): MotionProject {
  const parsed = parseMotionProject(project);
  const presets = validateMotionProjectPresets(parsed);
  if (!presets.ok) throw new Error(`Unknown presets: ${presets.unknown.map((item) => item.preset).join(", ")}`);
  return parsed;
}
