"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { compileProtocolV2ToPaintCommands } from "@motionvideo/motion-compiler";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";
import { quantizeTimeToFrame } from "@motionvideo/motion-runtime";
import {
  createPreviewRenderer,
  type PreviewBackendKind,
  type PreviewBackendPreference,
  type PreviewRenderer,
} from "@motionvideo/preview-renderer";

type PreviewStageProps = {
  project: unknown;
  time?: number;
  backend?: PreviewBackendPreference;
  onBackendReady?: (backend: PreviewBackendKind | null) => void;
};

export function PreviewStage({
  project,
  time = 0,
  backend = "auto",
  onBackendReady,
}: PreviewStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PreviewRenderer | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const projectRef = useRef<ReturnType<typeof MotionProtocolV2Schema.parse> | null>(null);
  const timeRef = useRef(time);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const parsedResult = useMemo(
    () => MotionProtocolV2Schema.safeParse(project),
    [project],
  );
  const parsedProject = parsedResult.success ? parsedResult.data : null;
  const error = parsedResult.success ? rendererError : parsedResult.error.message;

  useEffect(() => {
    timeRef.current = time;
    const renderer = rendererRef.current;
    const parsed = projectRef.current;
    if (!renderer || !parsed) return;
    paintFrame(renderer, parsed, time);
  }, [time]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !parsedProject) return undefined;

    onBackendReady?.(null);
    const canvas = document.createElement("canvas");
    canvas.dataset.testid = "preview-v2-canvas";
    canvas.style.position = "absolute";
    canvas.style.left = "50%";
    canvas.style.top = "50%";
    canvas.style.transformOrigin = "center center";
    host.replaceChildren(canvas);
    host.style.position = "relative";
    canvasRef.current = canvas;
    projectRef.current = parsedProject;

    let cancelled = false;
    const devicePixelRatio = window.devicePixelRatio || 1;
    void createPreviewRenderer({
      canvas,
      backend,
      width: parsedProject.composition.width,
      height: parsedProject.composition.height,
      devicePixelRatio,
      preserveDrawingBuffer: true,
    }).then((renderer) => {
      if (cancelled) {
        renderer.dispose();
        return;
      }
      rendererRef.current = renderer;
      canvas.dataset.backend = renderer.backend;
      onBackendReady?.(renderer.backend);
      setRendererError(null);
      paintFrame(renderer, parsedProject, timeRef.current);
      applyCanvasLayout(
        host,
        canvas,
        parsedProject.composition.width,
        parsedProject.composition.height,
        devicePixelRatio,
      );
    }).catch((err: unknown) => {
      if (!cancelled) {
        setRendererError(err instanceof Error ? err.message : String(err));
      }
    });

    return () => {
      cancelled = true;
      rendererRef.current?.dispose();
      rendererRef.current = null;
      onBackendReady?.(null);
      projectRef.current = null;
      canvasRef.current = null;
      canvas.remove();
    };
  }, [backend, onBackendReady, parsedProject]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const parsed = projectRef.current;
    if (!host || !canvas || !parsed) return undefined;
    const update = () => {
      const devicePixelRatio = window.devicePixelRatio || 1;
      const renderer = rendererRef.current;
      if (
        renderer &&
        Number(canvas.dataset.devicePixelRatio) !== devicePixelRatio
      ) {
        renderer.resize(
          parsed.composition.width,
          parsed.composition.height,
          devicePixelRatio,
        );
        paintFrame(renderer, parsed, timeRef.current);
      }
      applyCanvasLayout(
        host,
        canvas,
        parsed.composition.width,
        parsed.composition.height,
        devicePixelRatio,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [parsedProject]);

  return (
    <div
      ref={hostRef}
      className="relative h-full w-full overflow-hidden bg-black"
      data-testid="preview-v2-stage"
    >
      {error ? (
        <pre
          className="h-full overflow-auto p-4 text-[13px] text-red-300 whitespace-pre-wrap"
          data-testid="preview-v2-error"
        >
          {error}
        </pre>
      ) : null}
    </div>
  );
}

function paintFrame(
  renderer: PreviewRenderer,
  project: ReturnType<typeof MotionProtocolV2Schema.parse>,
  time: number,
): void {
  const timestamp = quantizeTimeToFrame(
    Math.max(0, time),
    project.composition.fps,
  );
  renderer.paintCommands(
    compileProtocolV2ToPaintCommands(project, {
      frame: timestamp.frameIndex,
      time: timestamp.time,
    }),
  );
  const rendererCanvas = renderer.canvas;
  if (rendererCanvas instanceof HTMLCanvasElement) {
    rendererCanvas.dataset.drawCalls = String(renderer.getStats().drawCalls);
  }
}

function applyCanvasLayout(
  host: HTMLDivElement,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  devicePixelRatio: number,
): void {
  const scale = Math.min(host.clientWidth / width, host.clientHeight / height);
  const targetCanvas = canvas;
  targetCanvas.style.width = `${width}px`;
  targetCanvas.style.height = `${height}px`;
  targetCanvas.style.transform = `translate(-50%, -50%) scale(${Math.max(0.08, scale)})`;
  targetCanvas.dataset.devicePixelRatio = String(devicePixelRatio);
  targetCanvas.dataset.logicalWidth = String(width);
  targetCanvas.dataset.logicalHeight = String(height);
  targetCanvas.dataset.backingWidth = String(targetCanvas.width);
  targetCanvas.dataset.backingHeight = String(targetCanvas.height);
  targetCanvas.dataset.cssScale = String(Math.max(0.08, scale));
}
