/**
 * Browser-safe PaintCommandBuffer → Canvas2D replay.
 * Works with CanvasRenderingContext2D and OffscreenCanvasRenderingContext2D.
 * No Node / napi-rs / DOM-lib dependency — callers pass a duck-typed context.
 */

import type { PaintCommand } from "./paint-command";
import type { PaintCommandBuffer } from "./paint-buffer";
import type { PaintFill } from "./paint-types";

export type ReplayGradient = {
  addColorStop(offset: number, color: string): void;
};

export type ReplayFillStyle = string | ReplayGradient;

export type Replay2DImageSource = unknown;

function matrix4ToAffine2D(matrix4: readonly number[]): {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
} | undefined {
  if (matrix4.length !== 16 || matrix4.some((value) => !Number.isFinite(value))) {
    return undefined;
  }
  const isAffine2D =
    Math.abs(matrix4[2]!) < 1e-9 &&
    Math.abs(matrix4[3]!) < 1e-9 &&
    Math.abs(matrix4[6]!) < 1e-9 &&
    Math.abs(matrix4[7]!) < 1e-9 &&
    Math.abs(matrix4[8]!) < 1e-9 &&
    Math.abs(matrix4[9]!) < 1e-9 &&
    Math.abs(matrix4[10]! - 1) < 1e-9 &&
    Math.abs(matrix4[11]!) < 1e-9 &&
    Math.abs(matrix4[14]!) < 1e-9 &&
    Math.abs(matrix4[15]! - 1) < 1e-9;
  if (!isAffine2D) return undefined;
  return {
    a: matrix4[0]!,
    b: matrix4[1]!,
    c: matrix4[4]!,
    d: matrix4[5]!,
    e: matrix4[12]!,
    f: matrix4[13]!,
  };
}

export type Canvas2DReplayContext = {
  save(): void;
  restore(): void;
  setTransform(
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  rect(x: number, y: number, w: number, h: number): void;
  ellipse(
    x: number,
    y: number,
    rx: number,
    ry: number,
    rotation: number,
    start: number,
    end: number,
  ): void;
  roundRect?(
    x: number,
    y: number,
    w: number,
    h: number,
    radii: number,
  ): void;
  fill(fillRule?: "nonzero" | "evenodd"): void;
  stroke(): void;
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  bezierCurveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ): void;
  closePath(): void;
  drawImage(
    image: Replay2DImageSource,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
  drawImage(
    image: Replay2DImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
  createLinearGradient(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): ReplayGradient;
  createRadialGradient(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
  ): ReplayGradient;
  fillStyle: ReplayFillStyle;
  strokeStyle: ReplayFillStyle;
  font: string;
  textAlign: "left" | "right" | "center" | "start" | "end";
  textBaseline: string;
  globalAlpha: number;
  globalCompositeOperation: string;
  lineWidth: number;
};

export type ReplayPaint2DOptions = {
  getImage?: (uri: string, assetId: string) => Replay2DImageSource | null;
};

type MediaCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function hexColor(color: string | undefined, fallback = "#ffffff"): string {
  if (!color) return fallback;
  return color.startsWith("#") ? color : fallback;
}

function applyFill(
  ctx: Canvas2DReplayContext,
  fill: string | undefined,
  fillPaint: PaintFill | undefined,
  width: number,
  height: number,
): void {
  if (fillPaint?.type === "linear-gradient" && fillPaint.stops.length) {
    const angle = ((fillPaint.angle ?? 0) * Math.PI) / 180;
    const extent = Math.hypot(width, height) / 2;
    const dx = Math.cos(angle) * extent;
    const dy = Math.sin(angle) * extent;
    const gradient = ctx.createLinearGradient(
      width / 2 - dx,
      height / 2 - dy,
      width / 2 + dx,
      height / 2 + dy,
    );
    for (const stop of fillPaint.stops) {
      gradient.addColorStop(stop.offset, stop.color);
    }
    ctx.fillStyle = gradient;
    return;
  }
  if (fillPaint?.type === "radial-gradient" && fillPaint.stops.length) {
    const cx = (fillPaint.cx ?? 0.5) * width;
    const cy = (fillPaint.cy ?? 0.5) * height;
    const r = (fillPaint.radius ?? 0.5) * Math.min(width, height);
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    for (const stop of fillPaint.stops) {
      gradient.addColorStop(stop.offset, stop.color);
    }
    ctx.fillStyle = gradient;
    return;
  }
  ctx.fillStyle = hexColor(
    fill ?? (fillPaint?.type === "solid" ? fillPaint.color : undefined),
  );
}

function blendOp(
  mode:
    | "normal"
    | "multiply"
    | "screen"
    | "add"
    | "darken"
    | "lighten"
    | "overlay"
    | undefined,
): string {
  if (mode === "multiply") return "multiply";
  if (mode === "screen") return "screen";
  if (mode === "add") return "lighter";
  if (mode === "darken") return "darken";
  if (mode === "lighten") return "lighten";
  if (mode === "overlay") return "overlay";
  return "source-over";
}

function strokePathContours(
  ctx: Canvas2DReplayContext,
  contours: Extract<PaintCommand, { op: "drawPath" }>["contours"],
): void {
  ctx.beginPath();
  for (const contour of contours) {
    ctx.moveTo(contour.start.x, contour.start.y);
    for (const segment of contour.segments) {
      if (segment.kind === "line") ctx.lineTo(segment.to.x, segment.to.y);
      else {
        ctx.bezierCurveTo(
          segment.control1.x,
          segment.control1.y,
          segment.control2.x,
          segment.control2.y,
          segment.to.x,
          segment.to.y,
        );
      }
    }
    if (contour.closed) ctx.closePath();
  }
}

function imageSize(
  image: Replay2DImageSource,
): { width: number; height: number } | null {
  if (!image || typeof image !== "object") return null;
  const width = (image as { width?: unknown }).width;
  const height = (image as { height?: unknown }).height;
  if (typeof width !== "number" || typeof height !== "number") return null;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

function drawFittedMedia(
  ctx: Canvas2DReplayContext,
  image: Replay2DImageSource,
  frameWidth: number,
  frameHeight: number,
  fit: "contain" | "cover" | "fill" | "none" | undefined,
  crop?: MediaCrop,
): void {
  const size = imageSize(image);
  if (!size) {
    ctx.drawImage(image, 0, 0, frameWidth, frameHeight);
    return;
  }

  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = size.width;
  let sourceHeight = size.height;

  if (crop) {
    sourceX = crop.x * size.width;
    sourceY = crop.y * size.height;
    sourceWidth = crop.width * size.width;
    sourceHeight = crop.height * size.height;
  }

  if (fit === "none") {
    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      sourceWidth,
      sourceHeight,
    );
    return;
  }

  if (fit === "fill" || !fit) {
    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      frameWidth,
      frameHeight,
    );
    return;
  }

  const scale =
    fit === "cover"
      ? Math.max(frameWidth / sourceWidth, frameHeight / sourceHeight)
      : Math.min(frameWidth / sourceWidth, frameHeight / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const drawX = (frameWidth - drawWidth) / 2;
  const drawY = (frameHeight - drawHeight) / 2;

  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    drawX,
    drawY,
    drawWidth,
    drawHeight,
  );
}

/**
 * Replay a PaintCommandBuffer onto a 2D canvas context.
 * Camera view is already baked into command matrices by evaluateFrame.
 */
export function replayPaintCommands2D(
  ctx: Canvas2DReplayContext,
  buffer: PaintCommandBuffer,
  options?: ReplayPaint2DOptions,
): void {
  let pending: Extract<PaintCommand, { op: "setTransform" }> | null = null;

  for (const cmd of buffer.commands) {
    if (cmd.op === "beginFrame") {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = hexColor(cmd.background, "#000000");
      ctx.fillRect(0, 0, cmd.width, cmd.height);
      ctx.restore();
      continue;
    }
    if (
      cmd.op === "endFrame" ||
      cmd.op === "beginGroup" ||
      cmd.op === "endGroup" ||
      cmd.op === "beginLayer" ||
      cmd.op === "endLayer" ||
      cmd.op === "unsupported"
    ) {
      continue;
    }
    if (cmd.op === "setTransform") {
      pending = cmd;
      continue;
    }

    ctx.save();
    let layerAlpha = 1;
    if (pending && pending.key === cmd.key) {
      if (!pending.visible || pending.alpha <= 0) {
        ctx.restore();
        pending = null;
        continue;
      }
      const affine = matrix4ToAffine2D(pending.matrix4);
      if (!affine) {
        ctx.restore();
        pending = null;
        continue;
      }
      ctx.setTransform(affine.a, affine.b, affine.c, affine.d, affine.e, affine.f);
      layerAlpha = pending.alpha;
      ctx.globalAlpha = layerAlpha;
      ctx.globalCompositeOperation = blendOp(pending.blendMode);
      pending = null;
    }

    if (cmd.op === "drawText") {
      ctx.font = `${cmd.fontWeight ?? 400} ${cmd.fontSize}px sans-serif`;
      applyFill(ctx, cmd.fill, cmd.fillPaint, cmd.width, cmd.height);
      ctx.textAlign = cmd.align ?? "left";
      ctx.textBaseline = "top";
      ctx.fillText(cmd.text, 0, 0, Math.max(8, cmd.width));
    } else if (cmd.op === "drawShape" || cmd.op === "drawSolid") {
      ctx.beginPath();
      if (cmd.op === "drawShape" && cmd.shape === "ellipse") {
        ctx.ellipse(
          cmd.width / 2,
          cmd.height / 2,
          cmd.width / 2,
          cmd.height / 2,
          0,
          0,
          Math.PI * 2,
        );
      } else if (
        cmd.op === "drawShape" &&
        cmd.cornerRadius &&
        typeof ctx.roundRect === "function"
      ) {
        const r = Math.min(cmd.cornerRadius, cmd.width / 2, cmd.height / 2);
        ctx.roundRect(0, 0, cmd.width, cmd.height, r);
      } else {
        ctx.rect(0, 0, cmd.width, cmd.height);
      }
      applyFill(
        ctx,
        cmd.fill,
        cmd.op === "drawShape" ? cmd.fillPaint : undefined,
        cmd.width,
        cmd.height,
      );
      ctx.globalAlpha =
        layerAlpha * (cmd.op === "drawShape" ? cmd.fillOpacity ?? 1 : 1);
      ctx.fill();
      if (cmd.op === "drawShape" && cmd.stroke) {
        ctx.globalAlpha = layerAlpha * (cmd.strokeOpacity ?? 1);
        ctx.strokeStyle = cmd.stroke;
        ctx.lineWidth = cmd.strokeWidth ?? 1;
        ctx.stroke();
      }
    } else if (cmd.op === "drawPath") {
      strokePathContours(ctx, cmd.contours);
      if (cmd.fill || cmd.fillPaint) {
        applyFill(ctx, cmd.fill, cmd.fillPaint, 200, 200);
        ctx.globalAlpha = cmd.fillOpacity ?? 1;
        ctx.fill(cmd.fillRule);
      }
      if (cmd.stroke) {
        ctx.globalAlpha = cmd.strokeOpacity ?? 1;
        ctx.strokeStyle = cmd.stroke;
        ctx.lineWidth = cmd.strokeWidth ?? 1;
        ctx.stroke();
      }
    } else if (cmd.op === "drawImage" || cmd.op === "drawVideo") {
      if (cmd.op === "drawVideo" && cmd.mediaVisible === false) {
        ctx.restore();
        continue;
      }
      const uri = cmd.uri;
      const image =
        uri && options?.getImage ? options.getImage(uri, cmd.assetId) : null;
      if (image) {
        drawFittedMedia(
          ctx,
          image,
          cmd.width,
          cmd.height,
          cmd.fit,
          cmd.op === "drawImage" ? cmd.crop : undefined,
        );
      } else {
        ctx.fillStyle = "#334155";
        ctx.fillRect(0, 0, cmd.width, cmd.height);
      }
    }

    ctx.restore();
  }
}
