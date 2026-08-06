import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import {
  MotiClipVideo,
  type MotiClipVideoProps,
} from "@motionvideo/remotion-renderer";
import { parseRenderManifest } from "@motionvideo/render-contracts";
import type { NormalizedMotionProjectV2 } from "@motionvideo/motion-schema";

export type MotiClipCompositionProps = MotiClipVideoProps;

const calculateMetadata: CalculateMetadataFunction<
  MotiClipCompositionProps
> = async ({ props }) => {
  const manifest = parseRenderManifest(props.manifest);
  return {
    durationInFrames: manifest.composition.durationInFrames,
    fps: manifest.composition.fps,
    width: manifest.composition.width,
    height: manifest.composition.height,
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
            runtime: null as unknown as NormalizedMotionProjectV2,
          } satisfies MotiClipCompositionProps
        }
        calculateMetadata={calculateMetadata}
      />
    </>
  );
};
