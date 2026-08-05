import type { NormalizedMotionProjectV2 } from "@motionvideo/motion-schema";
import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { evaluateCompositionSnapshot } from "./evaluate-composition";
import { RemotionSnapshotRenderer } from "./RemotionSnapshotRenderer";

export type MotionCompositionProps = {
  runtime: NormalizedMotionProjectV2;
  sceneId?: string;
  width: number;
  height: number;
  background?: string;
};

/**
 * Generic Remotion composition — AI never authors this file.
 * Preview and export share the same snapshot → renderer path.
 */
export const MotionComposition: React.FC<MotionCompositionProps> = ({
  runtime,
  sceneId,
  width,
  height,
  background,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const snapshot = useMemo(
    () =>
      evaluateCompositionSnapshot(
        runtime,
        frame,
        fps,
        width,
        height,
        sceneId,
        background,
      ),
    [runtime, frame, fps, width, height, sceneId, background],
  );

  if (!snapshot) {
    return (
      <AbsoluteFill
        style={{
          background: background ?? "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#6b7285",
          fontSize: 16,
        }}
      >
        Empty composition
      </AbsoluteFill>
    );
  }

  return <RemotionSnapshotRenderer snapshot={snapshot} interactive={false} />;
};
