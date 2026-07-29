"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { useEditorStore } from "@/lib/editor/editor-store";
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

  function hitTestClientRect(
    originX: number,
    originY: number,
    clientX: number,
    clientY: number,
  ): string[] {
    const ws = workspaceRef.current;
    if (!ws) return [];
    const left = Math.min(originX, clientX);
    const top = Math.min(originY, clientY);
    const right = Math.max(originX, clientX);
    const bottom = Math.max(originY, clientY);
    const box = { left, top, right, bottom };
    const ids: string[] = [];
    for (const el of ws.querySelectorAll<HTMLElement>("[data-clip-id]")) {
      const id = el.getAttribute("data-clip-id");
      if (!id) continue;
      const r = el.getBoundingClientRect();
      if (
        rectsIntersect(box, {
          left: r.left,
          top: r.top,
          right: r.right,
          bottom: r.bottom,
        })
      ) {
        ids.push(id);
      }
    }
    return ids;
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

    if (clientX == null || clientY == null) return;
    const ids = hitTestClientRect(
      session.originClientX,
      session.originClientY,
      clientX,
      clientY,
    );
    lastLiveIdsRef.current = ids;
    useEditorStore.getState().setSelectedClipIds(ids);
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
      selectionBefore: [...useEditorStore.getState().selectedClipIds],
    };
  }

  useEffect(() => {
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
      }

      setMarqueeRect(
        buildMarquee(
          session.originClientX,
          session.originClientY,
          event.clientX,
          event.clientY,
        ),
      );

      const liveIds = hitTestClientRect(
        session.originClientX,
        session.originClientY,
        event.clientX,
        event.clientY,
      );
      // Chỉ ghi store khi tập ID đổi — tránh render nóng thừa.
      if (!selectionIdsEqual(liveIds, lastLiveIdsRef.current)) {
        lastLiveIdsRef.current = liveIds;
        useEditorStore.getState().setSelectedClipIds(liveIds);
      }
    }

    function onPointerUp(event: PointerEvent) {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      endSession("pointerup", event.clientX, event.clientY);
    }

    function onPointerCancel(event: PointerEvent) {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      endSession("pointercancel");
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (!sessionRef.current) return;
      event.preventDefault();
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
    };
  }, []);

  return {
    marqueeRect,
    isMarqueeing,
    onWorkspacePointerDown,
  };
}
