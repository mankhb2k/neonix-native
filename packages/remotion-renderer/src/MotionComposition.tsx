import { useCurrentFrame } from "remotion";
import {
  assertRuntimeProjectV2,
  evaluateRuntimeProjectV2,
  type RuntimeProjectV2,
} from "@motionvideo/motion-runtime";
import { RemotionPaintRenderer } from "./RemotionPaintRenderer";
import { RemotionAudioTrack } from "./RemotionAudioTrack";
import { assertRemotionTextPrepared } from "./text-runtime";

export type MotionCompositionProps = {
  runtime: RuntimeProjectV2;
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
  const evaluated = evaluateRuntimeProjectV2(
    assertRemotionTextPrepared(assertRuntimeProjectV2(runtime)),
    frame,
  );
  return (
    <>
      <RemotionPaintRenderer paint={evaluated} />
      <RemotionAudioTrack runtime={runtime} />
    </>
  );
}
