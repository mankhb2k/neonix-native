import { useEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
} from "remotion";
import {
  createPreviewRenderer,
  type PreviewAsset,
  type PreviewBackendPreference,
  type PreviewRenderer,
} from "@motionvideo/preview-renderer";
import type { PaintCommand, RuntimeFrameV2 } from "@motionvideo/motion-runtime";

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
  const assetsRef = useRef<ReadonlyMap<string, PreviewAsset>>(new Map());
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

    void (async () => {
      const assets = await loadRemotionAssets(frameRef.current);
      if (cancelled) return;
      assetsRef.current = assets;
      const renderer = await createPreviewRenderer({
        canvas,
        backend,
        width,
        height,
        devicePixelRatio: 1,
        preserveDrawingBuffer: true,
        assets,
      });
      if (cancelled) {
        renderer.dispose();
        return;
      }
      rendererRef.current = renderer;
      canvas.dataset.backend = renderer.backend;
      await paintRemotionFrame(renderer, frameRef.current, assets);
      continueRender(handle);
      handleRef.current = null;
    })()
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
      assetsRef.current = new Map();
      if (handleRef.current === handle) {
        continueRender(handle);
        handleRef.current = null;
      }
    };
  }, [backend, height, width]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    void paintRemotionFrame(renderer, frame, assetsRef.current);
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

async function paintRemotionFrame(
  renderer: PreviewRenderer,
  frame: RuntimeFrameV2,
  assets: ReadonlyMap<string, PreviewAsset>,
): Promise<void> {
  const additions = await loadRemotionAssets(frame, assets);
  for (const [assetId, asset] of additions) {
    renderer.setAsset(assetId, asset);
    (assets as Map<string, PreviewAsset>).set(assetId, asset);
  }
  await seekRemotionVideos(frame, assets);
  renderer.paintFrame(frame);
}

async function loadRemotionAssets(
  frame: RuntimeFrameV2,
  existing: ReadonlyMap<string, PreviewAsset> = new Map(),
): Promise<ReadonlyMap<string, PreviewAsset>> {
  const assets = new Map<string, PreviewAsset>();
  const commands = frame.commands.filter(
    (command): command is Extract<PaintCommand, { op: "drawImage" | "drawVideo" }> =>
      command.op === "drawImage" || command.op === "drawVideo",
  );
  for (const command of commands) {
    if (existing.has(command.assetId) || assets.has(command.assetId) || !command.uri) continue;
    try {
      if (command.op === "drawVideo") {
        const video = document.createElement("video");
        video.crossOrigin = "anonymous";
        video.preload = "auto";
        // Remotion uses this element as a frame decoder only. Embedded audio
        // is rendered by RemotionAudioTrack from the runtime mix plan; letting
        // this element produce sound would create a second, drifting player.
        video.muted = true;
        video.volume = 0;
        video.playsInline = true;
        video.src = command.uri;
        video.load();
        await waitForVideoReady(video);
        assets.set(command.assetId, {
          source: video,
          width: command.width || video.videoWidth,
          height: command.height || video.videoHeight,
          kind: "video",
        });
        continue;
      }

      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = command.uri;
      await image.decode();
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      if (!width || !height) throw new Error(`Image asset ${command.assetId} has no dimensions`);
      const raster = document.createElement("canvas");
      raster.width = width;
      raster.height = height;
      const context = raster.getContext("2d");
      if (!context) throw new Error(`Unable to rasterize image asset ${command.assetId}`);
      context.drawImage(image, 0, 0, width, height);
      assets.set(command.assetId, {
        source: raster,
        width,
        height,
        kind: "image",
        pixels: new Uint8Array(context.getImageData(0, 0, width, height).data),
      });
    } catch {
      // The renderer will emit its normal missing-asset diagnostic for unresolved media.
    }
  }
  return assets;
}

async function seekRemotionVideos(
  frame: RuntimeFrameV2,
  assets: ReadonlyMap<string, PreviewAsset>,
): Promise<void> {
  for (const command of frame.commands) {
    if (command.op !== "drawVideo" || command.mediaVisible === false) continue;
    const asset = assets.get(command.assetId);
    if (asset?.kind !== "video" || !(asset.source instanceof HTMLVideoElement)) continue;
    await seekVideo(asset.source, command.mediaTime);
  }
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
