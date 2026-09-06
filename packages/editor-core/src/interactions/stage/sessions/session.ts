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
  /** Optional screen-space origin used for the click-vs-drag threshold. */
  screenPointer?: StagePoint;
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
  dragStarted: boolean;
  screenPointerStart: StagePoint | null;
};

export type StageSession = {
  readonly mode: StageInteractionMode;
  readonly interactionId: string | null;
  beginMove(args: BeginMoveArgs, cb: StageSessionCallbacks): void;
  beginResize(args: BeginResizeArgs, cb: StageSessionCallbacks): void;
  beginRotate(args: BeginRotateArgs, cb: StageSessionCallbacks): void;
  updatePointer(
    pointer: StagePoint,
    modifiers?: Partial<PointerModifiers>,
    screenPointer?: StagePoint,
  ): void;
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
        dragStarted: false,
        screenPointerStart: args.screenPointer ?? null,
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
        dragStarted: false,
        screenPointerStart: args.screenPointer ?? null,
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
        dragStarted: false,
        screenPointerStart: args.screenPointer ?? null,
      };
      emitPreview(active);
    },
    updatePointer(pointer, modifiers, screenPointer) {
      if (!active) return;
      if (!active.dragStarted && active.screenPointerStart && screenPointer) {
        const dx = screenPointer.x - active.screenPointerStart.x;
        const dy = screenPointer.y - active.screenPointerStart.y;
        if (Math.hypot(dx, dy) < 3) return;
      }
      active.dragStarted = true;
      const lockAspect =
        Boolean(modifiers?.shift) || Boolean(active.constraints.lockAspect);
      const constraints: StageConstraintInput = {
        ...active.constraints,
        lockAspect,
        snapAngle: Boolean(modifiers?.shift) || Boolean(active.constraints.snapAngle),
        disableSnapping: Boolean(modifiers?.ctrl) || Boolean(modifiers?.meta),
      };

      let next: StageTransformValues;
      let guides: StageGuide[] = [];

      if (active.mode === "move") {
        next = applyMoveDelta(active.base, active.pointerStart, pointer);
        const constrained = constraints.disableSnapping
          ? { values: next, guides: [] }
          : constraints.snapMove
            ? constraints.snapMove(next, active.base)
            : applyMoveConstraints(next, constraints);
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
      if (!session.dragStarted && session.screenPointerStart) {
        clearPreview(session);
        active = null;
        return null;
      }
      const changed =
        Math.abs(session.preview.x - session.base.x) > 1e-6 ||
        Math.abs(session.preview.y - session.base.y) > 1e-6 ||
        Math.abs(session.preview.width - session.base.width) > 1e-6 ||
        Math.abs(session.preview.height - session.base.height) > 1e-6 ||
        Math.abs(session.preview.rotation - session.base.rotation) > 1e-6;
      if (!changed) {
        clearPreview(session);
        active = null;
        return null;
      }
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
