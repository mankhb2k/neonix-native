import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import {
  MotiClipVideo,
  type MotiClipVideoProps,
} from "@motionvideo/remotion-renderer";
import type { MotionRuntimeProject } from "@motionvideo/motion-protocol/runtime";

export type MotiClipCompositionProps = MotiClipVideoProps;

const calculateMetadata: CalculateMetadataFunction<
  MotiClipCompositionProps
> = async ({ props }) => {
  const composition = props.manifest.composition;
  return {
    durationInFrames: composition.durationInFrames,
    fps: composition.fps,
    width: composition.width,
    height: composition.height,
  };
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
            manifest: null as unknown as MotiClipVideoProps["manifest"],
            runtime: null as unknown as MotionRuntimeProject,
          } satisfies MotiClipCompositionProps
        }
        calculateMetadata={calculateMetadata}
      />
    </>
  );
};
