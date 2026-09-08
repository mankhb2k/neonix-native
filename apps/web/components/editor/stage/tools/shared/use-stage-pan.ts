"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useStageToolContext } from "./StageToolContext";

type PanOffset = { x: number; y: number };

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  return Boolean(element?.closest("input, textarea, select, [contenteditable='true']"));
}

export function useStagePan() {
  const { activeTool, setActiveTool } = useStageToolContext();
  const isPanMode = activeTool === "pan";
  const [panOffset, setPanOffset] = useState<PanOffset>({ x: 0, y: 0 });
  const panGestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || event.repeat) return;
      const key = event.key.toLowerCase();
      if (key === "v") {
        event.preventDefault();
        setActiveTool("select");
      } else if (key === "h") {
        event.preventDefault();
        setActiveTool(activeTool === "pan" ? "select" : "pan");
      }
    };
    const onBlur = () => setActiveTool("select");
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
    };
  }, [activeTool, setActiveTool]);

  const onPanPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isPanMode || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('[data-testid="stage-zoom-controls"]') || target.closest('[data-testid="stage-tool-rail"]')) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    panGestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: panOffset.x,
      originY: panOffset.y,
    };
  }, [isPanMode, panOffset.x, panOffset.y]);

  const onPanPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = panGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    setPanOffset({ x: gesture.originX + event.clientX - gesture.startX, y: gesture.originY + event.clientY - gesture.startY });
  }, []);

  const onPanPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panGestureRef.current || panGestureRef.current.pointerId !== event.pointerId) return;
    panGestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const selectTool = useCallback(() => setActiveTool("select"), [setActiveTool]);
  const panTool = useCallback(() => setActiveTool("pan"), [setActiveTool]);
  const resetPan = useCallback(() => setPanOffset({ x: 0, y: 0 }), []);

  return { isPanMode, panOffset, onPanPointerDown, onPanPointerMove, onPanPointerUp, selectTool, panTool, resetPan };
}
