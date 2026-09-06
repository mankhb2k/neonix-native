"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useEditorActions } from "@/hooks/editor/use-editor-actions";
import {
  useEditorDocument,
  useEditorTextEditStartPoint,
  useEditorTextEditSession,
} from "@/hooks/editor/use-editor-store";
import { useTransportStore } from "@/hooks/editor/use-transport-store";
import { evaluateLayerAtPlayhead } from "@/lib/editor/animation/keyframes";
import {
  getV2LayerSelectionBox,
  type StageLayerBounds,
} from "@/lib/editor/stage/transform";
import {
  moveTextCaret,
  replaceTextAtSelection,
  type TextEditSession,
} from "@motionvideo/editor-core";
import type { V2TextLayer } from "@motionvideo/motion-protocol/v2";
import type { PaintTextGlyph, RuntimeFrameV3 } from "@motionvideo/motion-runtime";

type Props = {
  compositionWidth: number;
  compositionHeight: number;
  frameRef: MutableRefObject<RuntimeFrameV3 | null>;
};

export type StageTextEditOverlayHandle = {
  refresh: () => void;
};

type Point = { x: number; y: number };

const CARET_BLINK_MS = 530;

function percent(value: number, total: number): string {
  return `${(value / Math.max(1, total)) * 100}%`;
}

function boundsStyle(
  bounds: StageLayerBounds,
  compositionWidth: number,
  compositionHeight: number,
): React.CSSProperties {
  return {
    position: "absolute",
    left: percent(bounds.x, compositionWidth),
    top: percent(bounds.y, compositionHeight),
    width: percent(Math.max(1, bounds.width), compositionWidth),
    height: percent(Math.max(1, bounds.height), compositionHeight),
    boxSizing: "border-box",
  };
}

function transformPoint(layer: V2TextLayer, point: Point): Point {
  const { transform } = layer;
  const radians = (transform.rotate.z * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const skewX = Math.tan((transform.skew.x * Math.PI) / 180);
  const skewY = Math.tan((transform.skew.y * Math.PI) / 180);
  const localX = point.x - transform.anchor.x;
  const localY = point.y - transform.anchor.y;
  const skewedX = localX + skewX * localY;
  const skewedY = skewY * localX + localY;
  const scaledX = skewedX * transform.scale.x;
  const scaledY = skewedY * transform.scale.y;
  return {
    x: transform.translate.x + transform.anchor.x + scaledX * cos - scaledY * sin,
    y: transform.translate.y + transform.anchor.y + scaledX * sin + scaledY * cos,
  };
}

function inverseTransformPoint(layer: V2TextLayer, point: Point): Point {
  const { transform } = layer;
  const radians = (transform.rotate.z * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const skewX = Math.tan((transform.skew.x * Math.PI) / 180);
  const skewY = Math.tan((transform.skew.y * Math.PI) / 180);
  const translatedX = point.x - transform.translate.x - transform.anchor.x;
  const translatedY = point.y - transform.translate.y - transform.anchor.y;
  const rotatedX = translatedX * cos + translatedY * sin;
  const rotatedY = -translatedX * sin + translatedY * cos;
  const scaleX = Math.abs(transform.scale.x) < 0.0001 ? 0.0001 : transform.scale.x;
  const scaleY = Math.abs(transform.scale.y) < 0.0001 ? 0.0001 : transform.scale.y;
  const skewedX = rotatedX / scaleX;
  const skewedY = rotatedY / scaleY;
  const determinant = 1 - skewX * skewY;
  const localX = (skewedX - skewX * skewedY) / (Math.abs(determinant) < 0.0001 ? 0.0001 : determinant);
  const localY = (skewedY - skewY * skewedX) / (Math.abs(determinant) < 0.0001 ? 0.0001 : determinant);
  return {
    x: localX + transform.anchor.x,
    y: localY + transform.anchor.y,
  };
}

function drawPolygon(
  context: CanvasRenderingContext2D,
  points: readonly Point[],
  compositionWidth: number,
  compositionHeight: number,
  cssWidth: number,
  cssHeight: number,
): void {
  if (points.length === 0) return;
  const scaleX = cssWidth / Math.max(1, compositionWidth);
  const scaleY = cssHeight / Math.max(1, compositionHeight);
  context.beginPath();
  points.forEach((point, index) => {
    const x = point.x * scaleX;
    const y = point.y * scaleY;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
}

function nearestCaretIndex(
  glyphs: readonly PaintTextGlyph[],
  point: Point,
  textLength: number,
  fallbackWidth = 1,
): number {
  if (glyphs.length === 0) {
    return Math.max(0, Math.min(
      textLength,
      Math.round((point.x / Math.max(1, fallbackWidth)) * textLength),
    ));
  }

  // Match OpenPencil's paragraph hit-test: choose the closest visual line,
  // then compare against glyph midpoints on that line. Euclidean nearest-glyph
  // matching jumps to another line when the click is near a line boundary.
  const line = [...glyphs].sort((left, right) =>
    Math.abs(point.y - (left.y + left.height / 2)) -
    Math.abs(point.y - (right.y + right.height / 2)),
  )[0]!;
  const lineGlyphs = glyphs
    .filter((glyph) => Math.abs(glyph.y - line.y) <= Math.max(2, line.height * 0.35))
    .sort((left, right) => left.x - right.x);
  for (const glyph of lineGlyphs) {
    if (point.x < glyph.x + glyph.width / 2) return glyph.cluster;
  }
  return lineGlyphs.at(-1)?.clusterEnd ?? 0;
}

function wordSelection(text: string, index: number): { start: number; end: number } {
  const safeIndex = Math.max(0, Math.min(text.length, index));
  let start = safeIndex;
  let end = safeIndex;
  while (start > 0 && !/\s/u.test(text[start - 1] ?? "")) start -= 1;
  while (end < text.length && !/\s/u.test(text[end] ?? "")) end += 1;
  return { start, end };
}

function textCommandFor(
  frame: RuntimeFrameV3 | null,
  layerId: string,
): Extract<RuntimeFrameV3["commands"][number], { op: "drawText" }> | null {
  const command = frame?.commands.find(
    (candidate) => candidate.op === "drawText" && candidate.layerId === layerId,
  );
  return command?.op === "drawText" ? command : null;
}

export const StageTextEditOverlay = forwardRef<StageTextEditOverlayHandle, Props>(
  function StageTextEditOverlay({ compositionWidth, compositionHeight, frameRef }, ref) {
    const document = useEditorDocument();
    const session = useEditorTextEditSession();
    const startPoint = useEditorTextEditStartPoint();
    const currentTime = useTransportStore((state) => state.currentTime);
    const { updateTextEditDraft, commitTextEdit, cancelTextEdit } = useEditorActions();
    const rootRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const sessionRef = useRef<TextEditSession | null>(session);
    const dragRef = useRef<{ pointerId: number; anchor: number } | null>(null);
    const composingRef = useRef(false);
    const caretVisibleRef = useRef(true);
    const caretBlinkTimerRef = useRef<number | null>(null);
    const drawRef = useRef<() => void>(() => undefined);
    const appliedStartPointRef = useRef<string | null>(null);
    sessionRef.current = session;

    const activeLayer = (() => {
      if (!session) return null;
      const layer = document.layers.find((candidate) => candidate.id === session.layerId);
      if (!layer || layer.type !== "text") return null;
      return evaluateLayerAtPlayhead(layer, currentTime) as V2TextLayer;
    })();

    useEffect(() => {
      if (!session || !activeLayer || !startPoint) {
        appliedStartPointRef.current = null;
        return;
      }
      const pointKey = `${session.layerId}:${startPoint.x}:${startPoint.y}:${startPoint.mode}`;
      if (appliedStartPointRef.current === pointKey) return;
      const local = inverseTransformPoint(activeLayer, startPoint);
      const command = textCommandFor(frameRef.current, activeLayer.id);
      const index = nearestCaretIndex(
        command?.glyphs ?? [],
        local,
        session.draftText.length,
        activeLayer.frame.width,
      );
      const selection = startPoint.mode === "word"
        ? wordSelection(session.draftText, index)
        : { start: index, end: index };
      appliedStartPointRef.current = pointKey;
      updateTextEditDraft(session.draftText, selection);
    }, [activeLayer, frameRef, session, startPoint, updateTextEditDraft]);

    const draw = useCallback(() => {
      const canvas = canvasRef.current;
      const root = rootRef.current;
      if (!canvas || !root) return;
      const rect = root.getBoundingClientRect();
      const devicePixelRatio = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(rect.width * devicePixelRatio));
      const height = Math.max(1, Math.round(rect.height * devicePixelRatio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);
      root.dataset.caretVisible = "false";
      if (!session || !activeLayer) return;
      const command = textCommandFor(frameRef.current, activeLayer.id);
      const glyphs = command?.glyphs ?? [];
      const selection = session.selection;
      if (selection.start !== selection.end) {
        context.fillStyle = "rgba(41, 171, 226, 0.32)";
        const selectedGlyphs = glyphs.filter(
          (glyph) => glyph.clusterEnd > selection.start && glyph.cluster < selection.end,
        );
        const bands: Array<{ left: number; top: number; right: number; bottom: number }> = [];
        for (const glyph of selectedGlyphs) {
          const band = bands.find(
            (candidate) => Math.abs(candidate.top - glyph.y) <= Math.max(2, glyph.height * 0.35),
          );
          if (band) {
            band.left = Math.min(band.left, glyph.x);
            band.top = Math.min(band.top, glyph.y);
            band.right = Math.max(band.right, glyph.x + glyph.width);
            band.bottom = Math.max(band.bottom, glyph.y + glyph.height);
            continue;
          }
          bands.push({
            left: glyph.x,
            top: glyph.y,
            right: glyph.x + glyph.width,
            bottom: glyph.y + glyph.height,
          });
        }
        if (bands.length === 0 && selection.start === 0 && selection.end === session.draftText.length) {
          bands.push({ left: 0, top: 0, right: activeLayer.frame.width, bottom: activeLayer.frame.height });
        }
        for (const band of bands) {
          drawPolygon(
            context,
            [
              transformPoint(activeLayer, { x: band.left - 1, y: band.top }),
              transformPoint(activeLayer, { x: band.right + 1, y: band.top }),
              transformPoint(activeLayer, { x: band.right + 1, y: band.bottom }),
              transformPoint(activeLayer, { x: band.left - 1, y: band.bottom }),
            ],
            compositionWidth,
            compositionHeight,
            rect.width,
            rect.height,
          );
          context.fill();
        }
      } else {
        root.dataset.caretVisible = String(caretVisibleRef.current);
        if (!caretVisibleRef.current) return;
        const caretIndex = selection.end;
        const nextGlyph = glyphs.find((glyph) => glyph.cluster >= caretIndex);
        const previousGlyph = [...glyphs].reverse().find((glyph) => glyph.clusterEnd <= caretIndex);
        const glyph = nextGlyph ?? previousGlyph;
        if (!glyph) {
          // OpenPencil waits for the shaped paragraph before drawing its
          // caret. A frame-ratio fallback is wrong for centered/wrapped text
          // because the frame is not the text advance width.
          if (session.draftText.length > 0) {
            root.dataset.caretVisible = "false";
            return;
          }
        }
        const caretX = glyph
          ? nextGlyph
            ? glyph.advanceStart ?? glyph.x
            : glyph.advanceStart !== undefined && glyph.advanceX !== undefined
              ? glyph.advanceStart + glyph.advanceX
              : glyph.x + glyph.width
          : 0;
        const fixedCaretHeight = Math.max(
          1,
          command?.lineHeight ?? command?.fontSize ?? glyph?.height ?? activeLayer.frame.height,
        );
        const caretCenterY = glyph
          ? glyph.y + glyph.height / 2
          : activeLayer.frame.height / 2;
        const caretTopY = caretCenterY - fixedCaretHeight / 2;
        const top = transformPoint(activeLayer, {
          x: caretX,
          y: caretTopY,
        });
        const bottom = transformPoint(activeLayer, {
          x: caretX,
          y: caretTopY + fixedCaretHeight,
        });
        const scaleX = rect.width / Math.max(1, compositionWidth);
        const scaleY = rect.height / Math.max(1, compositionHeight);
        context.strokeStyle = "#4b5563";
        context.lineWidth = Math.max(2, 2 * devicePixelRatio);
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(top.x * scaleX, top.y * scaleY);
        context.lineTo(bottom.x * scaleX, bottom.y * scaleY);
        context.stroke();
      }
    }, [activeLayer, compositionHeight, compositionWidth, frameRef, session]);

    drawRef.current = draw;

    const stopCaretBlink = useCallback(() => {
      if (caretBlinkTimerRef.current !== null) {
        window.clearInterval(caretBlinkTimerRef.current);
        caretBlinkTimerRef.current = null;
      }
      caretVisibleRef.current = false;
      if (rootRef.current) rootRef.current.dataset.caretVisible = "false";
    }, []);

    const resetCaretBlink = useCallback(() => {
      if (!sessionRef.current) {
        stopCaretBlink();
        return;
      }

      caretVisibleRef.current = true;
      if (caretBlinkTimerRef.current !== null) {
        window.clearInterval(caretBlinkTimerRef.current);
      }
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

    useImperativeHandle(ref, () => ({ refresh: draw }), [draw]);

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

    const getCaretIndexAt = useCallback((event: Pick<ReactPointerEvent<HTMLDivElement>, "clientX" | "clientY">): number | null => {
      const currentSession = sessionRef.current;
      const layer = activeLayer;
      const root = rootRef.current;
      const frame = frameRef.current;
      if (!currentSession || !layer || !root) return null;
      const rect = root.getBoundingClientRect();
      const point = {
        x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * compositionWidth,
        y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * compositionHeight,
      };
      const local = inverseTransformPoint(layer, point);
      const command = textCommandFor(frame, layer.id);
      return nearestCaretIndex(
        command?.glyphs ?? [],
        local,
        currentSession.draftText.length,
        layer.frame.width,
      );
    }, [activeLayer, compositionHeight, compositionWidth, frameRef]);

    const updateSelectionAt = useCallback((event: ReactPointerEvent<HTMLDivElement>, anchor?: number) => {
      const currentSession = sessionRef.current;
      const index = getCaretIndexAt(event);
      if (!currentSession || index === null) return;
      const selectionAnchor = anchor ?? index;
      updateTextEditDraft(currentSession.draftText, { start: selectionAnchor, end: index });
      resetCaretBlink();
      textareaRef.current?.focus({ preventScroll: true });
    }, [getCaretIndexAt, resetCaretBlink, updateTextEditDraft]);

    const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const currentSession = sessionRef.current;
      if (!currentSession) return;
      const anchor = currentSession.selection.end;
      dragRef.current = { pointerId: event.pointerId, anchor };
      event.currentTarget.setPointerCapture(event.pointerId);
      updateSelectionAt(event);
      dragRef.current.anchor = sessionRef.current?.selection.start ?? anchor;
    }, [updateSelectionAt]);

    const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      updateSelectionAt(event, drag.anchor);
    }, [updateSelectionAt]);

    const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
      if (dragRef.current?.pointerId !== event.pointerId) return;
      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }, []);

    const consumeInput = useCallback((value: string) => {
      const currentSession = sessionRef.current;
      if (!currentSession || value.length === 0) return;
      const next = replaceTextAtSelection(currentSession, value);
      updateTextEditDraft(next.draftText, next.selection);
      resetCaretBlink();
      if (textareaRef.current) textareaRef.current.value = "";
    }, [resetCaretBlink, updateTextEditDraft]);

    const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const currentSession = sessionRef.current;
      if (!currentSession) return;
      const modifier = event.metaKey || event.ctrlKey;
      if (event.key === "Escape") {
        event.preventDefault();
        cancelTextEdit();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        commitTextEdit();
        return;
      }
      if (modifier && event.key.toLowerCase() === "a") {
        event.preventDefault();
        updateTextEditDraft(currentSession.draftText, { start: 0, end: currentSession.draftText.length });
        resetCaretBlink();
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        const selection = currentSession.selection;
        if (selection.start !== selection.end) {
          const next = replaceTextAtSelection(currentSession, "");
          updateTextEditDraft(next.draftText, next.selection);
          resetCaretBlink();
          return;
        }
        const offset = event.key === "Backspace" ? -1 : 1;
        const start = Math.max(0, Math.min(currentSession.draftText.length, selection.start + Math.min(0, offset)));
        const end = Math.max(0, Math.min(currentSession.draftText.length, selection.end + Math.max(0, offset)));
        updateTextEditDraft(currentSession.draftText.slice(0, start) + currentSession.draftText.slice(end), { start, end: start });
        resetCaretBlink();
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home" || event.key === "End") {
        event.preventDefault();
        const direction = event.key === "ArrowLeft" ? "left" : event.key === "ArrowRight" ? "right" : event.key.toLowerCase() as "home" | "end";
        const next = moveTextCaret(currentSession, direction, event.shiftKey);
        updateTextEditDraft(next.draftText, next.selection);
        resetCaretBlink();
      }
    }, [cancelTextEdit, commitTextEdit, resetCaretBlink, updateTextEditDraft]);

    const onCompositionEnd = useCallback((event: React.CompositionEvent<HTMLTextAreaElement>) => {
      composingRef.current = false;
      consumeInput(event.currentTarget.value);
    }, [consumeInput]);

    useEffect(() => {
      const onPointerDownOutside = (event: PointerEvent) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest("[data-text-edit-hitbox], [data-testid='stage-text-edit-input']")) return;
        if (sessionRef.current) commitTextEdit();
      };
      globalThis.document.addEventListener("pointerdown", onPointerDownOutside, true);
      return () => globalThis.document.removeEventListener("pointerdown", onPointerDownOutside, true);
    }, [commitTextEdit]);

    const bounds = activeLayer ? getV2LayerSelectionBox(activeLayer) : null;
    if (!session || !activeLayer || !bounds) {
      return <div ref={rootRef} className="pointer-events-none absolute inset-0 z-[5]" aria-hidden="true" />;
    }

    return (
      <div
        ref={rootRef}
        className="pointer-events-none absolute inset-0 z-[5]"
        data-testid="stage-text-edit-overlay"
      >
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        />
        <div
          data-text-edit-hitbox="true"
          data-testid="stage-text-edit-hitbox"
          className="pointer-events-auto absolute cursor-text"
          style={{
            ...boundsStyle(bounds, compositionWidth, compositionHeight),
            transform: bounds.rotation ? `rotate(${bounds.rotation}deg)` : undefined,
            transformOrigin: `${percent(bounds.transformOriginX ?? bounds.width / 2, bounds.width)} ${percent(bounds.transformOriginY ?? bounds.height / 2, bounds.height)}`,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { dragRef.current = null; }}
          onDoubleClick={(event) => {
            event.preventDefault();
            const currentSession = sessionRef.current;
            if (!currentSession) return;
            const index = getCaretIndexAt(event);
            if (index === null) return;
            const selected = wordSelection(currentSession.draftText, index);
            updateTextEditDraft(currentSession.draftText, selected);
            resetCaretBlink();
          }}
        />
        <textarea
          ref={textareaRef}
          data-testid="stage-text-edit-input"
          aria-label="Text editor input"
          className="fixed left-[-10000px] top-[-10000px] h-px w-px opacity-0"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          onKeyDown={onKeyDown}
          onInput={(event) => {
            if (composingRef.current) return;
            consumeInput(event.currentTarget.value);
          }}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={onCompositionEnd}
        />
      </div>
    );
  },
);
