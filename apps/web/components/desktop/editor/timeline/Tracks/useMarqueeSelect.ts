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
import type { TimelineAutoScrollController } from "./useTimelineAutoScroll";

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
  /** Stable origin in workspace/content coordinates. */
  originWorkspaceX: number;
  originWorkspaceY: number;
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
  rootRef: RefObject<HTMLDivElement | null>;
  workspaceRef: RefObject<HTMLDivElement | null>;
  autoScroll: TimelineAutoScrollController;
};

/**
 * CapCut-style marquee: drag on empty track runway to multi-select clips.
 */
export function useMarqueeSelect({
  rootRef,
  workspaceRef,
  autoScroll,
}: Args) {
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

  function getTrackBounds(): { maxWorkspaceY: number; maxScrollTop: number } | null {
    const ws = workspaceRef.current;
    const root = rootRef.current;
    if (!ws || !root) return null;

    const lanes = ws.querySelectorAll<HTMLElement>("[data-track-lane='true']");
    if (lanes.length === 0) return null;

    const lastLane = lanes[lanes.length - 1];
    const wsRect = ws.getBoundingClientRect();
    const lastLaneRect = lastLane.getBoundingClientRect();

    const PADDING_BOTTOM = 16;
    const maxWorkspaceY = lastLaneRect.bottom - wsRect.top + PADDING_BOTTOM;

    const rootRect = root.getBoundingClientRect();
    const lastLaneBottomInScrollContent =
      lastLaneRect.bottom - rootRect.top + root.scrollTop;
    const maxScrollTop = Math.max(
      0,
      lastLaneBottomInScrollContent + PADDING_BOTTOM - root.clientHeight,
    );

    return { maxWorkspaceY, maxScrollTop };
  }

  function buildMarquee(
    originWorkspaceX: number,
    originWorkspaceY: number,
    currentClientX: number,
    currentClientY: number,
    maxWorkspaceY?: number,
  ): MarqueeRect | null {
    const current = clientToWorkspace(currentClientX, currentClientY);
    if (!current) return null;
    const targetY =
      maxWorkspaceY != null ? Math.min(current.y, maxWorkspaceY) : current.y;
    const left = Math.min(originWorkspaceX, current.x);
    const top = Math.min(originWorkspaceY, targetY);
    return {
      left,
      top,
      width: Math.abs(originWorkspaceX - current.x),
      height: Math.abs(originWorkspaceY - targetY),
    };
  }

  const clipRectsRef = useRef<{ id: string; left: number; top: number; right: number; bottom: number }[]>([]);
  const pendingPointerRef = useRef<{ x: number; y: number } | null>(null);
  const marqueeRafRef = useRef<number | null>(null);

  function hitTestCached(
    originWorkspaceX: number,
    originWorkspaceY: number,
    currentClientX: number,
    currentClientY: number,
    maxWorkspaceY?: number,
  ): string[] {
    const current = clientToWorkspace(currentClientX, currentClientY);
    if (!current) return [];
    const targetY =
      maxWorkspaceY != null ? Math.min(current.y, maxWorkspaceY) : current.y;
    const left = Math.min(originWorkspaceX, current.x);
    const top = Math.min(originWorkspaceY, targetY);
    const right = Math.max(originWorkspaceX, current.x);
    const bottom = Math.max(originWorkspaceY, targetY);
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
    const workspaceRect = ws.getBoundingClientRect();
    for (const el of ws.querySelectorAll<HTMLElement>("[data-clip-id]")) {
      const id = el.getAttribute("data-clip-id");
      if (!id) continue;
      const r = el.getBoundingClientRect();
      next.push({
        id,
        left: r.left - workspaceRect.left,
        top: r.top - workspaceRect.top,
        right: r.right - workspaceRect.left,
        bottom: r.bottom - workspaceRect.top,
      });
    }
    clipRectsRef.current = next;
  }

  function endSession(reason: PointerSessionEndReason, clientX?: number) {
    const session = sessionRef.current;
    sessionRef.current = null;
    pendingPointerRef.current = null;
    autoScroll.stop("marquee");
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

    const origin = clientToWorkspace(event.clientX, event.clientY);
    if (!origin) return;

    event.preventDefault();
    sessionRef.current = {
      pointerId: event.pointerId,
      originClientX: event.clientX,
      originClientY: event.clientY,
      originWorkspaceX: origin.x,
      originWorkspaceY: origin.y,
      started: false,
      selectionBefore: [
        ...selectedClipIdsFrom(useEditorStore.getState().selection),
      ],
    };
  }

  const buildMarqueeRef = useRef(buildMarquee);
  const cacheClipRectsRef = useRef(cacheClipRects);
  const hitTestCachedRef = useRef(hitTestCached);
  const getTrackBoundsRef = useRef(getTrackBounds);
  const endSessionRef = useRef(endSession);
  buildMarqueeRef.current = buildMarquee;
  cacheClipRectsRef.current = cacheClipRects;
  hitTestCachedRef.current = hitTestCached;
  getTrackBoundsRef.current = getTrackBounds;
  endSessionRef.current = endSession;

  useEffect(() => {
    function flushMarqueeMove() {
      marqueeRafRef.current = null;
      const session = sessionRef.current;
      const pending = pendingPointerRef.current;
      if (!session || !pending) return;

      const bounds = getTrackBoundsRef.current();

      setMarqueeRect(
        buildMarqueeRef.current(
          session.originWorkspaceX,
          session.originWorkspaceY,
          pending.x,
          pending.y,
          bounds?.maxWorkspaceY,
        ),
      );

      const liveIds = hitTestCachedRef.current(
        session.originWorkspaceX,
        session.originWorkspaceY,
        pending.x,
        pending.y,
        bounds?.maxWorkspaceY,
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
        cacheClipRectsRef.current();
        lastLiveIdsRef.current = [];
      }

      pendingPointerRef.current = { x: event.clientX, y: event.clientY };
      const bounds = getTrackBoundsRef.current();
      autoScroll.updatePointer(
        "marquee",
        event.clientX,
        event.clientY,
        () => {
          if (marqueeRafRef.current != null) return;
          marqueeRafRef.current = requestAnimationFrame(flushMarqueeMove);
        },
        { maxScrollTop: bounds?.maxScrollTop },
      );
      if (marqueeRafRef.current == null) {
        marqueeRafRef.current = requestAnimationFrame(flushMarqueeMove);
      }
    }

    function onPointerUp(event: PointerEvent) {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      if (marqueeRafRef.current != null) {
        cancelAnimationFrame(marqueeRafRef.current);
        marqueeRafRef.current = null;
        flushMarqueeMove();
      }
      endSessionRef.current("pointerup", event.clientX);
    }

    function onPointerCancel(event: PointerEvent) {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      if (marqueeRafRef.current != null) {
        cancelAnimationFrame(marqueeRafRef.current);
        marqueeRafRef.current = null;
      }
      pendingPointerRef.current = null;
      endSessionRef.current("pointercancel");
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
      endSessionRef.current("escape");
    }

    function onTimelineScroll() {
      const session = sessionRef.current;
      if (!session?.started || !pendingPointerRef.current) return;
      if (marqueeRafRef.current != null) return;
      marqueeRafRef.current = requestAnimationFrame(flushMarqueeMove);
    }

    const root = rootRef.current;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onKeyDown);
    root?.addEventListener("scroll", onTimelineScroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown);
      root?.removeEventListener("scroll", onTimelineScroll);
      autoScroll.stop("marquee");
      if (marqueeRafRef.current != null) cancelAnimationFrame(marqueeRafRef.current);
    };
  }, [autoScroll, rootRef]);

  return {
    marqueeRect,
    isMarqueeing,
    onWorkspacePointerDown,
  };
}
