"use client";

import { create } from "zustand";
import type {
  AnimationPreset,
  Layer,
  MotionProject,
  Scene,
} from "@motionvideo/motion-schema";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  pendingPatch?: Partial<{
    brandName?: string;
    primaryColor?: string;
    layerText?: { sceneId: string; layerId: string; content: string };
    aspectRatio?: MotionProject["aspectRatio"];
  }>;
};

type EditorState = {
  project: MotionProject | null;
  selectedSceneId: string | null;
  selectedLayerId: string | null;
  messages: ChatMessage[];
  isExporting: boolean;
  loadProject: (project: MotionProject) => void;
  selectScene: (sceneId: string) => void;
  selectLayer: (layerId: string | null) => void;
  updateBrand: (patch: Partial<MotionProject["brand"]>) => void;
  updateSceneDuration: (sceneId: string, duration: number) => void;
  updateLayerContent: (sceneId: string, layerId: string, content: string) => void;
  updateLayerAnimation: (
    sceneId: string,
    layerId: string,
    preset: AnimationPreset,
  ) => void;
  setAspectRatio: (aspectRatio: MotionProject["aspectRatio"]) => void;
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

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  selectedSceneId: null,
  selectedLayerId: null,
  messages: [
    {
      id: "welcome",
      role: "assistant",
      content:
        "Mình đã tải timeline từ template. Bạn có thể bảo mình đổi chữ, màu brand, CTA, hoặc tỉ lệ khung hình.",
    },
  ],
  isExporting: false,

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
          content: `Đã mở dự án «${project.brand.name}» · ${project.scenes.length} scene. Hãy chỉnh trực tiếp hoặc chat với mình.`,
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

  updateBrand: (patch) => {
    const project = get().project;
    if (!project) return;
    set({
      project: {
        ...project,
        brand: { ...project.brand, ...patch },
      },
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
      project: {
        ...project,
        scenes: project.scenes.map((s) =>
          s.id !== sceneId
            ? s
            : {
                ...s,
                layers: s.layers.map((l) =>
                  l.id === layerId ? { ...l, content } : l,
                ),
              },
        ),
      },
    });
  },

  updateLayerAnimation: (sceneId, layerId, preset) => {
    const project = get().project;
    if (!project) return;
    set({
      project: {
        ...project,
        scenes: project.scenes.map((s) =>
          s.id !== sceneId
            ? s
            : {
                ...s,
                layers: s.layers.map((l) => {
                  if (l.id !== layerId) return l;
                  const animations =
                    l.animations.length > 0
                      ? l.animations.map((a, i) =>
                          i === 0 ? { ...a, preset } : a,
                        )
                      : [{ preset, start: 0, duration: 0.6 }];
                  return { ...l, animations };
                }),
              },
        ),
      },
    });
  },

  setAspectRatio: (aspectRatio) => {
    const project = get().project;
    if (!project) return;
    set({ project: { ...project, aspectRatio } });
  },

  sendChat: (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const project = get().project;
    const userMsg: ChatMessage = {
      id: uid("u"),
      role: "user",
      content: trimmed,
    };

    const lower = trimmed.toLowerCase();
    let reply =
      "Mình đã ghi nhận. Với MVP này, thử các lệnh: đổi màu #hex, đổi CTA, đổi chữ scene, tỉ lệ 9:16 / 16:9.";
    let pendingPatch: ChatMessage["pendingPatch"];

    const colorMatch = trimmed.match(/#([0-9a-fA-F]{3,8})\b/);
    if (colorMatch || lower.includes("màu")) {
      const color = colorMatch ? `#${colorMatch[1]}` : "#1A5D3A";
      reply = `Đề xuất đổi màu brand thành ${color}. Bấm Áp dụng để cập nhật timeline.`;
      pendingPatch = { primaryColor: color };
    } else if (lower.includes("cta") || lower.includes("gọi")) {
      const scene =
        project?.scenes.find((s) => s.role === "cta") ??
        project?.scenes[project.scenes.length - 1];
      const layer = scene ? findTextLayer(scene) : undefined;
      if (scene && layer) {
        const content =
          trimmed.replace(/^(đổi\s*)?(cta|chữ)?\s*[:=-]?\s*/i, "").trim() ||
          "Gọi ngay hôm nay";
        reply = `Đề xuất đổi chữ CTA thành «${content}».`;
        pendingPatch = {
          layerText: { sceneId: scene.id, layerId: layer.id, content },
        };
      }
    } else if (lower.includes("16:9") || lower.includes("ngang")) {
      reply = "Đề xuất đổi khung hình sang 16:9 (YouTube / ngang).";
      pendingPatch = { aspectRatio: "16:9" };
    } else if (lower.includes("9:16") || lower.includes("dọc") || lower.includes("tiktok")) {
      reply = "Đề xuất đổi khung hình sang 9:16 (TikTok / Reels).";
      pendingPatch = { aspectRatio: "9:16" };
    } else if (lower.includes("tên") || lower.includes("brand")) {
      const name =
        trimmed.replace(/.*(tên|brand)\s*[:=-]?\s*/i, "").trim() ||
        project?.brand.name ||
        "Brand";
      reply = `Đề xuất đổi tên brand thành «${name}».`;
      pendingPatch = { brandName: name };
    }

    const assistantMsg: ChatMessage = {
      id: uid("a"),
      role: "assistant",
      content: reply,
      pendingPatch,
    };

    set({ messages: [...get().messages, userMsg, assistantMsg] });
  },

  applyPatch: (messageId) => {
    const msg = get().messages.find((m) => m.id === messageId);
    const patch = msg?.pendingPatch;
    if (!patch) return;

    if (patch.primaryColor) get().updateBrand({ primaryColor: patch.primaryColor });
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
