import { useCurrentFrame } from "remotion";
import {
  assertRuntimeProjectV2,
  evaluateRuntimeProjectV2,
  type RuntimeProjectV2,
} from "@motionvideo/motion-runtime";
import { RemotionPreviewCanvas } from "./RemotionPreviewCanvas";
import { assertRemotionTextPrepared } from "./text-runtime";

export type MotiClipVideoProps = {
  /** Canonical V2 Runtime IR supplied by the export/application layer. */
  runtime: RuntimeProjectV2;
};

/**
 * Production Remotion composition for the V2 Runtime IR. It evaluates each
 * frame through the shared V2 runtime and paints the resulting command buffer.
 */
export function MotiClipVideo({ runtime: runtimeProp }: MotiClipVideoProps) {
  const runtime = assertRemotionTextPrepared(assertRuntimeProjectV2(runtimeProp));
  const frame = useCurrentFrame();
  const { background } = runtime.composition;
  const evaluated = evaluateRuntimeProjectV2(runtime, frame);

  return (
    <RemotionPreviewCanvas
      frame={evaluated}
      width={runtime.composition.width}
      height={runtime.composition.height}
      background={background}
    />
  );
}
