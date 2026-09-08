"use client";

import { useCallback, useMemo } from "react";
import { usePlaybackController } from "@/hooks/editor/use-playback-controller";
import { useTransportStore } from "@/hooks/editor/use-transport-store";
import type { TimelinePlaybackPort } from "@/lib/editor/timeline/timeline-playback-port";

type PlaybackTimeLike = {
  time: number;
  playing: boolean;
  duration: number;
  ended: boolean;
};

function toTimelineTimeEvent(event: PlaybackTimeLike) {
  return {
    time: event.time,
    playing: event.playing,
    duration: event.duration,
    ended: event.ended,
  };
}

/** Adapts the app playback controller to the timeline-only playback port. */
export function useTimelinePlaybackPort(): TimelinePlaybackPort {
  const {
    registerPlaybackTimeSink,
    playbackPreviewSeek,
    playbackToggle,
  } = usePlaybackController();
  const currentTime = useTransportStore((state) => state.currentTime);
  const duration = useTransportStore((state) => state.duration);
  const playing = useTransportStore((state) => state.playing);
  const registerTimeSink = useCallback(
    (sink: Parameters<TimelinePlaybackPort["registerTimeSink"]>[0]) =>
      registerPlaybackTimeSink((event) => sink(toTimelineTimeEvent(event))),
    [registerPlaybackTimeSink],
  );

  return useMemo(
    () => ({
      currentTime,
      duration,
      playing,
      previewSeek: playbackPreviewSeek,
      toggle: playbackToggle,
      registerTimeSink,
    }),
    [currentTime, duration, playing, playbackPreviewSeek, playbackToggle, registerTimeSink],
  );
}
