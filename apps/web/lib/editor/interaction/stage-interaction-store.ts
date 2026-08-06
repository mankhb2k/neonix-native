/**
 * Thin Zustand façade over createStageSession for legacy web tests.
 * Prefer @motionvideo/editor-react useStagePointerSession in UI.
 */

"use client";

import { create } from "zustand";
import {
  createStageSession,
  type ResizeHandle,
  type StageSession,
  type StageTransformValues,
} from "@motionvideo/editor-interactions";

export type StageInteractionMode = "idle" | "move" | "resize" | "rotate";

export type StageTransformPatch = StageTransformValues;

type StageInteractionState = {
  mode: StageInteractionMode;
  base: StageTransformPatch | null;
  preview: StageTransformPatch | null;
  handle: string | null;
  pointerStart: { x: number; y: number } | null;
  beginMove: (
    base: StageTransformPatch,
    compositionPoint: { x: number; y: number },
  ) => void;
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

let session: StageSession = createStageSession();
let interactionSeq = 0;

function nextId(): string {
  interactionSeq += 1;
  return `legacy-stage-${interactionSeq}`;
}

function syncFromSession(
  set: (partial: Partial<StageInteractionState>) => void,
  base: StageTransformPatch | null,
  handle: string | null,
  pointerStart: { x: number; y: number } | null,
): void {
  set({
    mode: session.mode,
    base,
    handle,
    pointerStart,
  });
}

export const useStageInteractionStore = create<StageInteractionState>(
  (set, get) => ({
    mode: "idle",
    base: null,
    preview: null,
    handle: null,
    pointerStart: null,
    beginMove: (base, compositionPoint) => {
      session.beginMove(
        {
          interactionId: nextId(),
          base,
          worldBounds: {
            x: base.x,
            y: base.y,
            width: base.width,
            height: base.height,
          },
          pointer: compositionPoint,
        },
        {
          onPreview: (payload) => {
            set({
              preview: payload.patches[0] ?? null,
              mode: session.mode,
            });
          },
        },
      );
      syncFromSession(set, base, null, compositionPoint);
      set({ preview: base });
    },
    beginResize: (base, handle, compositionPoint) => {
      session.beginResize(
        {
          interactionId: nextId(),
          base,
          worldBounds: {
            x: base.x,
            y: base.y,
            width: base.width,
            height: base.height,
          },
          handle: handle as ResizeHandle,
          pointer: compositionPoint,
        },
        {
          onPreview: (payload) => {
            set({
              preview: payload.patches[0] ?? null,
              mode: session.mode,
            });
          },
        },
      );
      syncFromSession(set, base, handle, compositionPoint);
      set({ preview: base });
    },
    beginRotate: (base, compositionPoint) => {
      session.beginRotate(
        {
          interactionId: nextId(),
          base,
          worldBounds: {
            x: base.x,
            y: base.y,
            width: base.width,
            height: base.height,
          },
          pointer: compositionPoint,
        },
        {
          onPreview: (payload) => {
            set({
              preview: payload.patches[0] ?? null,
              mode: session.mode,
            });
          },
        },
      );
      syncFromSession(set, base, "rotate", compositionPoint);
      set({ preview: base });
    },
    updatePointer: (compositionPoint) => {
      if (get().mode === "idle") return;
      session.updatePointer(compositionPoint);
    },
    cancel: () => {
      session.cancel();
      set({
        mode: "idle",
        base: null,
        preview: null,
        handle: null,
        pointerStart: null,
      });
    },
    takeCommit: () => {
      const result = session.commit("pointerup");
      set({
        mode: "idle",
        base: null,
        preview: null,
        handle: null,
        pointerStart: null,
      });
      return result?.patches[0]?.values ?? null;
    },
  }),
);
