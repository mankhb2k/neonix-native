/**
 * Controlled stage pointer session — React host over createStageSession.
 */

import { useCallback, useRef, useState } from "react";
import {
  createStageSession,
  type BeginMoveArgs,
  type BeginResizeArgs,
  type BeginRotateArgs,
  type PointerModifiers,
  type StageCommitResult,
  type StageInteractionMode,
  type StagePoint,
  type StagePreviewPayload,
  type StageSession,
  type StageTransformValues,
} from "@motionvideo/editor-interactions";

export type UseStagePointerSessionArgs = {
  onPreview?: (payload: StagePreviewPayload) => void;
  onCommit?: (result: StageCommitResult) => void;
};

export type UseStagePointerSessionResult = {
  mode: StageInteractionMode;
  interactionId: string | null;
  preview: StageTransformValues | null;
  base: StageTransformValues | null;
  beginMove: (args: BeginMoveArgs) => void;
  beginResize: (args: BeginResizeArgs) => void;
  beginRotate: (args: BeginRotateArgs) => void;
  updatePointer: (pointer: StagePoint, modifiers?: PointerModifiers) => void;
  cancel: () => void;
  commit: () => StageCommitResult | null;
};

export function useStagePointerSession(
  args: UseStagePointerSessionArgs = {},
): UseStagePointerSessionResult {
  const sessionRef = useRef<StageSession | null>(null);
  if (!sessionRef.current) {
    sessionRef.current = createStageSession();
  }
  const session = sessionRef.current;

  const [mode, setMode] = useState<StageInteractionMode>("idle");
  const [interactionId, setInteractionId] = useState<string | null>(null);
  const [preview, setPreview] = useState<StageTransformValues | null>(null);
  const [base, setBase] = useState<StageTransformValues | null>(null);

  const onPreviewRef = useRef(args.onPreview);
  const onCommitRef = useRef(args.onCommit);
  onPreviewRef.current = args.onPreview;
  onCommitRef.current = args.onCommit;

  const handlePreview = useCallback((payload: StagePreviewPayload) => {
    const next = payload.patches[0] ?? null;
    setPreview(next);
    setMode(session.mode);
    setInteractionId(payload.interactionId);
    onPreviewRef.current?.(payload);
  }, [session]);

  const beginMove = useCallback(
    (beginArgs: BeginMoveArgs) => {
      setBase(beginArgs.base);
      session.beginMove(beginArgs, { onPreview: handlePreview });
      setMode(session.mode);
      setInteractionId(session.interactionId);
    },
    [handlePreview, session],
  );

  const beginResize = useCallback(
    (beginArgs: BeginResizeArgs) => {
      setBase(beginArgs.base);
      session.beginResize(beginArgs, { onPreview: handlePreview });
      setMode(session.mode);
      setInteractionId(session.interactionId);
    },
    [handlePreview, session],
  );

  const beginRotate = useCallback(
    (beginArgs: BeginRotateArgs) => {
      setBase(beginArgs.base);
      session.beginRotate(beginArgs, { onPreview: handlePreview });
      setMode(session.mode);
      setInteractionId(session.interactionId);
    },
    [handlePreview, session],
  );

  const updatePointer = useCallback(
    (pointer: StagePoint, modifiers?: PointerModifiers) => {
      session.updatePointer(pointer, modifiers);
      setMode(session.mode);
    },
    [session],
  );

  const cancel = useCallback(() => {
    session.cancel();
    setMode("idle");
    setInteractionId(null);
    setPreview(null);
    setBase(null);
  }, [session]);

  const commit = useCallback(() => {
    const result = session.commit("pointerup");
    setMode("idle");
    setInteractionId(null);
    setPreview(null);
    setBase(null);
    if (result) onCommitRef.current?.(result);
    return result;
  }, [session]);

  return {
    mode,
    interactionId,
    preview,
    base,
    beginMove,
    beginResize,
    beginRotate,
    updatePointer,
    cancel,
    commit,
  };
}
