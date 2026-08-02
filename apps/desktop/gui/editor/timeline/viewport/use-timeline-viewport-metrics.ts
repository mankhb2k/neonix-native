/**
 * Viewport size + RAF-throttled scroll metrics for TimelineViewport.
 */

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

type Args = {
  boardRef: RefObject<HTMLElement | null>;
  tracksScrollRef: RefObject<HTMLElement | null>;
  /** Reset scroll when project / fit revision changes. */
  resetKey: string | number | null;
  /** Re-measure H-scroll content when canvas/clips change. */
  contentMeasureKey?: string | number;
};

export function useTimelineViewportMetrics({
  boardRef,
  tracksScrollRef,
  resetKey,
  contentMeasureKey = 0,
}: Args) {
  const [viewWidth, setViewWidth] = useState(0);
  const [trackViewHeight, setTrackViewHeight] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [hScrollContentWidth, setHScrollContentWidth] = useState(0);
  const [hScrollViewportWidth, setHScrollViewportWidth] = useState(0);

  const scrollLeftRafRef = useRef<number | null>(null);
  const scrollTopRafRef = useRef<number | null>(null);
  const pendingScrollLeftRef = useRef(0);
  const pendingScrollTopRef = useRef(0);

  const onScroll = useCallback(() => {
    const root = tracksScrollRef.current;
    if (!root) return;
    pendingScrollLeftRef.current = root.scrollLeft;
    pendingScrollTopRef.current = root.scrollTop;

    if (scrollLeftRafRef.current == null) {
      scrollLeftRafRef.current = requestAnimationFrame(() => {
        scrollLeftRafRef.current = null;
        setScrollLeft(pendingScrollLeftRef.current);
      });
    }
    if (scrollTopRafRef.current == null) {
      scrollTopRafRef.current = requestAnimationFrame(() => {
        scrollTopRafRef.current = null;
        setScrollTop(pendingScrollTopRef.current);
      });
    }
  }, [tracksScrollRef]);

  const onHScrollLeft = useCallback(
    (next: number) => {
      const tracks = tracksScrollRef.current;
      if (!tracks) return;
      const max = Math.max(0, tracks.scrollWidth - tracks.clientWidth);
      tracks.scrollLeft = Math.min(max, Math.max(0, next));
    },
    [tracksScrollRef],
  );

  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return undefined;
    const update = () => setViewWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [boardRef]);

  useLayoutEffect(() => {
    const el = tracksScrollRef.current;
    if (!el) return undefined;
    const update = () => setTrackViewHeight(el.clientHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [tracksScrollRef]);

  useLayoutEffect(() => {
    const root = tracksScrollRef.current;
    if (scrollLeftRafRef.current != null) {
      cancelAnimationFrame(scrollLeftRafRef.current);
      scrollLeftRafRef.current = null;
    }
    if (scrollTopRafRef.current != null) {
      cancelAnimationFrame(scrollTopRafRef.current);
      scrollTopRafRef.current = null;
    }
    if (!root) return;
    root.scrollLeft = 0;
    root.scrollTop = 0;
    setScrollLeft(0);
    setScrollTop(0);
  }, [resetKey, tracksScrollRef]);

  useLayoutEffect(() => {
    const el = tracksScrollRef.current;
    if (!el) return undefined;
    const measure = () => {
      const nextContent = el.scrollWidth;
      const nextViewport = el.clientWidth;
      setHScrollContentWidth((prev) =>
        prev === nextContent ? prev : nextContent,
      );
      setHScrollViewportWidth((prev) =>
        prev === nextViewport ? prev : nextViewport,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const first = el.firstElementChild;
    if (first) ro.observe(first);
    return () => ro.disconnect();
  }, [tracksScrollRef, contentMeasureKey]);

  useLayoutEffect(() => {
    return () => {
      if (scrollLeftRafRef.current != null) {
        cancelAnimationFrame(scrollLeftRafRef.current);
      }
      if (scrollTopRafRef.current != null) {
        cancelAnimationFrame(scrollTopRafRef.current);
      }
    };
  }, []);

  return {
    viewWidth,
    trackViewHeight,
    scrollLeft,
    scrollTop,
    hScrollContentWidth,
    hScrollViewportWidth,
    onScroll,
    onHScrollLeft,
  };
}
