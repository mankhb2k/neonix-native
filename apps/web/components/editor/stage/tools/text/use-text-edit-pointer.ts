"use client";

import { useCallback, useEffect, useRef, type MutableRefObject, type PointerEvent as ReactPointerEvent } from "react";
import {
  type TextEditSession,
  type TextSelection,
} from "@motionvideo/editor-core";
import {
  inverseTransformTextPoint,
  nearestCaretIndex,
  textCommandFor,
  wordSelection,
} from "./text-glyph-hit-test";
import type { TextEditStartPoint } from "@/lib/editor/state/editor-store";
import type { V2TextLayer } from "@motionvideo/motion-protocol/v2";

type Props = {
  compositionWidth: number;
  compositionHeight: number;
  frameRef: MutableRefObject<import("@motionvideo/motion-runtime").RuntimeFrameV3 | null>;
  rootRef: MutableRefObject<HTMLDivElement | null>;
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  sessionRef: MutableRefObject<TextEditSession | null>;
  activeLayer: V2TextLayer | null;
  session: TextEditSession | null;
  startPoint: TextEditStartPoint | null;
  appliedStartPointRef: MutableRefObject<string | null>;
  updateTextEditDraft: (draftText: string, selection?: TextSelection) => void;
  commitTextEdit: () => void;
  resetCaretBlink: () => void;
};

export function useTextEditPointer({
  compositionWidth,
  compositionHeight,
  frameRef,
  rootRef,
  textareaRef,
  sessionRef,
  activeLayer,
  session,
  startPoint,
  appliedStartPointRef,
  updateTextEditDraft,
  commitTextEdit,
  resetCaretBlink,
}: Props) {
  const startPointStateRef = appliedStartPointRef;
  const dragRef = useRef<{ pointerId: number; anchor: number } | null>(null);

  const applyStartPoint = useCallback(() => {
    if (!session || !activeLayer || !startPoint) {
      startPointStateRef.current = null;
      return;
    }
    const pointKey = `${session.layerId}:${startPoint.x}:${startPoint.y}:${startPoint.mode}`;
    if (startPointStateRef.current === pointKey) return;
    const local = inverseTransformTextPoint(activeLayer, startPoint);
    const command = textCommandFor(frameRef.current, activeLayer.id);
    if (session.draftText.length > 0 && !command?.glyphs?.length) return;
    const index = nearestCaretIndex(command?.glyphs ?? [], local, session.draftText.length, activeLayer.frame.width);
    const selection = startPoint.mode === "word"
      ? wordSelection(session.draftText, index)
      : { start: index, end: index };
    startPointStateRef.current = pointKey;
    updateTextEditDraft(session.draftText, selection);
  }, [activeLayer, frameRef, session, startPoint, startPointStateRef, updateTextEditDraft]);

  const getCaretIndexAt = useCallback((event: Pick<ReactPointerEvent<HTMLDivElement>, "clientX" | "clientY">) => {
    const currentSession = sessionRef.current;
    if (!currentSession || !activeLayer || !rootRef.current) return null;
    const rect = rootRef.current.getBoundingClientRect();
    const point = {
      x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * compositionWidth,
      y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * compositionHeight,
    };
    const command = textCommandFor(frameRef.current, activeLayer.id);
    return nearestCaretIndex(
      command?.glyphs ?? [],
      inverseTransformTextPoint(activeLayer, point),
      currentSession.draftText.length,
      activeLayer.frame.width,
    );
  }, [activeLayer, compositionHeight, compositionWidth, frameRef, rootRef, sessionRef]);

  const updateSelectionAt = useCallback((event: ReactPointerEvent<HTMLDivElement>, anchor?: number) => {
    const currentSession = sessionRef.current;
    const index = getCaretIndexAt(event);
    if (!currentSession || index === null) return;
    const selectionAnchor = anchor ?? index;
    updateTextEditDraft(currentSession.draftText, { start: selectionAnchor, end: index });
    resetCaretBlink();
    textareaRef.current?.focus({ preventScroll: true });
  }, [getCaretIndexAt, resetCaretBlink, sessionRef, textareaRef, updateTextEditDraft]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const currentSession = sessionRef.current;
    if (!currentSession) return;
    dragRef.current = { pointerId: event.pointerId, anchor: currentSession.selection.end };
    event.currentTarget.setPointerCapture(event.pointerId);
    updateSelectionAt(event);
    dragRef.current.anchor = sessionRef.current?.selection.start ?? currentSession.selection.end;
  }, [sessionRef, updateSelectionAt]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    updateSelectionAt(event, drag.anchor);
  }, [updateSelectionAt]);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const onDoubleClick = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const currentSession = sessionRef.current;
    const index = currentSession ? getCaretIndexAt(event) : null;
    if (!currentSession || index === null) return;
    updateTextEditDraft(currentSession.draftText, wordSelection(currentSession.draftText, index));
    resetCaretBlink();
  }, [getCaretIndexAt, resetCaretBlink, sessionRef, updateTextEditDraft]);

  const onPointerCancel = useCallback(() => {
    dragRef.current = null;
  }, []);

  useEffect(() => {
    const onPointerDownOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-text-edit-hitbox], [data-testid='stage-text-edit-input']")) return;
      if (sessionRef.current) commitTextEdit();
    };
    globalThis.document.addEventListener("pointerdown", onPointerDownOutside, true);
    return () => globalThis.document.removeEventListener("pointerdown", onPointerDownOutside, true);
  }, [commitTextEdit, sessionRef]);

  return {
    applyStartPoint,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onDoubleClick,
  };
}
