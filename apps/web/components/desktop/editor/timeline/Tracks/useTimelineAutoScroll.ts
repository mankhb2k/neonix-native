"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type RefObject,
} from "react";

const EDGE_SIZE_PX = 48;
const MAX_SCROLL_PX_PER_FRAME = 22;

export type TimelineAutoScrollOwner =
  | "marquee"
  | "clip-move"
  | "sidebar-drag";

export type AutoScrollOptions = {
  maxScrollTop?: number;
  maxScrollLeft?: number;
};

type AutoScrollSession = {
  owner: TimelineAutoScrollOwner;
  /** Optional session token — stop only clears if token matches (or omitted). */
  sessionToken?: string;
  clientX: number;
  clientY: number;
  onScrolled: () => void;
  options?: AutoScrollOptions;
};

export type TimelineAutoScrollController = {
  updatePointer: (
    owner: TimelineAutoScrollOwner,
    clientX: number,
    clientY: number,
    onScrolled: () => void,
    options?: AutoScrollOptions & { sessionToken?: string },
  ) => void;
  stop: (owner: TimelineAutoScrollOwner, sessionToken?: string) => void;
};

/** Quadratic edge acceleration: slow on entry, fast at the viewport edge. */
export function edgeScrollVelocity(
  pointer: number,
  viewportStart: number,
  viewportEnd: number,
  edgeSize = EDGE_SIZE_PX,
  maxVelocity = MAX_SCROLL_PX_PER_FRAME,
): number {
  if (edgeSize <= 0 || maxVelocity <= 0 || viewportEnd <= viewportStart) {
    return 0;
  }

  if (pointer < viewportStart + edgeSize) {
    const ratio = Math.min(
      1,
      Math.max(0, (viewportStart + edgeSize - pointer) / edgeSize),
    );
    return -Math.max(1, Math.round(maxVelocity * ratio * ratio));
  }

  if (pointer > viewportEnd - edgeSize) {
    const ratio = Math.min(
      1,
      Math.max(0, (pointer - (viewportEnd - edgeSize)) / edgeSize),
    );
    return Math.max(1, Math.round(maxVelocity * ratio * ratio));
  }

  return 0;
}

/**
 * One viewport auto-scroll controller shared by timeline interactions.
 * Session state stays in refs so scrolling never renders the whole timeline.
 */
export function useTimelineAutoScroll(
  scrollContainerRef: RefObject<HTMLDivElement | null>,
): TimelineAutoScrollController {
  const sessionRef = useRef<AutoScrollSession | null>(null);
  const frameRef = useRef<number | null>(null);
  const runFrameRef = useRef<() => void>(() => undefined);

  const scheduleFrame = useCallback(() => {
    if (frameRef.current != null) return;
    frameRef.current = requestAnimationFrame(() => runFrameRef.current());
  }, []);

  runFrameRef.current = () => {
    frameRef.current = null;
    const root = scrollContainerRef.current;
    const session = sessionRef.current;
    if (!root || !session) return;

    const bounds = root.getBoundingClientRect();
    let velocityX = edgeScrollVelocity(
      session.clientX,
      bounds.left,
      bounds.right,
    );
    let velocityY = edgeScrollVelocity(
      session.clientY,
      bounds.top,
      bounds.bottom,
    );

    if (
      session.options?.maxScrollTop != null &&
      velocityY > 0 &&
      root.scrollTop >= session.options.maxScrollTop
    ) {
      velocityY = 0;
    }
    if (
      session.options?.maxScrollLeft != null &&
      velocityX > 0 &&
      root.scrollLeft >= session.options.maxScrollLeft
    ) {
      velocityX = 0;
    }

    if (velocityX === 0 && velocityY === 0) return;

    const beforeLeft = root.scrollLeft;
    const beforeTop = root.scrollTop;
    if (velocityX !== 0) root.scrollLeft += velocityX;
    if (velocityY !== 0) root.scrollTop += velocityY;

    const didScroll =
      root.scrollLeft !== beforeLeft || root.scrollTop !== beforeTop;
    if (!didScroll) return;

    session.onScrolled();
    scheduleFrame();
  };

  const updatePointer = useCallback(
    (
      owner: TimelineAutoScrollOwner,
      clientX: number,
      clientY: number,
      onScrolled: () => void,
      options?: AutoScrollOptions & { sessionToken?: string },
    ) => {
      sessionRef.current = {
        owner,
        clientX,
        clientY,
        onScrolled,
        options,
        sessionToken: options?.sessionToken,
      };
      scheduleFrame();
    },
    [scheduleFrame],
  );

  const stop = useCallback(
    (owner: TimelineAutoScrollOwner, sessionToken?: string) => {
      const current = sessionRef.current;
      if (!current || current.owner !== owner) return;
      if (
        sessionToken != null &&
        current.sessionToken != null &&
        current.sessionToken !== sessionToken
      ) {
        return;
      }
      sessionRef.current = null;
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    },
    [],
  );

  useEffect(
    () => () => {
      sessionRef.current = null;
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  return useMemo(
    () => ({ updatePointer, stop }),
    [stop, updatePointer],
  );
}
