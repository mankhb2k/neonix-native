import type { RuntimeFrameV3 } from "@motionvideo/motion-runtime";
import { RemotionPreviewCanvas } from "./RemotionPreviewCanvas";

export type RemotionFramePainterProps = {
  paint: RuntimeFrameV3;
  backend?: "auto" | "webgpu" | "webgl2";
};

/** Compatibility name for the Matrix4-only Remotion canvas painter. */
export function RemotionFramePainter({
  paint,
  backend = "auto",
}: RemotionFramePainterProps) {
  const beginFrame = paint.commands.find((command) => command.op === "beginFrame");
  if (!beginFrame || beginFrame.op !== "beginFrame") {
    throw new Error("RemotionFramePainter requires a RuntimeFrameV3 beginFrame command");
  }
  return (
    <RemotionPreviewCanvas
      frame={paint}
      width={beginFrame.width}
      height={beginFrame.height}
      background={beginFrame.background}
      backend={backend}
    />
  );
}

/** @deprecated Use RemotionFramePainter or RemotionPreviewCanvas. */
export function RemotionPaintRenderer(props: RemotionFramePainterProps) {
  return <RemotionFramePainter {...props} />;
}
