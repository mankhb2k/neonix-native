"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/lib/store/editor-store";
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
      const total =
        state.project?.scenes.reduce((sum, scene) => sum + scene.duration, 0) ??
        0;
      const next = state.currentTime + dt;
      if (next >= total) {
        state.setCurrentTime(total);
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
