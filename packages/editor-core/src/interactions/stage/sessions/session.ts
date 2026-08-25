/**
 * Phiên transform trên stage — begin / update / cancel / commit với callback preview.
 */

import type { PointerModifiers } from "../../common/modifiers";
import {
  shouldCommitPointerSession,
  type PointerSessionEndReason,
} from "../../pointer/pointer-session";
import type { StagePoint } from "../coordinates";
import {
  applyMoveConstraints,
  applyResizeConstraints,
  applyRotateConstraints,
  type StageConstraintInput,
  type StageGuide,
} from "../constraints";
import {
  selectionBoxFromWorldAndDelta,
  type ResizeHandle,
  type SelectionBox,
  type StageBounds,
  type StageTransformValues,
} from "../transform-box";
import { applyMoveDelta, applyResizeDelta, applyRotateDelta } from "./math";
import {
  toStageDocumentCommand,
  toStageLayerPatches,
  type StageCommitResult,
} from "../commit";

export type StageInteractionMode = "idle" | "move" | "resize" | "rotate";

export type StagePreviewPayload = {
  interactionId: string;
  patches: StageTransformValues[];
  guides: StageGuide[];
  selectionBox: SelectionBox | null;
};

export type StageSessionCallbacks = {
  onPreview: (payload: StagePreviewPayload) => void;
};

export type BeginMoveArgs = {
  interactionId: string;
  base: StageTransformValues;
  worldBounds: StageBounds;
  pointer: StagePoint;
  constraints?: StageConstraintInput;
};

export type BeginResizeArgs = BeginMoveArgs & { handle: ResizeHandle };
export type BeginRotateArgs = BeginMoveArgs;

type ActiveSession = {
  mode: Exclude<StageInteractionMode, "idle">;
  interactionId: string;
  base: StageTransformValues;
  preview: StageTransformValues;
  worldBounds: StageBounds;
  pointerStart: StagePoint;
  handle: ResizeHandle | null;
  constraints: StageConstraintInput;
  guides: StageGuide[];
  callbacks: StageSessionCallbacks;
};

export type StageSession = {
  readonly mode: StageInteractionMode;
  readonly interactionId: string | null;
  beginMove(args: BeginMoveArgs, cb: StageSessionCallbacks): void;
  beginResize(args: BeginResizeArgs, cb: StageSessionCallbacks): void;
  beginRotate(args: BeginRotateArgs, cb: StageSessionCallbacks): void;
  updatePointer(pointer: StagePoint, modifiers?: PointerModifiers): void;
  cancel(): void;
  commit(reason?: PointerSessionEndReason): StageCommitResult | null;
};

function emitPreview(active: ActiveSession): void {
  const selectionBox = selectionBoxFromWorldAndDelta(
    active.worldBounds,
    active.base,
    active.preview,
  );
  active.callbacks.onPreview({
    interactionId: active.interactionId,
    patches: [active.preview],
    guides: active.guides,
    selectionBox,
  });
}

function clearPreview(active: ActiveSession | null): void {
  if (!active) return;
  active.callbacks.onPreview({
    interactionId: active.interactionId,
    patches: [],
    guides: [],
    selectionBox: null,
  });
}

export function createStageSession(): StageSession {
  let active: ActiveSession | null = null;

  const api: StageSession = {
    get mode() {
      return active?.mode ?? "idle";
    },
    get interactionId() {
      return active?.interactionId ?? null;
    },
    beginMove(args, cb) {
      active = {
        mode: "move",
        interactionId: args.interactionId,
        base: args.base,
        preview: args.base,
        worldBounds: args.worldBounds,
        pointerStart: args.pointer,
        handle: null,
        constraints: args.constraints ?? {},
        guides: [],
        callbacks: cb,
      };
      emitPreview(active);
    },
    beginResize(args, cb) {
      active = {
        mode: "resize",
        interactionId: args.interactionId,
        base: args.base,
        preview: args.base,
        worldBounds: args.worldBounds,
        pointerStart: args.pointer,
        handle: args.handle,
        constraints: args.constraints ?? {},
        guides: [],
        callbacks: cb,
      };
      emitPreview(active);
    },
    beginRotate(args, cb) {
      active = {
        mode: "rotate",
        interactionId: args.interactionId,
        base: args.base,
        preview: args.base,
        worldBounds: args.worldBounds,
        pointerStart: args.pointer,
        handle: null,
        constraints: args.constraints ?? {},
        guides: [],
        callbacks: cb,
      };
      emitPreview(active);
    },
    updatePointer(pointer, modifiers) {
      if (!active) return;
      const lockAspect =
        Boolean(modifiers?.shift) || Boolean(active.constraints.lockAspect);
      const constraints: StageConstraintInput = {
        ...active.constraints,
        lockAspect,
        snapAngle: Boolean(modifiers?.shift) || Boolean(active.constraints.snapAngle),
      };

      let next: StageTransformValues;
      let guides: StageGuide[] = [];

      if (active.mode === "move") {
        next = applyMoveDelta(active.base, active.pointerStart, pointer);
        const constrained = applyMoveConstraints(next, constraints);
        next = constrained.values;
        guides = constrained.guides;
      } else if (active.mode === "resize" && active.handle) {
        const resizeFromCenter = Boolean(modifiers?.alt);
        next = applyResizeDelta(
          active.base,
          active.handle,
          active.pointerStart,
          pointer,
          constraints.minSize ?? 8,
          resizeFromCenter,
        );
        const constrained = applyResizeConstraints(
          next,
          active.base,
          { ...constraints, resizeFromCenter },
        );
        next = constrained.values;
        guides = constrained.guides;
      } else if (active.mode === "rotate") {
        next = applyRotateDelta(active.base, active.pointerStart, pointer);
        const constrained = applyRotateConstraints(next, constraints);
        next = constrained.values;
        guides = constrained.guides;
      } else {
        return;
      }

      active.preview = next;
      active.guides = guides;
      emitPreview(active);
    },
    cancel() {
      clearPreview(active);
      active = null;
    },
    commit(reason: PointerSessionEndReason = "pointerup") {
      if (!active) return null;
      if (!shouldCommitPointerSession(reason)) {
        clearPreview(active);
        active = null;
        return null;
      }
      const session = active;
      const patches = toStageLayerPatches(session.base, session.preview);
      const command = toStageDocumentCommand(patches);
      const result: StageCommitResult = {
        interactionId: session.interactionId,
        mode: session.mode,
        patches,
        command,
      };
      clearPreview(session);
      active = null;
      return result;
    },
  };

  return api;
}
