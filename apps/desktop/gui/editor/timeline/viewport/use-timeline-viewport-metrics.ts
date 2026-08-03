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

type ScrollSnapshot = { left: number; top: number };

export function useTimelineViewportMetrics({
  boardRef,
  tracksScrollRef,
  resetKey,
  contentMeasureKey = 0,
}: Args) {
  const [viewWidth, setViewWidth] = useState(0);
  const [trackViewHeight, setTrackViewHeight] = useState(0);
  const [scroll, setScroll] = useState<ScrollSnapshot>({ left: 0, top: 0 });
  const [hScrollContentWidth, setHScrollContentWidth] = useState(0);
  const [hScrollViewportWidth, setHScrollViewportWidth] = useState(0);

  const scrollRafRef = useRef<number | null>(null);
  const pendingScrollRef = useRef<ScrollSnapshot>({ left: 0, top: 0 });
  const publishedScrollRef = useRef<ScrollSnapshot>({ left: 0, top: 0 });

  const onScroll = useCallback(() => {
    const root = tracksScrollRef.current;
    if (!root) return;
    pendingScrollRef.current = {
      left: root.scrollLeft,
      top: root.scrollTop,
    };

    if (scrollRafRef.current == null) {
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = null;
        const next = pendingScrollRef.current;
        const published = publishedScrollRef.current;
        if (published.left === next.left && published.top === next.top) {
          return;
        }
        publishedScrollRef.current = next;
        setScroll(next);
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
    if (scrollRafRef.current != null) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
    if (!root) return;
    root.scrollLeft = 0;
    root.scrollTop = 0;
    pendingScrollRef.current = { left: 0, top: 0 };
    publishedScrollRef.current = { left: 0, top: 0 };
    setScroll({ left: 0, top: 0 });
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
      if (scrollRafRef.current != null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  return {
    viewWidth,
    trackViewHeight,
    scrollLeft: scroll.left,
    scrollTop: scroll.top,
    hScrollContentWidth,
    hScrollViewportWidth,
    onScroll,
    onHScrollLeft,
  };
}
