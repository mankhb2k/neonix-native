import { useCurrentFrame } from "remotion";
import {
  evaluateRuntimeProjectV3,
  type RuntimeProjectV3,
} from "@motionvideo/motion-runtime";
import { RemotionPaintRenderer } from "./RemotionPaintRenderer";
import { RemotionAudioTrack } from "./RemotionAudioTrack";
import { assertRemotionTextPrepared } from "./text-runtime";

export type MotionCompositionProps = {
  runtime: RuntimeProjectV3;
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
  void width;
  void height;
  void graphId;
  void background;
  const evaluated = evaluateRuntimeProjectV3(assertRemotionTextPrepared(runtime), frame);
  return (
    <>
      <RemotionPaintRenderer paint={evaluated} />
      <RemotionAudioTrack runtime={runtime} />
    </>
  );
}
