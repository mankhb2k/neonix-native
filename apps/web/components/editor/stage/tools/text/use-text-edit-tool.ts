"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type MutableRefObject } from "react";
import { useEditorActions } from "@/hooks/editor/use-editor-actions";
import {
  useEditorDocument,
  useEditorTextEditSession,
  useEditorTextEditStartPoint,
} from "@/hooks/editor/use-editor-store";
import { createTextEditFramePreview } from "@/lib/editor/stage/text-resize-adapter";
import {
  getV2LayerSelectionBox,
  type StageLayerBounds,
} from "@motionvideo/editor-core/interactions/stage";
import { renderTextCaretAndSelection } from "./text-caret-renderer";
import { useTextEditKeyboard } from "./use-text-edit-keyboard";
import { useTextEditPointer } from "./use-text-edit-pointer";
import type { StageRuntimeSnapshot } from "@/lib/editor/stage/runtime-query";
import type { TextEditSession } from "@motionvideo/editor-core";
import type { RuntimeFrameV3 } from "@motionvideo/motion-runtime";

export type TextEditToolProps = {
  compositionWidth: number;
  compositionHeight: number;
  frameRef: MutableRefObject<RuntimeFrameV3 | null>;
  runtimeSnapshot: StageRuntimeSnapshot;
};

export type TextEditToolController = {
  rootRef: MutableRefObject<HTMLDivElement | null>;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  bounds: StageLayerBounds | null;
  isEditing: boolean;
  refresh: () => void;
  onPointerDown: React.PointerEventHandler<HTMLDivElement>;
  onPointerMove: React.PointerEventHandler<HTMLDivElement>;
  onPointerUp: React.PointerEventHandler<HTMLDivElement>;
  onPointerCancel: () => void;
  onDoubleClick: React.PointerEventHandler<HTMLDivElement>;
  onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
  onInput: React.FormEventHandler<HTMLTextAreaElement>;
  onCompositionStart: () => void;
  onCompositionEnd: React.CompositionEventHandler<HTMLTextAreaElement>;
};

const CARET_BLINK_MS = 530;

export function useTextEditTool({
  compositionWidth,
  compositionHeight,
  frameRef,
  runtimeSnapshot,
}: TextEditToolProps): TextEditToolController {
  const document = useEditorDocument();
  const session = useEditorTextEditSession();
  const startPoint = useEditorTextEditStartPoint();
  const {
    updateTextEditDraft,
    updateTextEditFramePreview,
    commitTextEdit,
    cancelTextEdit,
  } = useEditorActions();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sessionRef = useRef<TextEditSession | null>(session);
  const composingRef = useRef(false);
  const caretVisibleRef = useRef(true);
  const caretBlinkTimerRef = useRef<number | null>(null);
  const drawRef = useRef<() => void>(() => undefined);
  const appliedStartPointRef = useRef<string | null>(null);
  sessionRef.current = session;

  const activeLayer = (() => {
    if (!session) return null;
    const layer = runtimeSnapshot.evaluatedLayersById.get(session.layerId);
    return layer?.type === "text" ? layer : null;
  })();
  const editDraftText = session?.draftText ?? null;

  useEffect(() => {
    if (!session || !activeLayer || editDraftText == null) {
      updateTextEditFramePreview(null);
      return undefined;
    }
    const preview = createTextEditFramePreview({
      document,
      layer: activeLayer,
      draftText: editDraftText,
      beforeText: session.before.text,
    });
    if (!preview) {
      updateTextEditFramePreview(null);
      return undefined;
    }
    let cancelled = false;
    updateTextEditFramePreview(preview.immediate);
    void preview.measured.then((measuredPreview) => {
      if (cancelled) return;
      updateTextEditFramePreview(measuredPreview);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [activeLayer, document, editDraftText, session, updateTextEditFramePreview]);

  const stopCaretBlink = useCallback(() => {
    if (caretBlinkTimerRef.current !== null) window.clearInterval(caretBlinkTimerRef.current);
    caretBlinkTimerRef.current = null;
    caretVisibleRef.current = false;
    if (rootRef.current) rootRef.current.dataset.caretVisible = "false";
  }, []);

  const resetCaretBlink = useCallback(() => {
    if (!sessionRef.current) {
      stopCaretBlink();
      return;
    }
    caretVisibleRef.current = true;
    if (caretBlinkTimerRef.current !== null) window.clearInterval(caretBlinkTimerRef.current);
    drawRef.current();
    caretBlinkTimerRef.current = window.setInterval(() => {
      if (!sessionRef.current) {
        stopCaretBlink();
        return;
      }
      caretVisibleRef.current = !caretVisibleRef.current;
      if (rootRef.current) {
        const blinkCount = Number(rootRef.current.dataset.caretBlink ?? "0") + 1;
        rootRef.current.dataset.caretBlink = String(blinkCount);
      }
      drawRef.current();
    }, CARET_BLINK_MS);
  }, [stopCaretBlink]);

  const pointer = useTextEditPointer({
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
  });

  const keyboard = useTextEditKeyboard({
    sessionRef,
    textareaRef,
    composingRef,
    updateTextEditDraft,
    commitTextEdit,
    cancelTextEdit,
    resetCaretBlink,
  });
  const { applyStartPoint, ...pointerHandlers } = pointer;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;
    const rect = root.getBoundingClientRect();
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * devicePixelRatio));
    canvas.height = Math.max(1, Math.round(rect.height * devicePixelRatio));
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    root.dataset.caretVisible = "false";
    if (!session || !activeLayer) return;
    renderTextCaretAndSelection({
      context,
      root,
      frame: frameRef.current,
      layer: activeLayer,
      session,
      compositionWidth,
      compositionHeight,
      width: rect.width,
      height: rect.height,
      devicePixelRatio,
      caretVisible: caretVisibleRef.current,
    });
  }, [activeLayer, compositionHeight, compositionWidth, frameRef, session]);
  drawRef.current = draw;

  useEffect(() => {
    applyStartPoint();
  }, [applyStartPoint]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const observer = new ResizeObserver(draw);
    observer.observe(root);
    draw();
    return () => observer.disconnect();
  }, [draw]);

  useEffect(() => {
    draw();
    if (!session) {
      stopCaretBlink();
      textareaRef.current?.blur();
      return () => stopCaretBlink();
    }
    resetCaretBlink();
    const textarea = textareaRef.current;
    if (!textarea) return () => stopCaretBlink();
    textarea.value = "";
    textarea.focus({ preventScroll: true });
    return () => stopCaretBlink();
  }, [draw, resetCaretBlink, session, stopCaretBlink]);

  const refresh = useCallback(() => {
    applyStartPoint();
    drawRef.current();
  }, [applyStartPoint]);
  const bounds = activeLayer ? getV2LayerSelectionBox(activeLayer) : null;

  return {
    rootRef,
    canvasRef,
    textareaRef,
    bounds,
    isEditing: Boolean(session && activeLayer && bounds),
    refresh,
    ...pointerHandlers,
    ...keyboard,
  };
}
