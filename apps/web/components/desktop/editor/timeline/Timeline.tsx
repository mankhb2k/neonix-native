"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/lib/store/editor-store";
import { timelineContentEndSeconds } from "./timeline-scale";
import { TransportBar } from "./TransportBar/TransportBar";
import { Tracks } from "./Tracks/Tracks";

export function Timeline() {
  const zoom = useEditorStore((s) => s.timelineZoom);
  const setTimelineZoom = useEditorStore((s) => s.setTimelineZoom);
  const isPlaying = useEditorStore((s) => s.isPlaying);

  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const state = useEditorStore.getState();
      const end = timelineContentEndSeconds(
        state.project?.scenes ?? [],
        state.overlayScenes,
      );
      const next = state.currentTime + dt;
      if (next >= end) {
        state.setCurrentTime(end);
        state.setPlaying(false);
        return;
      }
      state.setCurrentTime(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  return (
    <div className="col-span-full flex flex-col h-full min-h-0 overflow-hidden [grid-area:timeline]">
      <TransportBar zoom={zoom} onZoomChange={setTimelineZoom} />
      <Tracks zoom={zoom} />
    </div>
  );
}
