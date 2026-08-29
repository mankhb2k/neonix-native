import { useCurrentFrame } from "remotion";
import { useMemo } from "react";
import {
  evaluateRuntimeProjectV3,
  type RuntimeProjectV3,
} from "@motionvideo/motion-runtime";
import { RemotionPreviewCanvas } from "./RemotionPreviewCanvas";
import { RemotionAudioTrack } from "./RemotionAudioTrack";
import { assertRemotionTextPrepared } from "./text-runtime";

export type MotiClipVideoProps = {
  /** Canonical V3 Runtime IR supplied by the export/application layer. */
  runtime: RuntimeProjectV3;
};

/**
 * Production Remotion composition for the V3 Runtime IR. It evaluates each
 * frame through the shared V3 runtime and paints the resulting command buffer.
 */
export function MotiClipVideo({ runtime: runtimeProp }: MotiClipVideoProps) {
  const runtime = useMemo(
    () => assertRemotionTextPrepared(runtimeProp),
    [runtimeProp],
  );
  const frame = useCurrentFrame();
  const { background } = runtime.visual.composition;
  const evaluated = evaluateRuntimeProjectV3(runtime, frame);

  return (
    <>
      <RemotionPreviewCanvas
        frame={evaluated}
        width={runtime.visual.composition.width}
        height={runtime.visual.composition.height}
        background={background}
      />
      <RemotionAudioTrack runtime={runtime} />
    </>
  );
}
