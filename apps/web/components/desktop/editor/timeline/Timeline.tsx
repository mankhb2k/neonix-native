"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/lib/store/editor-store";
import { usePlaybackClock } from "@/lib/playback/playback-clock-store";
import { usePlaybackDriver } from "@/lib/playback/use-playback-driver";
import { clipsContentEndSeconds } from "@/lib/timeline-clips";
import { TransportBar } from "./TransportBar/TransportBar";
import { TimelineBoard } from "./TimelineBoard";

export function Timeline() {
  const zoom = useEditorStore((s) => s.timelineZoom);
  const setTimelineZoom = useEditorStore((s) => s.setTimelineZoom);
  const timelineClips = useEditorStore((s) => s.timelineClips);
  const setDuration = usePlaybackClock((s) => s.setDuration);
  const seek = usePlaybackClock((s) => s.seek);
  const pause = usePlaybackClock((s) => s.pause);

  usePlaybackDriver();

  useEffect(() => {
    const end = clipsContentEndSeconds(timelineClips);
    setDuration(end);
  }, [timelineClips, setDuration]);

  // Reset clock when project id changes (load).
  const projectId = useEditorStore((s) => s.project?.metadata.id);
  useEffect(() => {
    if (!projectId) return;
    pause();
    seek(0);
    setDuration(clipsContentEndSeconds(useEditorStore.getState().timelineClips));
  }, [projectId, pause, seek, setDuration]);

  return (
    <div className="col-span-full flex flex-col h-full min-h-0 overflow-hidden [grid-area:timeline]">
      <TransportBar zoom={zoom} onZoomChange={setTimelineZoom} />
      <TimelineBoard zoom={zoom} />
    </div>
  );
}
