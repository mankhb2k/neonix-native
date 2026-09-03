import type { PaintCommand } from "@motionvideo/motion-runtime";
import type { SkiaCanvas, SkiaCanvasKit, SkiaImage } from "../canvas-kit";
import type { SkiaAsset } from "../types";
import { createSkiaPaint } from "../paint";

function imageRectForCommand(
  command: Extract<PaintCommand, { op: "drawImage" | "drawVideo" }>,
  asset: SkiaAsset,
): { source: [number, number, number, number]; destination: [number, number, number, number]; clip?: [number, number, number, number] } {
  const viewportWidth = command.width;
  const viewportHeight = command.height;
  const fit = command.op === "drawVideo" ? command.fit : undefined;
  const preserve = command.op === "drawImage" ? command.preserveAspectRatio : undefined;
  const align = preserve?.align ?? "xMidYMid";
  const none = fit === "none" || align === "none";
  if (none) {
    const x = command.op === "drawImage" ? command.x : 0;
    const y = command.op === "drawImage" ? command.y : 0;
    return {
      source: [0, 0, asset.width, asset.height],
      destination: [x, y, x + viewportWidth, y + viewportHeight],
    };
  }
  const forceFill = fit === "fill" || (command.op === "drawVideo" && !fit);
  if (forceFill) {
    const x = command.op === "drawImage" ? command.x : 0;
    const y = command.op === "drawImage" ? command.y : 0;
    return {
      source: [0, 0, asset.width, asset.height],
      destination: [x, y, x + viewportWidth, y + viewportHeight],
    };
  }
  const slice = fit === "cover" || preserve?.meetOrSlice === "slice";
  const scale = slice
    ? Math.max(viewportWidth / asset.width, viewportHeight / asset.height)
    : Math.min(viewportWidth / asset.width, viewportHeight / asset.height);
  const drawWidth = asset.width * scale;
  const drawHeight = asset.height * scale;
  const x = command.op === "drawImage" ? command.x : 0;
  const y = command.op === "drawImage" ? command.y : 0;
  const xFactor = align.includes("xMin") ? 0 : align.includes("xMax") ? 1 : 0.5;
  const yFactor = align.includes("YMin") ? 0 : align.includes("YMax") ? 1 : 0.5;
  return {
    source: [0, 0, asset.width, asset.height],
    destination: [x + (viewportWidth - drawWidth) * xFactor, y + (viewportHeight - drawHeight) * yFactor, x + (viewportWidth - drawWidth) * xFactor + drawWidth, y + (viewportHeight - drawHeight) * yFactor + drawHeight],
    clip: slice ? [x, y, x + viewportWidth, y + viewportHeight] : undefined,
  };
}

function snapshotVideoSource(asset: SkiaAsset): TexImageSource | null {
  if (
    asset.kind !== "video" ||
    typeof HTMLVideoElement === "undefined" ||
    !(asset.source instanceof HTMLVideoElement)
  ) return asset.source ?? null;

  const width = Math.max(1, Math.floor(asset.width));
  const height = Math.max(1, Math.floor(asset.height));
  // Use a DOM canvas here rather than OffscreenCanvas: CanvasKit 0.42's
  // MakeImageFromCanvasImageSource path reads the browser canvas backing store
  // and some builds do not expose the same internal fields for OffscreenCanvas.
  const snapshot = Object.assign(document.createElement("canvas"), { width, height });
  const context = snapshot.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!context) return asset.source ?? null;
  context.drawImage(asset.source, 0, 0, width, height);
  return snapshot;
}

export function drawAsset(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  command: Extract<PaintCommand, { op: "drawImage" | "drawVideo" }>,
  asset: SkiaAsset,
  alpha: number,
): boolean {
  // CanvasKit's browser helper is reliable for Image/Canvas/ImageBitmap but
  // older CanvasKit builds can throw while reading an HTMLVideoElement. The
  // host still owns video decoding; snapshot only the already-seeked current
  // frame into a canvas before handing pixels to Skia.
  const source = snapshotVideoSource(asset);
  const image: SkiaImage | null = asset.encoded && kit.MakeImageFromEncoded
    ? kit.MakeImageFromEncoded(asset.encoded)
    : source
      ? kit.MakeImageFromCanvasImageSource(source)
      : null;
  if (!image) return false;
  const rects = imageRectForCommand(command, asset);
  const imagePaint = createSkiaPaint(kit, "#ffffff", alpha, kit.PaintStyle.Fill);
  if (rects.clip) {
    canvas.save();
    canvas.clipRect(rects.clip, kit.ClipOp.Intersect, true);
  }
  const fastSample = command.op === "drawImage"
    && (command.imageRendering === "optimizeSpeed" || command.imageRendering === "crisp-edges" || command.imageRendering === "pixelated");
  canvas.drawImageRect(image, rects.source, rects.destination, imagePaint, fastSample);
  if (rects.clip) canvas.restore();
  imagePaint.delete();
  image.delete();
  return true;
}
