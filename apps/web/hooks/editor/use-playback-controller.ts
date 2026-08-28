"use client";

import { createContext, useContext } from "react";
import type {
  PlaybackFrameEvent,
  PlaybackController,
  PlaybackTimeEvent,
} from "@/lib/editor/playback/playback-controller";

export type PlaybackDiagnostic = {
  id: number;
  source: "audio" | "media";
  code: string;
  message: string;
  assetId?: string;
  uri?: string;
  at: number;
};

export type PlaybackControllerActions = {
  playbackDiagnostics: readonly PlaybackDiagnostic[];
  playbackPlay: () => void;
  playbackPause: () => void;
  playbackSeek: (time: number) => void;
  playbackPreviewSeek: (time: number) => void;
  playbackToggle: () => void;
  registerPlaybackVideo: (
    assetId: string,
    element: HTMLVideoElement,
    onFrameReady?: () => void,
  ) => () => void;
  registerPlaybackFrameSink: (sink: (event: PlaybackFrameEvent) => void) => () => void;
  registerPlaybackTimeSink: (sink: (event: PlaybackTimeEvent) => void) => () => void;
  getPlaybackResourceStats: () => {
    registeredVideos: number;
    cachedAudioBuffers: number;
    activeAudioSources: number;
  };
  getPlaybackDiagnostics: () => ReturnType<PlaybackController["getDiagnostics"]>;
};

export const PlaybackControllerContext = createContext<PlaybackControllerActions | null>(null);

export function usePlaybackController(): PlaybackControllerActions {
  const controller = useContext(PlaybackControllerContext);
  if (!controller) throw new Error("usePlaybackController must be used inside EditorProviders");
  return controller;
}
