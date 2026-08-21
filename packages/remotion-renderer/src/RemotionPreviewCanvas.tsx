import { useEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
} from "remotion";
import {
  createPreviewRenderer,
  type PreviewBackendPreference,
  type PreviewRenderer,
} from "@motionvideo/preview-renderer";
import type { RuntimeFrameV2 } from "@motionvideo/motion-runtime";

export type RemotionPreviewCanvasProps = {
  frame: RuntimeFrameV2;
  width: number;
  height: number;
  background?: string;
  backend?: PreviewBackendPreference;
};

/**
 * Remotion's V2 frame surface. It consumes the same RuntimeFrameV2 and native
 * preview backend used by the browser preview; Remotion only schedules frames
 * and encodes the resulting canvas.
 */
export function RemotionPreviewCanvas({
  frame,
  width,
  height,
  background,
  backend = "auto",
}: RemotionPreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<PreviewRenderer | null>(null);
  const frameRef = useRef(frame);
  const handleRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  frameRef.current = frame;

  if (error) throw new Error(`Remotion preview initialization failed: ${error}`);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const handle = delayRender("Initialize Runtime V2 preview renderer");
    handleRef.current = handle;
    let cancelled = false;

    void createPreviewRenderer({
      canvas,
      backend,
      width,
      height,
      devicePixelRatio: 1,
      preserveDrawingBuffer: true,
    })
      .then((renderer) => {
        if (cancelled) {
          renderer.dispose();
          return;
        }
        rendererRef.current = renderer;
        canvas.dataset.backend = renderer.backend;
        renderer.paintFrame(frameRef.current);
        continueRender(handle);
        handleRef.current = null;
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        const message = reason instanceof Error ? reason.message : String(reason);
        setError(message);
        continueRender(handle);
        handleRef.current = null;
      });

    return () => {
      cancelled = true;
      rendererRef.current?.dispose();
      rendererRef.current = null;
      if (handleRef.current === handle) {
        continueRender(handle);
        handleRef.current = null;
      }
    };
  }, [backend, height, width]);

  useEffect(() => {
    rendererRef.current?.paintFrame(frame);
  }, [frame]);

  return (
    <AbsoluteFill style={{ background: background ?? "#000000" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        data-testid="remotion-v2-canvas"
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
}
