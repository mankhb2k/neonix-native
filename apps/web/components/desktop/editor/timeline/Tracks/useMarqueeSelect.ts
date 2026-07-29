"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { useEditorStore } from "@/lib/editor/editor-store";
import { selectedClipIdsFrom } from "@/lib/editor/model/editor-selection";
import {
  selectionIdsEqual,
  shouldCommitPointerSession,
  type PointerSessionEndReason,
} from "@/lib/editor/pointer-session";

const MARQUEE_THRESHOLD_PX = 4;

export type MarqueeRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type Session = {
  pointerId: number;
  originClientX: number;
  originClientY: number;
  started: boolean;
  /** Snapshot selection lúc bắt đầu — dùng để rollback khi cancel. */
  selectionBefore: string[];
};

function rectsIntersect(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
): boolean {
  return (
    a.left < b.right &&
    a.right > b.left &&
    a.top < b.bottom &&
    a.bottom > b.top
  );
}

function shouldIgnoreTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  if (target.closest("[data-clip-id]")) return true;
  if (target.closest("button")) return true;
  if (target.closest("[data-marquee-ignore]")) return true;
  return false;
}

type Args = {
  workspaceRef: RefObject<HTMLDivElement | null>;
};

/**
 * CapCut-style marquee: drag on empty track runway to multi-select clips.
 */
export function useMarqueeSelect({ workspaceRef }: Args) {
  const sessionRef = useRef<Session | null>(null);
  const lastLiveIdsRef = useRef<string[]>([]);
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);
  const [isMarqueeing, setIsMarqueeing] = useState(false);

  function clientToWorkspace(
    clientX: number,
    clientY: number,
  ): { x: number; y: number } | null {
    const ws = workspaceRef.current;
    if (!ws) return null;
    const r = ws.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  function buildMarquee(
    ox: number,
    oy: number,
    cx: number,
    cy: number,
  ): MarqueeRect | null {
    const a = clientToWorkspace(ox, oy);
    const b = clientToWorkspace(cx, cy);
    if (!a || !b) return null;
    const left = Math.min(a.x, b.x);
    const top = Math.min(a.y, b.y);
    return {
      left,
      top,
      width: Math.abs(a.x - b.x),
      height: Math.abs(a.y - b.y),
    };
  }

  const clipRectsRef = useRef<{ id: string; left: number; top: number; right: number; bottom: number }[]>([]);
  const pendingPointerRef = useRef<{ x: number; y: number } | null>(null);
  const marqueeRafRef = useRef<number | null>(null);

  function hitTestCached(
    originX: number,
    originY: number,
    clientX: number,
    clientY: number,
  ): string[] {
    const left = Math.min(originX, clientX);
    const top = Math.min(originY, clientY);
    const right = Math.max(originX, clientX);
    const bottom = Math.max(originY, clientY);
    const box = { left, top, right, bottom };
    const ids: string[] = [];
    for (const r of clipRectsRef.current) {
      if (
        rectsIntersect(box, {
          left: r.left,
          top: r.top,
          right: r.right,
          bottom: r.bottom,
        })
      ) {
        ids.push(r.id);
      }
    }
    return ids;
  }

  function cacheClipRects() {
    const ws = workspaceRef.current;
    if (!ws) {
      clipRectsRef.current = [];
      return;
    }
    const next: typeof clipRectsRef.current = [];
    for (const el of ws.querySelectorAll<HTMLElement>("[data-clip-id]")) {
      const id = el.getAttribute("data-clip-id");
      if (!id) continue;
      const r = el.getBoundingClientRect();
      next.push({ id, left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    }
    clipRectsRef.current = next;
  }

  function endSession(
    reason: PointerSessionEndReason,
    clientX?: number,
    clientY?: number,
  ) {
    const session = sessionRef.current;
    sessionRef.current = null;
    setMarqueeRect(null);
    setIsMarqueeing(false);

    if (!session) return;

    if (!session.started) {
      if (shouldCommitPointerSession(reason)) {
        useEditorStore.getState().clearTimelineSelection();
      }
      return;
    }

    // Cancel/Escape: khôi phục selection trước khi kéo marquee.
    if (!shouldCommitPointerSession(reason)) {
      useEditorStore.getState().setSelectedClipIds(session.selectionBefore);
      return;
    }

    // Dùng kết quả RAF cuối — không đo lại DOM ở pointerup (PERF-03).
    if (lastLiveIdsRef.current.length > 0 || clientX != null) {
      useEditorStore.getState().setSelectedClipIds(lastLiveIdsRef.current);
    }
  }

  function onWorkspacePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if (useEditorStore.getState().activeDragItem) return;
    if (shouldIgnoreTarget(event.target)) return;

    event.preventDefault();
    sessionRef.current = {
      pointerId: event.pointerId,
      originClientX: event.clientX,
      originClientY: event.clientY,
      started: false,
      selectionBefore: [
        ...selectedClipIdsFrom(useEditorStore.getState().selection),
      ],
    };
  }

  useEffect(() => {
    function flushMarqueeMove() {
      marqueeRafRef.current = null;
      const session = sessionRef.current;
      const pending = pendingPointerRef.current;
      if (!session || !pending) return;

      setMarqueeRect(
        buildMarquee(
          session.originClientX,
          session.originClientY,
          pending.x,
          pending.y,
        ),
      );

      const liveIds = hitTestCached(
        session.originClientX,
        session.originClientY,
        pending.x,
        pending.y,
      );
      if (!selectionIdsEqual(liveIds, lastLiveIdsRef.current)) {
        lastLiveIdsRef.current = liveIds;
        useEditorStore.getState().setSelectedClipIds(liveIds);
      }
    }

    function onPointerMove(event: PointerEvent) {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;

      const dx = event.clientX - session.originClientX;
      const dy = event.clientY - session.originClientY;
      if (!session.started) {
        if (dx * dx + dy * dy < MARQUEE_THRESHOLD_PX * MARQUEE_THRESHOLD_PX) {
          return;
        }
        session.started = true;
        setIsMarqueeing(true);
        // PERF-03: đo clip rect một lần khi bắt đầu marquee.
        cacheClipRects();
        lastLiveIdsRef.current = [];
      }

      pendingPointerRef.current = { x: event.clientX, y: event.clientY };
      if (marqueeRafRef.current != null) return;
      marqueeRafRef.current = requestAnimationFrame(flushMarqueeMove);
    }

    function onPointerUp(event: PointerEvent) {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      if (marqueeRafRef.current != null) {
        cancelAnimationFrame(marqueeRafRef.current);
        marqueeRafRef.current = null;
        flushMarqueeMove();
      }
      endSession("pointerup", event.clientX, event.clientY);
    }

    function onPointerCancel(event: PointerEvent) {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      if (marqueeRafRef.current != null) {
        cancelAnimationFrame(marqueeRafRef.current);
        marqueeRafRef.current = null;
      }
      pendingPointerRef.current = null;
      endSession("pointercancel");
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (!sessionRef.current) return;
      event.preventDefault();
      if (marqueeRafRef.current != null) {
        cancelAnimationFrame(marqueeRafRef.current);
        marqueeRafRef.current = null;
      }
      pendingPointerRef.current = null;
      endSession("escape");
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown);
      if (marqueeRafRef.current != null) cancelAnimationFrame(marqueeRafRef.current);
    };
  }, []);

  return {
    marqueeRect,
    isMarqueeing,
    onWorkspacePointerDown,
  };
}
