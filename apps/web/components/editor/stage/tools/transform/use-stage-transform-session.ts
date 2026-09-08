"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from "react";

import { useStagePreviewCommit } from "@/lib/store/stage-interaction-store";
import {
  createStageSession,
  type StageSession,
  type StageLayerBounds,
  type StageTransformValues,
} from "@motionvideo/editor-core/interactions/stage";
import {
  buildMoveTransformCommand,
  buildResizeTransformCommand,
  buildRotateTransformCommand,
} from "./stage-transform-command-adapter";
import { cancelStageCommand, commitStageCommand } from "./transform-lifecycle";
import type { EditorCommand } from "@motionvideo/editor-core";
import type { MotionProtocolV2, V2Layer } from "@motionvideo/motion-protocol/v2";


type ActiveMove = {
  primaryId: string;
  bases: ReadonlyMap<string, StageTransformValues>;
};

type ActiveResize = {
  layerId: string;
  base: StageTransformValues;
  handle: "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";
};

type ActiveRotate = {
  layerId: string;
  base: StageTransformValues;
};

export type StageTransformSession = {
  overlayRef: RefObject<HTMLDivElement | null>;
  sessionRef: MutableRefObject<StageSession | null>;
  activeMoveRef: MutableRefObject<ActiveMove | null>;
  activeResizeRef: MutableRefObject<ActiveResize | null>;
  activeRotateRef: MutableRefObject<ActiveRotate | null>;
  finishingTransformRef: MutableRefObject<boolean>;
  pendingCommitRef: MutableRefObject<boolean>;
  interactionSelectionBox: StageLayerBounds | null;
  setInteractionSelectionBox: Dispatch<SetStateAction<StageLayerBounds | null>>;
  setInteractionCursor: (cursor: string) => void;
  clearInteractionCursor: () => void;
  previewCommand: (command: EditorCommand | null) => void;
  finishMove: () => void;
  finishResize: () => Promise<void>;
  finishRotate: () => void;
  cancel: () => void;
};

type Props = {
  document: MotionProtocolV2;
  currentTime: number;
  evaluatedLayersById: ReadonlyMap<string, V2Layer>;
  applyCommand: (command: EditorCommand) => boolean;
  previewCommand: (command: EditorCommand | null) => void;
};

export function useStageTransformSession({
  document,
  currentTime,
  evaluatedLayersById,
  applyCommand,
  previewCommand,
}: Props): StageTransformSession {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<StageSession | null>(null);
  const activeMoveRef = useRef<ActiveMove | null>(null);
  const activeResizeRef = useRef<ActiveResize | null>(null);
  const activeRotateRef = useRef<ActiveRotate | null>(null);
  const activeCursorRef = useRef<{ root: string; body: string; overlay: string } | null>(null);
  const finishingTransformRef = useRef(false);
  const pendingCommitRef = useRef(false);
  const [interactionSelectionBox, setInteractionSelectionBox] = useState<StageLayerBounds | null>(null);
  const stagePreviewCommit = useStagePreviewCommit();

  if (!sessionRef.current) {
    sessionRef.current = createStageSession();
  }

  const setInteractionCursor = useCallback((cursor: string) => {
    if (typeof globalThis.document === "undefined") return;
    const root = globalThis.document.documentElement;
    const body = globalThis.document.body;
    const overlay = overlayRef.current;
    if (!activeCursorRef.current) {
      activeCursorRef.current = {
        root: root.style.cursor,
        body: body.style.cursor,
        overlay: overlay?.style.cursor ?? "",
      };
    }
    root.style.cursor = cursor;
    body.style.cursor = cursor;
    if (overlay) overlay.style.cursor = cursor;
  }, []);

  const clearInteractionCursor = useCallback(() => {
    const previous = activeCursorRef.current;
    if (!previous || typeof globalThis.document === "undefined") return;
    const root = globalThis.document.documentElement;
    const body = globalThis.document.body;
    root.style.cursor = previous.root;
    body.style.cursor = previous.body;
    if (overlayRef.current) overlayRef.current.style.cursor = previous.overlay;
    activeCursorRef.current = null;
  }, []);

  const resetUncommittedTransform = useCallback(() => {
    cancelStageCommand(previewCommand);
    finishingTransformRef.current = false;
    setInteractionSelectionBox(null);
  }, [previewCommand]);

  const finishMove = useCallback(
    () => {
      const active = activeMoveRef.current;
      const session = sessionRef.current;
      if (!active || !session || finishingTransformRef.current) return;

      finishingTransformRef.current = true;
      const layers = active.bases
        ? [...active.bases.keys()]
            .map((id) => document.layers.find((layer) => layer.id === id))
            .filter((layer): layer is V2Layer => Boolean(layer))
        : [];
      const result = session.commit("pointerup");
      const primaryPreview = result?.patches[0]?.values;
      const primaryBase = active.bases.get(active.primaryId);
      activeMoveRef.current = null;
      if (!primaryPreview || !primaryBase) {
        resetUncommittedTransform();
        return;
      }
      const deltaX = primaryPreview.x - primaryBase.x;
      const deltaY = primaryPreview.y - primaryBase.y;
      if (Math.abs(deltaX) < 1e-6 && Math.abs(deltaY) < 1e-6) {
        resetUncommittedTransform();
        return;
      }
      const command = buildMoveTransformCommand({
        layers,
        evaluatedLayersById,
        timeSeconds: currentTime,
        deltaX,
        deltaY,
      });

      if (!command) {
        resetUncommittedTransform();
        return;
      }
      pendingCommitRef.current = true;
      if (!commitStageCommand({ sourceProject: document, command, applyCommand })) {
        pendingCommitRef.current = false;
      }
      if (!pendingCommitRef.current) {
        resetUncommittedTransform();
      }
    },
    [applyCommand, currentTime, document, evaluatedLayersById, resetUncommittedTransform],
  );

  const finishResize = useCallback(
    async () => {
      const active = activeResizeRef.current;
      const session = sessionRef.current;
      if (!active || !session || finishingTransformRef.current) return;

      const layer = document.layers.find((candidate) => candidate.id === active.layerId);
      const evaluatedLayer = evaluatedLayersById.get(active.layerId) ?? layer;
      if (!layer || !evaluatedLayer) return;

      finishingTransformRef.current = true;
      const result = session.commit("pointerup");
      const preview = result?.patches[0]?.values;
      activeResizeRef.current = null;
      if (!preview) {
        resetUncommittedTransform();
        return;
      }
      const command = await buildResizeTransformCommand({
        document,
        layer,
        evaluatedLayer,
        base: active.base,
        preview,
        handle: active.handle,
        timeSeconds: currentTime,
      });

      if (!command) {
        resetUncommittedTransform();
        return;
      }

      pendingCommitRef.current = true;
      if (!commitStageCommand({ sourceProject: document, command, applyCommand })) {
        pendingCommitRef.current = false;
      }
      if (!pendingCommitRef.current) {
        resetUncommittedTransform();
      }
    },
    [applyCommand, currentTime, document, evaluatedLayersById, resetUncommittedTransform],
  );

  const finishRotate = useCallback(
    () => {
      const active = activeRotateRef.current;
      const session = sessionRef.current;
      if (!active || !session || finishingTransformRef.current) return;

      const layer = document.layers.find((candidate) => candidate.id === active.layerId);
      const evaluatedLayer = evaluatedLayersById.get(active.layerId) ?? layer;
      if (!layer || !evaluatedLayer) return;

      finishingTransformRef.current = true;
      const result = session.commit("pointerup");
      const preview = result?.patches[0]?.values;
      activeRotateRef.current = null;
      if (!preview) {
        resetUncommittedTransform();
        return;
      }
      const command = buildRotateTransformCommand({
        layer,
        evaluatedLayer,
        timeSeconds: currentTime,
        rotationDelta: preview.rotation - active.base.rotation,
      });

      if (!command) {
        resetUncommittedTransform();
        return;
      }
      pendingCommitRef.current = true;
      if (!commitStageCommand({ sourceProject: document, command, applyCommand })) {
        pendingCommitRef.current = false;
      }
      if (!pendingCommitRef.current) {
        resetUncommittedTransform();
      }
    },
    [applyCommand, currentTime, document, evaluatedLayersById, resetUncommittedTransform],
  );

  const cancel = useCallback(() => {
    clearInteractionCursor();
    cancelStageCommand(previewCommand);
    setInteractionSelectionBox(null);
    sessionRef.current?.cancel();
    activeMoveRef.current = null;
    activeResizeRef.current = null;
    activeRotateRef.current = null;
    finishingTransformRef.current = false;
  }, [clearInteractionCursor, previewCommand]);

  useEffect(() => {
    if (!stagePreviewCommit.pending && pendingCommitRef.current) {
      pendingCommitRef.current = false;
      activeMoveRef.current = null;
      activeResizeRef.current = null;
      activeRotateRef.current = null;
      setInteractionSelectionBox(null);
    }
  }, [stagePreviewCommit.pending]);

  useEffect(() => () => {
    sessionRef.current?.cancel();
    cancelStageCommand(previewCommand);
    clearInteractionCursor();
  }, [clearInteractionCursor, previewCommand]);

  return {
    overlayRef,
    sessionRef,
    activeMoveRef,
    activeResizeRef,
    activeRotateRef,
    finishingTransformRef,
    pendingCommitRef,
    interactionSelectionBox,
    setInteractionSelectionBox,
    setInteractionCursor,
    clearInteractionCursor,
    previewCommand,
    finishMove,
    finishResize,
    finishRotate,
    cancel,
  };
}
