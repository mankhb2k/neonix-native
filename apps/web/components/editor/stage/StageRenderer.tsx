"use client";

import { PreviewStage } from "@/components/preview/PreviewStage";
import type { PlaybackFrameEventV3 } from "@/lib/editor/playback/playback-controller-v3";
import type { RuntimeFrameV3, RuntimeProjectV3 } from "@motionvideo/motion-runtime";

type StageRendererProps = {
  project: unknown;
  hiddenLayerIds?: readonly string[];
  registerPlaybackFrameSink: (sink: (event: PlaybackFrameEventV3) => void) => () => void;
  onVideoElement?: (
    assetId: string,
    element: HTMLVideoElement,
    onFrameReady?: () => void,
  ) => void | (() => void);
  onFrameReady?: (frame: RuntimeFrameV3) => void;
  runtimeProject?: RuntimeProjectV3 | null;
  onPreparedRuntimeProject?: (project: RuntimeProjectV3) => void;
};

/**
 * Editor-only renderer boundary. Its frame input is authoritative playback;
 * PreviewStage keeps direct compilation/evaluation only for the docs path.
 */
export function StageRenderer({
  project,
  hiddenLayerIds,
  registerPlaybackFrameSink,
  onVideoElement,
  onFrameReady,
  runtimeProject,
  onPreparedRuntimeProject,
}: StageRendererProps) {
  return (
    <PreviewStage
      project={project}
      hiddenLayerIds={hiddenLayerIds}
      backend="skia"
      externalPlayback
      onVideoElement={onVideoElement}
      registerPlaybackFrameSink={registerPlaybackFrameSink}
      onFrameReady={onFrameReady}
      runtimeProject={runtimeProject}
      onPreparedRuntimeProject={onPreparedRuntimeProject}
    />
  );
}
