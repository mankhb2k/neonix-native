"use client";

import { createContext, useContext } from "react";
import type { PlaybackFrameEventV3, PlaybackTimeEventV3 } from "@/lib/editor/playback/playback-controller-v3";
import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import type { RuntimeProjectV3 } from "@motionvideo/motion-runtime";

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
  setPlaybackPreviewDocument: (document: MotionProtocolV2 | null) => void;
  playbackToggle: () => void;
  registerPlaybackVideo: (
    assetId: string,
    element: HTMLVideoElement,
    onFrameReady?: () => void,
  ) => () => void;
  registerPlaybackFrameSink: (sink: (event: PlaybackFrameEventV3) => void) => () => void;
  registerPlaybackTimeSink: (sink: (event: PlaybackTimeEventV3) => void) => () => void;
  playbackRuntimeProject: RuntimeProjectV3 | null;
  setPlaybackPreparedRuntimeProject: (project: RuntimeProjectV3) => void;
  getPlaybackResourceStats: () => {
    registeredVideos: number;
    cachedAudioBuffers: number;
    activeAudioSources: number;
  };
  getPlaybackDiagnostics: () => { performanceSamples: readonly unknown[]; media: Record<string, number> };
};

export const PlaybackControllerContext = createContext<PlaybackControllerActions | null>(null);

export function usePlaybackController(): PlaybackControllerActions {
  const controller = useContext(PlaybackControllerContext);
  if (!controller) throw new Error("usePlaybackController must be used inside EditorProviders");
  return controller;
}
