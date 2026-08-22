import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import {
  MotiClipVideo,
  type MotiClipVideoProps,
} from "@motionvideo/remotion-renderer";
import {
  orthographicProjectionMatrix,
  type RuntimeProjectV2,
} from "@motionvideo/motion-runtime";

export type MotiClipCompositionProps = MotiClipVideoProps;

const DEFAULT_DURATION_IN_FRAMES = 90;

const calculateMetadata: CalculateMetadataFunction<
  MotiClipCompositionProps
> = async ({ props }) => {
  const composition = props.runtime.composition;
  return {
    durationInFrames: DEFAULT_DURATION_IN_FRAMES,
    fps: composition.fps,
    width: composition.width,
    height: composition.height,
  };
};

const defaultRuntime: RuntimeProjectV2 = {
  format: "motion-runtime",
  formatVersion: 2,
  id: "remotion-default-runtime-v2",
  composition: {
    width: 1920,
    height: 1080,
    fps: 30,
    background: "#000000",
    graphId: "remotion-default-runtime-v2",
  },
  view: {
    worldToClipMatrix: orthographicProjectionMatrix(1920, 1080, 1, 1, 4000),
  },
  nodes: [],
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MotiClipVideo"
        component={MotiClipVideo}
        durationInFrames={90}
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
