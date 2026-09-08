"use client";

import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import { TIMELINE_START_GUTTER_PX } from "@/lib/editor/timeline/web-timeline-scale";
import {
  computePlayheadFollowScroll,
  PLAYHEAD_FOLLOW_MARGIN_PX,
  timelineTimeToViewportLeft,
} from "@motionvideo/editor-core/timeline";
import type { TimelinePlaybackPort } from "@/lib/editor/timeline/timeline-playback-port";

type UseTimelinePlayheadFollowArgs = {
  playback: TimelinePlaybackPort;
  pixelsPerSecond: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  draggingRef: MutableRefObject<boolean>;
  onHScrollLeft: (next: number) => void;
  positionRef: RefObject<HTMLDivElement | null>;
};

export function useTimelinePlayheadFollow({
  playback,
  pixelsPerSecond,
  scrollRef,
  draggingRef,
  onHScrollLeft,
  positionRef,
}: UseTimelinePlayheadFollowArgs) {
  const { currentTime, playing, registerTimeSink } = playback;
  const ppsRef = useRef(pixelsPerSecond);
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const followRafRef = useRef<number | null>(null);
  ppsRef.current = pixelsPerSecond;

  useEffect(() => {
    const updatePosition = (time: number) => {
      const root = positionRef.current;
      if (!root) return;
      const left = timelineTimeToViewportLeft(
        time,
        TIMELINE_START_GUTTER_PX,
        ppsRef.current,
        scrollRef.current?.scrollLeft ?? 0,
      );
      root.style.left = `${left}px`;
      root.dataset.playheadTime = String(time);
    };
    const follow = () => {
      followRafRef.current = null;
      if (!playingRef.current || draggingRef.current) return;
      const scroll = scrollRef.current;
      if (!scroll) return;
      const { scrollLeftDelta, nextScrollLeft } = computePlayheadFollowScroll({
        time: timeRef.current,
        tracksOriginX: TIMELINE_START_GUTTER_PX,
        pixelsPerSecond: ppsRef.current,
        scrollLeft: scroll.scrollLeft,
        clientWidth: scroll.clientWidth,
        scrollWidth: scroll.scrollWidth,
        marginPx: PLAYHEAD_FOLLOW_MARGIN_PX,
      });
      if (scrollLeftDelta !== 0) onHScrollLeft(nextScrollLeft);
    };

    const release = registerTimeSink(({ time, playing }) => {
      timeRef.current = time;
      playingRef.current = playing;
      updatePosition(time);
      if (playing && !draggingRef.current && followRafRef.current == null) {
        followRafRef.current = requestAnimationFrame(follow);
      }
    });

    return () => {
      release();
      if (followRafRef.current != null) cancelAnimationFrame(followRafRef.current);
      followRafRef.current = null;
    };
  }, [draggingRef, onHScrollLeft, positionRef, registerTimeSink, scrollRef]);

  // Preview seeks update the transport snapshot immediately, while the
  // playback sink is primarily frame-driven. Reflect the port snapshot here
  // as well so the playhead and stage never wait for the next frame tick.
  useEffect(() => {
    const root = positionRef.current;
    if (!root) return;
    const left = timelineTimeToViewportLeft(
      currentTime,
      TIMELINE_START_GUTTER_PX,
      ppsRef.current,
      scrollRef.current?.scrollLeft ?? 0,
    );
    root.style.left = `${left}px`;
    root.dataset.playheadTime = String(currentTime);
    timeRef.current = currentTime;
    playingRef.current = playing;
  }, [currentTime, playing, positionRef, scrollRef]);
}
