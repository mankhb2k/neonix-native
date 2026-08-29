import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import {
  MotiClipVideo,
  type MotiClipVideoProps,
} from "@motionvideo/remotion-renderer";
import {
  orthographicProjectionMatrix,
  type RuntimeProjectV3,
} from "@motionvideo/motion-runtime";

export type MotiClipCompositionProps = MotiClipVideoProps;

const DEFAULT_DURATION_IN_FRAMES = 90;

const calculateMetadata: CalculateMetadataFunction<
  MotiClipCompositionProps
> = async ({ props }) => {
  const composition = props.runtime.visual.composition;
  const durationInFrames = composition.duration === undefined
    ? DEFAULT_DURATION_IN_FRAMES
    : Math.max(1, Math.ceil(composition.duration * composition.fps));
  return {
    durationInFrames,
    fps: composition.fps,
    width: composition.width,
    height: composition.height,
  };
};

const defaultRuntime: RuntimeProjectV3 = {
  format: "motion-runtime",
  runtimeVersion: 3,
  projectId: "remotion-default-runtime-v3",
  visual: {
    composition: {
    width: 1920,
    height: 1080,
    fps: 30,
    background: "#000000",
      graphId: "remotion-default-runtime-v3",
    },
    view: {
      worldToClipMatrix: orthographicProjectionMatrix(1920, 1080, 1, 1, 4000),
    },
    nodes: [],
  },
  mediaCatalog: { assets: [] },
  videoTimeline: { instances: [] },
  audioTimeline: { sampleRate: 48000, tracks: [] },
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MotiClipVideo"
        component={MotiClipVideo}
        durationInFrames={DEFAULT_DURATION_IN_FRAMES}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={
          {
            runtime: defaultRuntime,
          } satisfies MotiClipCompositionProps
        }
        calculateMetadata={calculateMetadata}
      />
    </>
  );
};
