"use client";

import { create } from "zustand";

export type StageInteractionMode = "idle" | "move" | "resize" | "rotate";

export type StageTransformPatch = {
  sceneId: string;
  nodeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

type StageInteractionState = {
  mode: StageInteractionMode;
  /** Base values at pointerdown */
  base: StageTransformPatch | null;
  /** Live preview while dragging */
  preview: StageTransformPatch | null;
  handle: string | null;
  pointerStart: { x: number; y: number } | null;
  beginMove: (base: StageTransformPatch, compositionPoint: { x: number; y: number }) => void;
  beginResize: (
    base: StageTransformPatch,
    handle: string,
    compositionPoint: { x: number; y: number },
  ) => void;
  beginRotate: (
    base: StageTransformPatch,
    compositionPoint: { x: number; y: number },
  ) => void;
  updatePointer: (compositionPoint: { x: number; y: number }) => void;
  cancel: () => void;
  takeCommit: () => StageTransformPatch | null;
};

function applyPointerDelta(
  state: StageInteractionState,
  point: { x: number; y: number },
): StageTransformPatch | null {
  if (!state.base || !state.pointerStart) return null;
  const dx = point.x - state.pointerStart.x;
  const dy = point.y - state.pointerStart.y;

  if (state.mode === "move") {
    return {
      ...state.base,
      x: state.base.x + dx,
      y: state.base.y + dy,
    };
  }

  if (state.mode === "resize" && state.handle) {
    const next = { ...state.base };
    const h = state.handle;
    if (h.includes("e")) next.width = Math.max(8, state.base.width + dx);
    if (h.includes("s")) next.height = Math.max(8, state.base.height + dy);
    if (h.includes("w")) {
      next.width = Math.max(8, state.base.width - dx);
      next.x = state.base.x + dx;
    }
    if (h.includes("n")) {
      next.height = Math.max(8, state.base.height - dy);
      next.y = state.base.y + dy;
    }
    return next;
  }

  if (state.mode === "rotate") {
    const cx = state.base.x + state.base.width / 2;
    const cy = state.base.y + state.base.height / 2;
    const startAngle = Math.atan2(
      state.pointerStart.y - cy,
      state.pointerStart.x - cx,
    );
    const angle = Math.atan2(point.y - cy, point.x - cx);
    const deltaDeg = ((angle - startAngle) * 180) / Math.PI;
    return {
      ...state.base,
      rotation: state.base.rotation + deltaDeg,
    };
  }

  return state.base;
}

export const useStageInteractionStore = create<StageInteractionState>(
  (set, get) => ({
    mode: "idle",
    base: null,
    preview: null,
    handle: null,
    pointerStart: null,
    beginMove: (base, compositionPoint) => {
      set({
        mode: "move",
        base,
        preview: base,
        handle: null,
        pointerStart: compositionPoint,
      });
    },
    beginResize: (base, handle, compositionPoint) => {
      set({
        mode: "resize",
        base,
        preview: base,
        handle,
        pointerStart: compositionPoint,
      });
    },
    beginRotate: (base, compositionPoint) => {
      set({
        mode: "rotate",
        base,
        preview: base,
        handle: "rotate",
        pointerStart: compositionPoint,
      });
    },
    updatePointer: (compositionPoint) => {
      const state = get();
      if (state.mode === "idle") return;
      const preview = applyPointerDelta(state, compositionPoint);
      if (preview) set({ preview });
    },
    cancel: () => {
      set({
        mode: "idle",
        base: null,
        preview: null,
        handle: null,
        pointerStart: null,
      });
    },
    takeCommit: () => {
      const { preview, mode } = get();
      set({
        mode: "idle",
        base: null,
        preview: null,
        handle: null,
        pointerStart: null,
      });
      return mode === "idle" ? null : preview;
    },
  }),
);
