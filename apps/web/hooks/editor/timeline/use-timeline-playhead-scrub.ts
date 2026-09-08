"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { ensurePlayheadScrubScroll } from "@/lib/editor/interaction-host/timeline-dom";
import { createScrubCoordinator } from "@/lib/editor/playback/scrub-coordinator";
import { TIMELINE_START_GUTTER_PX } from "@/lib/editor/timeline/web-timeline-scale";
import {
  PLAYHEAD_SCRUB_EDGE_PX,
  PLAYHEAD_SCRUB_STEP_PX,
} from "@motionvideo/editor-core/timeline";
import type { TimelinePlaybackPort } from "@/lib/editor/timeline/timeline-playback-port";
import type { RefObject } from "react";

type UseTimelinePlayheadScrubArgs = {
  playback: TimelinePlaybackPort;
  scrollRef: RefObject<HTMLDivElement | null>;
  pixelsPerSecond: number;
  scrubMax: number;
  onBeginScrub?: () => void;
  onEndScrub?: () => void;
};

export function useTimelinePlayheadScrub({
  playback,
  scrollRef,
  pixelsPerSecond,
  scrubMax,
  onBeginScrub,
  onEndScrub,
}: UseTimelinePlayheadScrubArgs) {
  const { previewSeek } = playback;
  const draggingRef = useRef(false);
  const ppsRef = useRef(pixelsPerSecond);
  const scrubMaxRef = useRef(scrubMax);
  ppsRef.current = pixelsPerSecond;
  scrubMaxRef.current = scrubMax;

  const scrollPlayheadAtEdge = useCallback((clientX: number): boolean => {
    const scroll = scrollRef.current;
    if (!scroll) return false;
    const { scrolledBy } = ensurePlayheadScrubScroll(
      scroll,
      clientX,
      ppsRef.current,
      scrubMaxRef.current,
      PLAYHEAD_SCRUB_EDGE_PX,
      PLAYHEAD_SCRUB_STEP_PX,
    );
    return scrolledBy !== 0;
  }, [scrollRef]);

  const flushPlayheadScrub = useCallback(
    (clientX: number, reason: "begin" | "frame" | "end") => {
      const scroll = scrollRef.current;
      if (!scroll) return;
      if (reason !== "frame") scrollPlayheadAtEdge(clientX);
      const rect = scroll.getBoundingClientRect();
      const contentX =
        clientX - rect.left + scroll.scrollLeft - TIMELINE_START_GUTTER_PX;
      const time = Math.min(
        scrubMaxRef.current,
        Math.max(0, contentX / Math.max(ppsRef.current, 0.001)),
      );
      previewSeek(time);
    },
    [previewSeek, scrollPlayheadAtEdge, scrollRef],
  );

  const scrubCoordinator = useMemo(
    () =>
      createScrubCoordinator({
        onBegin: () => {
          draggingRef.current = true;
          onBeginScrub?.();
        },
        onFlush: flushPlayheadScrub,
        onEdgeFrame: scrollPlayheadAtEdge,
        onEnd: () => {
          draggingRef.current = false;
          onEndScrub?.();
        },
      }),
    [flushPlayheadScrub, onBeginScrub, onEndScrub, scrollPlayheadAtEdge],
  );

  useEffect(
    () => () => {
      scrubCoordinator.cancel();
      draggingRef.current = false;
    },
    [scrubCoordinator],
  );

  return {
    draggingRef,
    onScrubStart: useCallback(
      (clientX: number) => scrubCoordinator.begin(clientX),
      [scrubCoordinator],
    ),
    onScrubMove: useCallback(
      (clientX: number) => scrubCoordinator.move(clientX),
      [scrubCoordinator],
    ),
    onScrubEnd: useCallback(
      () => scrubCoordinator.end(),
      [scrubCoordinator],
    ),
  };
}
