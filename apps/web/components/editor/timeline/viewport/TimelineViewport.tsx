"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import type { DesignBoard } from "../fixtures/design-board";
import {
  buildLayerLaneRows,
  buildTrackLaneRows,
} from "../lanes/timeline-lane-rows";
import {
  TIMELINE_INLINE_PADDING_PX,
  TIMELINE_TOP_PADDING_PX,
  TIMELINE_BOTTOM_PADDING_PX,
  pixelsPerSecondForZoom,
} from "../timeline-scale";
import { TimeRuler } from "../TimeRuler/TimeRuler";
import { Playhead } from "./Playhead";
import { TimelineHScrollBar } from "./TimelineHScrollBar";
import { TimelineTrackCanvas } from "./TimelineTrackCanvas";
import type { TimelineDesignMode } from "../Header/TransportBar";

type Props = {
  mode: TimelineDesignMode;
  board: DesignBoard;
  zoom: number;
  currentTime: number;
};

export function TimelineViewport({ mode, board, zoom, currentTime }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewWidth, setViewWidth] = useState(800);

  const pps = pixelsPerSecondForZoom(zoom);
  const rows = useMemo(
    () =>
      mode === "layer"
        ? buildLayerLaneRows(board.lanes)
        : buildTrackLaneRows(board.lanes),
    [board.lanes, mode],
  );

  const contentWidth = Math.max(viewWidth, board.duration * pps);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const update = () => setViewWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const playheadLeft = currentTime * pps - scrollLeft;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{
        paddingLeft: TIMELINE_INLINE_PADDING_PX,
        paddingRight: TIMELINE_INLINE_PADDING_PX,
      }}
      data-testid="timeline-viewport"
    >
      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
      >
        <div
          className="relative"
          style={{
            width: contentWidth,
            paddingTop: TIMELINE_TOP_PADDING_PX,
            paddingBottom: TIMELINE_BOTTOM_PADDING_PX,
          }}
        >
          <TimeRuler
            duration={board.duration}
            fps={board.fps}
            pixelsPerSecond={pps}
            scrollLeft={scrollLeft}
            originOffsetPx={0}
            viewWidth={viewWidth}
          />
          <TimelineTrackCanvas
            rows={rows}
            clips={board.clips}
            pixelsPerSecond={pps}
            contentWidth={contentWidth}
            muteWindow={mode === "layer" ? board.containerWindow : null}
            duration={board.duration}
          />
        </div>

        <Playhead leftPx={playheadLeft} muted={board.duration <= 0} />
      </div>

      <TimelineHScrollBar
        scrollLeft={scrollLeft}
        contentWidth={contentWidth}
        viewportWidth={viewWidth}
        onScrollLeft={(left) => {
          setScrollLeft(left);
          if (scrollRef.current) scrollRef.current.scrollLeft = left;
        }}
      />
    </div>
  );
}
