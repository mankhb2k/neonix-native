"use client";

import { create } from "zustand";
import {
  parseMotionProject,
  type Layer,
  type MotionProject,
  type Scene,
} from "@motionvideo/motion-schema";
import { validateMotionProjectPresets } from "@motionvideo/template-library";

export type ChatRole = "user" | "assistant";

export type ProjectPatch = Partial<{
  brandName: string;
  primaryColor: string;
  layerText: { sceneId: string; layerId: string; content: string };
  aspectRatio: MotionProject["aspectRatio"];
  projectJson: unknown;
  animationPreset: { sceneId: string; layerId: string; preset: string };
}>;

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  pendingPatch?: ProjectPatch;
};

export type SceneRole = NonNullable<Scene["role"]>;

type EditorState = {
  project: MotionProject | null;
  selectedSceneId: string | null;
  selectedLayerId: string | null;
  sceneClipboard: Scene | null;
  messages: ChatMessage[];
  isExporting: boolean;
  activeSidebarTab: string;
  sidebarOpen: boolean;
  loadProject: (project: MotionProject) => void;
  selectScene: (sceneId: string) => void;
  selectLayer: (layerId: string | null) => void;
  setActiveSidebarTab: (tab: string) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  updateBrand: (patch: Partial<MotionProject["brand"]>) => void;
  updateSceneDuration: (sceneId: string, duration: number) => void;
  updateLayerContent: (sceneId: string, layerId: string, content: string) => void;
  updateLayerPosition: (
    sceneId: string,
    layerId: string,
    pos: { x?: number; y?: number },
  ) => void;
  updateLayerAnimation: (
    sceneId: string,
    layerId: string,
    patch: { preset?: string; duration?: number; delay?: number },
  ) => void;
  setAspectRatio: (aspectRatio: MotionProject["aspectRatio"]) => void;
  copyScene: (sceneId: string) => void;
  cutScene: (sceneId: string) => void;
  pasteScene: (afterSceneId: string) => void;
  duplicateScene: (sceneId: string) => void;
  renameScene: (sceneId: string, role: SceneRole) => void;
  deleteScene: (sceneId: string) => void;
  sendChat: (text: string) => void;
  applyPatch: (messageId: string) => void;
  dismissPatch: (messageId: string) => void;
  setExporting: (value: boolean) => void;
};

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function findTextLayer(scene: Scene): Layer | undefined {
  return scene.layers.find((l) => l.type === "text");
}

function cloneScene(scene: Scene): Scene {
  return {
    ...scene,
    id: uid("scene"),
    layers: scene.layers.map((layer) => ({
      ...layer,
      id: uid("layer"),
      animations: layer.animations.map((a) => ({ ...a })),
    })),
  };
}

function insertSceneAfter(
  scenes: Scene[],
  afterSceneId: string,
  scene: Scene,
): Scene[] {
  const index = scenes.findIndex((s) => s.id === afterSceneId);
  if (index < 0) return [...scenes, scene];
  const next = [...scenes];
  next.splice(index + 1, 0, scene);
  return next;
}

function mapLayer(
  project: MotionProject,
  sceneId: string,
  layerId: string,
  map: (l: Layer) => Layer,
): MotionProject {
  return {
    ...project,
    scenes: project.scenes.map((s) =>
      s.id !== sceneId
        ? s
        : {
            ...s,
            layers: s.layers.map((l) => (l.id === layerId ? map(l) : l)),
          },
    ),
  };
}

function proposeChatPatch(
  text: string,
  project: MotionProject | null,
  selectedSceneId: string | null,
  selectedLayerId: string | null,
): { reply: string; pendingPatch?: ProjectPatch } {
  const lower = text.toLowerCase();
  const colorMatch = text.match(/#([0-9a-fA-F]{3,8})\b/);

  if (colorMatch || lower.includes("màu")) {
    const color = colorMatch ? `#${colorMatch[1]}` : "#1A5D3A";
    return {
      reply: `Đề xuất đổi màu brand thành ${color}. Bấm Áp dụng.`,
      pendingPatch: { primaryColor: color },
    };
  }

  if (lower.includes("cta") || lower.includes("gọi")) {
    const scene =
      project?.scenes.find((s) => s.role === "cta") ??
      project?.scenes[project.scenes.length - 1];
    const layer = scene ? findTextLayer(scene) : undefined;
    if (scene && layer) {
      const content =
        text.replace(/^(đổi\s*)?(cta|chữ)?\s*[:=-]?\s*/i, "").trim() ||
        "Gọi ngay hôm nay";
      return {
        reply: `Đề xuất đổi chữ CTA thành «${content}».`,
        pendingPatch: {
          layerText: { sceneId: scene.id, layerId: layer.id, content },
        },
      };
    }
  }

  if (lower.includes("16:9") || lower.includes("ngang")) {
    return {
      reply: "Đề xuất đổi khung hình sang 16:9.",
      pendingPatch: { aspectRatio: "16:9" },
    };
  }

  if (
    lower.includes("9:16") ||
    lower.includes("dọc") ||
    lower.includes("tiktok")
  ) {
    return {
      reply: "Đề xuất đổi khung hình sang 9:16.",
      pendingPatch: { aspectRatio: "9:16" },
    };
  }

  if (lower.includes("tên") || lower.includes("brand")) {
    const name =
      text.replace(/.*(tên|brand)\s*[:=-]?\s*/i, "").trim() ||
      project?.brand.name ||
      "Brand";
    return {
      reply: `Đề xuất đổi tên brand thành «${name}».`,
      pendingPatch: { brandName: name },
    };
  }

  const jsonFence = text.match(/```(?:json|mt)?\s*([\s\S]*?)```/i);
  const rawJson =
    jsonFence?.[1]?.trim() ??
    (text.trim().startsWith("{") ? text.trim() : null);
  if (rawJson && project) {
    try {
      const parsed = JSON.parse(rawJson) as unknown;
      const brandPatch =
        typeof parsed === "object" &&
        parsed !== null &&
        "brand" in parsed &&
        typeof (parsed as { brand: unknown }).brand === "object" &&
        (parsed as { brand: unknown }).brand !== null
          ? ((parsed as { brand: Record<string, unknown> }).brand)
          : {};
      const merged = {
        ...project,
        ...(typeof parsed === "object" && parsed !== null
          ? (parsed as object)
          : {}),
        id: project.id,
        version: 1 as const,
        brand: { ...project.brand, ...brandPatch },
      };
      const validated = parseMotionProject(merged);
      const check = validateMotionProjectPresets(validated);
      if (!check.ok) {
        return {
          reply: `JSON gần đúng nhưng preset lạ: ${check.unknown
            .map((u) => u.preset)
            .join(", ")}`,
        };
      }
      return {
        reply:
          "Đề xuất áp dụng patch JSON vào project (Zod + registry OK). Bấm Áp dụng.",
        pendingPatch: { projectJson: validated },
      };
    } catch (err) {
      return {
        reply: `JSON không parse được: ${
          err instanceof Error ? err.message : "lỗi"
        }`,
      };
    }
  }

  const presetMatch = text.match(
    /(?:preset|animation|hiệu ứng)\s*[:=]?\s*([a-z0-9\-]+)/i,
  );
  if (presetMatch && selectedSceneId && selectedLayerId) {
    return {
      reply: `Đề xuất đổi animation thành «${presetMatch[1]}».`,
      pendingPatch: {
        animationPreset: {
          sceneId: selectedSceneId,
          layerId: selectedLayerId,
          preset: presetMatch[1]!,
        },
      },
    };
  }

  if (lower.includes("chậm") && project && selectedSceneId && selectedLayerId) {
    const layer = project.scenes
      .find((s) => s.id === selectedSceneId)
      ?.layers.find((l) => l.id === selectedLayerId);
    const cur = layer?.animations[0]?.duration ?? 0.6;
    const next = mapLayer(project, selectedSceneId, selectedLayerId, (l) => ({
      ...l,
      animations:
        l.animations.length > 0
          ? l.animations.map((a, i) =>
              i === 0 ? { ...a, duration: cur + 0.4 } : a,
            )
          : [{ preset: "fade-up", start: 0, duration: cur + 0.4 }],
    }));
    return {
      reply: `Đề xuất tăng duration lên ${(cur + 0.4).toFixed(1)}s.`,
      pendingPatch: { projectJson: next },
    };
  }

  return {
    reply:
      "Thử: đổi màu #hex, CTA, tỉ lệ, tên brand — hoặc dán ```json``` (.mt) để patch.",
  };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  selectedSceneId: null,
  selectedLayerId: null,
  sceneClipboard: null,
  messages: [
    {
      id: "welcome",
      role: "assistant",
      content:
        "Mình đã tải timeline. Đổi chữ/màu, dán JSON ```json```, hoặc Xuất MP4.",
    },
  ],
  isExporting: false,
  activeSidebarTab: "frame",
  sidebarOpen: true,

  loadProject: (project) => {
    const firstScene = project.scenes[0];
    const firstLayer = firstScene?.layers[0];
    set({
      project,
      selectedSceneId: firstScene?.id ?? null,
      selectedLayerId: firstLayer?.id ?? null,
      messages: [
        {
          id: "welcome",
          role: "assistant",
          content: `Đã mở «${project.brand.name}» · ${project.scenes.length} scene.`,
        },
      ],
    });
  },

  selectScene: (sceneId) => {
    const project = get().project;
    const scene = project?.scenes.find((s) => s.id === sceneId);
    set({
      selectedSceneId: sceneId,
      selectedLayerId: scene?.layers[0]?.id ?? null,
    });
  },

  selectLayer: (layerId) => set({ selectedLayerId: layerId }),

  setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab, sidebarOpen: true }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  updateBrand: (patch) => {
    const project = get().project;
    if (!project) return;
    set({
      project: { ...project, brand: { ...project.brand, ...patch } },
    });
  },

  updateSceneDuration: (sceneId, duration) => {
    const project = get().project;
    if (!project) return;
    set({
      project: {
        ...project,
        scenes: project.scenes.map((s) =>
          s.id === sceneId ? { ...s, duration: Math.max(0.5, duration) } : s,
        ),
      },
    });
  },

  updateLayerContent: (sceneId, layerId, content) => {
    const project = get().project;
    if (!project) return;
    set({
      project: mapLayer(project, sceneId, layerId, (l) => ({ ...l, content })),
    });
  },

  updateLayerPosition: (sceneId, layerId, pos) => {
    const project = get().project;
    if (!project) return;
    set({
      project: mapLayer(project, sceneId, layerId, (l) => ({
        ...l,
        x: pos.x ?? l.x,
        y: pos.y ?? l.y,
      })),
    });
  },

  updateLayerAnimation: (sceneId, layerId, patch) => {
    const project = get().project;
    if (!project) return;
    set({
      project: mapLayer(project, sceneId, layerId, (l) => {
        const animations =
          l.animations.length > 0
            ? l.animations.map((a, i) =>
                i === 0
                  ? {
                      ...a,
                      ...(patch.preset !== undefined
                        ? { preset: patch.preset }
                        : {}),
                      ...(patch.duration !== undefined
                        ? { duration: Math.max(0.1, patch.duration) }
                        : {}),
                      ...(patch.delay !== undefined
                        ? { delay: Math.max(0, patch.delay) }
                        : {}),
                    }
                  : a,
              )
            : [
                {
                  preset: patch.preset ?? "fade-in",
                  start: 0,
                  duration: patch.duration ?? 0.6,
                  delay: patch.delay ?? 0,
                },
              ];
        return { ...l, animations };
      }),
    });
  },

  setAspectRatio: (aspectRatio) => {
    const project = get().project;
    if (!project) return;
    set({ project: { ...project, aspectRatio } });
  },

  copyScene: (sceneId) => {
    const scene = get().project?.scenes.find((s) => s.id === sceneId);
    if (!scene) return;
    set({ sceneClipboard: cloneScene(scene) });
  },

  cutScene: (sceneId) => {
    const { project, copyScene, deleteScene } = get();
    if (!project || project.scenes.length <= 1) return;
    copyScene(sceneId);
    deleteScene(sceneId);
  },

  pasteScene: (afterSceneId) => {
    const { project, sceneClipboard } = get();
    if (!project || !sceneClipboard) return;
    const pasted = cloneScene(sceneClipboard);
    set({
      project: {
        ...project,
        scenes: insertSceneAfter(project.scenes, afterSceneId, pasted),
      },
      selectedSceneId: pasted.id,
      selectedLayerId: pasted.layers[0]?.id ?? null,
    });
  },

  duplicateScene: (sceneId) => {
    const project = get().project;
    const scene = project?.scenes.find((s) => s.id === sceneId);
    if (!project || !scene) return;
    const duplicated = cloneScene(scene);
    set({
      project: {
        ...project,
        scenes: insertSceneAfter(project.scenes, sceneId, duplicated),
      },
      selectedSceneId: duplicated.id,
      selectedLayerId: duplicated.layers[0]?.id ?? null,
    });
  },

  renameScene: (sceneId, role) => {
    const project = get().project;
    if (!project) return;
    set({
      project: {
        ...project,
        scenes: project.scenes.map((s) =>
          s.id === sceneId ? { ...s, role } : s,
        ),
      },
    });
  },

  deleteScene: (sceneId) => {
    const project = get().project;
    if (!project || project.scenes.length <= 1) return;
    const index = project.scenes.findIndex((s) => s.id === sceneId);
    if (index < 0) return;
    const scenes = project.scenes.filter((s) => s.id !== sceneId);
    const nextSelected =
      scenes[Math.min(index, scenes.length - 1)] ?? scenes[0]!;
    set({
      project: { ...project, scenes },
      selectedSceneId: nextSelected.id,
      selectedLayerId: nextSelected.layers[0]?.id ?? null,
    });
  },

  sendChat: (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const { reply, pendingPatch } = proposeChatPatch(
      trimmed,
      get().project,
      get().selectedSceneId,
      get().selectedLayerId,
    );
    set({
      messages: [
        ...get().messages,
        { id: uid("u"), role: "user", content: trimmed },
        {
          id: uid("a"),
          role: "assistant",
          content: reply,
          pendingPatch,
        },
      ],
    });
  },

  applyPatch: (messageId) => {
    const msg = get().messages.find((m) => m.id === messageId);
    const patch = msg?.pendingPatch;
    if (!patch) return;

    if (patch.projectJson) {
      try {
        const validated = parseMotionProject(patch.projectJson);
        const check = validateMotionProjectPresets(validated);
        if (!check.ok) return;
        set({ project: validated });
      } catch {
        return;
      }
    }
    if (patch.primaryColor) {
      get().updateBrand({ primaryColor: patch.primaryColor });
    }
    if (patch.brandName) get().updateBrand({ name: patch.brandName });
    if (patch.aspectRatio) get().setAspectRatio(patch.aspectRatio);
    if (patch.layerText) {
      get().updateLayerContent(
        patch.layerText.sceneId,
        patch.layerText.layerId,
        patch.layerText.content,
      );
      get().selectScene(patch.layerText.sceneId);
    }
    if (patch.animationPreset) {
      get().updateLayerAnimation(
        patch.animationPreset.sceneId,
        patch.animationPreset.layerId,
        { preset: patch.animationPreset.preset },
      );
    }

    set({
      messages: get().messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              pendingPatch: undefined,
              content: `${m.content}\n\n✓ Đã áp dụng vào timeline.`,
            }
          : m,
      ),
    });
  },

  dismissPatch: (messageId) => {
    set({
      messages: get().messages.map((m) =>
        m.id === messageId ? { ...m, pendingPatch: undefined } : m,
      ),
    });
  },

  setExporting: (value) => set({ isExporting: value }),
}));
