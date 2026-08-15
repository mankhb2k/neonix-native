import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { evaluateCompositionFrameV1 } from "@motionvideo/motion-runtime";
import type { MotionRuntimeProject } from "@motionvideo/motion-protocol/runtime";
import { RemotionPaintRenderer } from "./RemotionPaintRenderer";

export type MotionCompositionProps = {
  runtime: MotionRuntimeProject;
  width: number;
  height: number;
  background?: string;
  /** When set, frame is local to this layer graph. Omit for the global timeline. */
  graphId?: string;
};

/** Remotion Player composition — fallback preview path. */
export function MotionComposition({
  runtime,
  width,
  height,
  background,
  graphId,
}: MotionCompositionProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const evaluated = evaluateCompositionFrameV1(
    runtime,
    frame,
    fps,
    width,
    height,
    { graphId, background },
  );
  if (!evaluated) {
    return <AbsoluteFill style={{ background: background ?? "#000" }} />;
  }
  return <RemotionPaintRenderer paint={evaluated.paint} />;
}
