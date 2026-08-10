import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { evaluateCompositionFrame } from "@motionvideo/motion-runtime";
import type { NormalizedMotionProjectV2 } from "@motionvideo/motion-protocol";
import { RemotionPaintRenderer } from "./RemotionPaintRenderer";

export type MotionCompositionProps = {
  runtime: NormalizedMotionProjectV2;
  width: number;
  height: number;
  background?: string;
  /** When set, frame is local to this scene. Omit for global timeline. */
  sceneId?: string;
};

/** Remotion Player composition — fallback preview path (removed in cutover). */
export function MotionComposition({
  runtime,
  width,
  height,
  background,
  sceneId,
}: MotionCompositionProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const evaluated = evaluateCompositionFrame(
    runtime,
    frame,
    fps,
    width,
    height,
    sceneId,
    background,
  );
  if (!evaluated) {
    return <AbsoluteFill style={{ background: background ?? "#000" }} />;
  }
  return <RemotionPaintRenderer paint={evaluated.paint} />;
}
