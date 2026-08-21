"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { compileProtocolV2 } from "@motionvideo/motion-compiler";
import {
  MotionProtocolV2Schema,
  type MotionProtocolV2,
} from "@motionvideo/motion-protocol/v2";
import {
  evaluateRuntimeProjectV2,
  frameIndexAtTime,
} from "@motionvideo/motion-runtime";
import {
  createPreviewRenderer,
  type PreviewAsset,
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
  const assetsRef = useRef<ReadonlyMap<string, PreviewAsset>>(new Map());
  const paintRequestRef = useRef(0);
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
    const requestId = ++paintRequestRef.current;
    void paintFrame(renderer, parsed, time, assetsRef.current, requestId, paintRequestRef);
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
    void (async () => {
      const assets = await loadPreviewAssets(parsedProject);
      if (cancelled) return;
      assetsRef.current = assets;
      const renderer = await createPreviewRenderer({
        canvas,
        backend,
        width: parsedProject.composition.width,
        height: parsedProject.composition.height,
        devicePixelRatio,
        preserveDrawingBuffer: true,
        assets,
      });
      if (cancelled) {
        renderer.dispose();
        return;
      }
      rendererRef.current = renderer;
      canvas.dataset.backend = renderer.backend;
      onBackendReady?.(renderer.backend);
      setRendererError(null);
      const requestId = ++paintRequestRef.current;
      void paintFrame(renderer, parsedProject, timeRef.current, assets, requestId, paintRequestRef);
      applyCanvasLayout(
        host,
        canvas,
        parsedProject.composition.width,
        parsedProject.composition.height,
        devicePixelRatio,
      );
    })().catch((err: unknown) => {
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
      assetsRef.current = new Map();
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
        const requestId = ++paintRequestRef.current;
        void paintFrame(renderer, parsed, timeRef.current, assetsRef.current, requestId, paintRequestRef);
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

async function loadPreviewAssets(
  project: MotionProtocolV2,
): Promise<ReadonlyMap<string, PreviewAsset>> {
  const loaded = new Map<string, PreviewAsset>();
  for (const asset of project.assets ?? []) {
    try {
      if (asset.kind === "video") {
        const video = document.createElement("video");
        video.crossOrigin = "anonymous";
        video.preload = "auto";
        video.muted = true;
        video.playsInline = true;
        video.src = asset.uri;
        video.load();
        await waitForVideoReady(video);
        const width = asset.width ?? video.videoWidth;
        const height = asset.height ?? video.videoHeight;
        if (!width || !height) throw new Error(`Video asset ${asset.id} has no dimensions`);
        await seekVideo(video, 0);
        loaded.set(asset.id, { source: video, width, height, kind: "video" });
        continue;
      }
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = asset.uri;
      await image.decode();
      const width = asset.width ?? image.naturalWidth;
      const height = asset.height ?? image.naturalHeight;
      const raster = document.createElement("canvas");
      raster.width = width;
      raster.height = height;
      const context = raster.getContext("2d");
      if (!context) throw new Error(`Unable to rasterize image asset ${asset.id}`);
      context.drawImage(image, 0, 0, width, height);
      const pixels = new Uint8Array(context.getImageData(0, 0, width, height).data);
      loaded.set(asset.id, {
        source: raster,
        width,
        height,
        kind: "image",
        pixels,
      });
    } catch {
      // Keep the renderer alive so it can report preview_asset_missing.
    }
  }
  return loaded;
}

function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Unable to load video asset ${video.src}`));
    };
    const cleanup = () => {
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("loadeddata", onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  if (Math.abs(video.currentTime - time) < 0.0005 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let settled = false;
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      window.clearTimeout(timeout);
    };
    const onSeeked = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const timeout = window.setTimeout(onSeeked, 2000);
    video.addEventListener("seeked", onSeeked, { once: true });
    video.currentTime = Math.max(0, time);
  });
}

async function seekPreviewVideos(
  frame: ReturnType<typeof evaluateRuntimeProjectV2>,
  assets: ReadonlyMap<string, PreviewAsset>,
): Promise<void> {
  for (const command of frame.commands) {
    if (command.op !== "drawVideo" || command.mediaVisible === false) continue;
    const asset = assets.get(command.assetId);
    if (asset?.kind !== "video" || !(asset.source instanceof HTMLVideoElement)) continue;
    asset.source.muted = command.muted ?? true;
    await seekVideo(asset.source, command.mediaTime);
  }
}

async function paintFrame(
  renderer: PreviewRenderer,
  project: ReturnType<typeof MotionProtocolV2Schema.parse>,
  time: number,
  assets: ReadonlyMap<string, PreviewAsset>,
  requestId: number,
  requestRef: { current: number },
): Promise<void> {
  const frame = frameIndexAtTime(Math.max(0, time), project.composition.fps);
  const runtime = compileProtocolV2(project);
  const evaluated = evaluateRuntimeProjectV2(runtime, frame);
  await seekPreviewVideos(evaluated, assets);
  if (requestId !== requestRef.current) return;
  renderer.paintFrame(evaluated);
  const rendererCanvas = renderer.canvas;
  if (rendererCanvas instanceof HTMLCanvasElement) {
    rendererCanvas.dataset.drawCalls = String(renderer.getStats().drawCalls);
    rendererCanvas.dataset.videoTimes = evaluated.commands
      .filter((command) => command.op === "drawVideo")
      .map((command) => `${command.key}:${command.mediaTime.toFixed(3)}:${command.mediaVisible !== false ? "visible" : "hidden"}`)
      .join(",");
    rendererCanvas.dataset.diagnostics = [
      ...evaluated.diagnostics,
      ...renderer.getStats().diagnostics,
    ]
      .map((diagnostic) => diagnostic.code)
      .join(",");
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
