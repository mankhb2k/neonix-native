"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/lib/editor/editor-store";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import { usePlaybackDriver } from "@/hooks/editor/use-playback-driver";
import { clipsContentEndSeconds } from "@/lib/editor/timeline-clips";
import { TransportBar } from "./TransportBar/TransportBar";
import { TimelineBoard } from "./TimelineBoard";

export function Timeline() {
  const zoom = useEditorStore((s) => s.timelineZoom);
  const setTimelineZoom = useEditorStore((s) => s.setTimelineZoom);
  const timelineClips = useEditorStore((s) => s.timelineClips);
  const setDuration = usePlaybackClock((s) => s.setDuration);

  usePlaybackDriver();

  // Chỉ sync duration khi clips đổi — load project đã gọi reset() atomic.
  useEffect(() => {
    const end = clipsContentEndSeconds(timelineClips);
    setDuration(end);
  }, [timelineClips, setDuration]);

  return (
    <div className="col-span-full flex flex-col h-full min-h-0 overflow-hidden [grid-area:timeline]">
      <TransportBar zoom={zoom} onZoomChange={setTimelineZoom} />
      <TimelineBoard zoom={zoom} />
    </div>
  );
}
