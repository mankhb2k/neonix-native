/**
 * Browser-safe PaintCommandBuffer → Canvas2D replay.
 * Works with CanvasRenderingContext2D and OffscreenCanvasRenderingContext2D.
 * No Node / napi-rs / DOM-lib dependency — callers pass a duck-typed context.
 */

import type { PaintCommand } from "./paint-command";
import type { PaintCommandBuffer } from "./paint-buffer";
import type {
  PaintBlendMode,
  PaintFill,
  PaintPatternContent,
  RenderImageAlign,
  RenderImagePreserveAspectRatio,
  RenderImageRendering,
} from "./paint-types";
import { flattenPathContourAny } from "../geometry/path/flatten";

export type ReplayGradient = {
  addColorStop(offset: number, color: string): void;
};

export type ReplayPattern = ReplayGradient & { setTransform?(transform: unknown): void };
export type ReplayFillStyle = string | ReplayGradient | ReplayPattern;

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
  clearRect(x: number, y: number, w: number, h: number): void;
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
  quadraticCurveTo(
    cpx: number,
    cpy: number,
    x: number,
    y: number,
  ): void;
  transform?(a: number, b: number, c: number, d: number, e: number, f: number): void;
  bezierCurveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ): void;
  closePath(): void;
  clip?(): void;
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
  createConicGradient?(
    startAngle: number,
    x: number,
    y: number,
  ): ReplayGradient;
  createPattern?(source: Replay2DImageSource, repetition: "repeat" | "repeat-x" | "repeat-y" | "no-repeat"): ReplayPattern | null;
  fillStyle: ReplayFillStyle;
  strokeStyle: ReplayFillStyle;
  font: string;
  textAlign: "left" | "right" | "center" | "start" | "end";
  textBaseline: string;
  globalAlpha: number;
  globalCompositeOperation: string;
  lineWidth: number;
  imageSmoothingEnabled?: boolean;
};

export type ReplayPaint2DOptions = {
  getImage?: (uri: string, assetId: string) => Replay2DImageSource | null;
};

function hexColor(color: string | undefined, fallback = "#ffffff"): string {
  if (!color) return fallback;
  return color.startsWith("#") ? color : fallback;
}

function paintPoint(
  x: number,
  y: number,
  transform: { a: number; b: number; c: number; d: number; e: number; f: number } | undefined,
): { x: number; y: number } {
  if (!transform) return { x, y };
  return {
    x: transform.a * x + transform.c * y + transform.e,
    y: transform.b * x + transform.d * y + transform.f,
  };
}

function gradientStopColor(color: string, opacity = 1): string {
  const hex = color.startsWith("#") ? color.slice(1) : color;
  if (/^[0-9a-f]{6}$/i.test(hex) || /^[0-9a-f]{8}$/i.test(hex)) {
    const alpha = (hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1) * opacity;
    return `rgba(${Number.parseInt(hex.slice(0, 2), 16)}, ${Number.parseInt(hex.slice(2, 4), 16)}, ${Number.parseInt(hex.slice(4, 6), 16)}, ${alpha})`;
  }
  return color;
}

function applyFill(
  ctx: Canvas2DReplayContext,
  fill: string | undefined,
  fillPaint: PaintFill | undefined,
  width: number,
  height: number,
): void {
  if (fillPaint?.type === "none") {
    ctx.fillStyle = "#00000000";
    return;
  }
  if (fillPaint?.type === "linear-gradient" && fillPaint.stops.length) {
    const units = fillPaint.gradientUnits ?? "objectBoundingBox";
    const angle = ((fillPaint.angle ?? 0) * Math.PI) / 180;
    const startX = fillPaint.x1 ?? (fillPaint.angle === undefined ? 0 : 0.5 - Math.cos(angle) * 0.5);
    const startY = fillPaint.y1 ?? (fillPaint.angle === undefined ? 0 : 0.5 - Math.sin(angle) * 0.5);
    const endX = fillPaint.x2 ?? (fillPaint.angle === undefined ? 1 : 0.5 + Math.cos(angle) * 0.5);
    const endY = fillPaint.y2 ?? (fillPaint.angle === undefined ? 0 : 0.5 + Math.sin(angle) * 0.5);
    const scaleX = units === "objectBoundingBox" ? width : 1;
    const scaleY = units === "objectBoundingBox" ? height : 1;
    const start = paintPoint(startX * scaleX, startY * scaleY, fillPaint.gradientTransform);
    const end = paintPoint(endX * scaleX, endY * scaleY, fillPaint.gradientTransform);
    const gradient = ctx.createLinearGradient(
      start.x,
      start.y,
      end.x,
      end.y,
    );
    for (const stop of fillPaint.stops) {
      gradient.addColorStop(stop.offset, gradientStopColor(stop.color, stop.stopOpacity ?? 1));
    }
    ctx.fillStyle = gradient;
    return;
  }
  if (fillPaint?.type === "radial-gradient" && fillPaint.stops.length) {
    const units = fillPaint.gradientUnits ?? "objectBoundingBox";
    const scaleX = units === "objectBoundingBox" ? width : 1;
    const scaleY = units === "objectBoundingBox" ? height : 1;
    const center = paintPoint((fillPaint.cx ?? 0.5) * scaleX, (fillPaint.cy ?? 0.5) * scaleY, fillPaint.gradientTransform);
    const focus = paintPoint((fillPaint.fx ?? fillPaint.cx ?? 0.5) * scaleX, (fillPaint.fy ?? fillPaint.cy ?? 0.5) * scaleY, fillPaint.gradientTransform);
    const r = (fillPaint.radius ?? 0.5) * Math.min(scaleX, scaleY);
    const fr = (fillPaint.fr ?? 0) * Math.min(scaleX, scaleY);
    const gradient = ctx.createRadialGradient(focus.x, focus.y, fr, center.x, center.y, r);
    for (const stop of fillPaint.stops) {
      gradient.addColorStop(stop.offset, gradientStopColor(stop.color, stop.stopOpacity ?? 1));
    }
    ctx.fillStyle = gradient;
    return;
  }
  if (fillPaint?.type === "conic-gradient" && fillPaint.stops.length) {
    if (!ctx.createConicGradient) {
      throw new Error("Canvas2D replay requires createConicGradient for conic-gradient paint");
    }
    const startAngle = ((fillPaint.from ?? 0) * Math.PI) / 180;
    const cx = (fillPaint.cx ?? 0.5) * width;
    const cy = (fillPaint.cy ?? 0.5) * height;
    const gradient = ctx.createConicGradient(startAngle, cx, cy);
    for (const stop of fillPaint.stops) {
      gradient.addColorStop(stop.offset, gradientStopColor(stop.color, stop.stopOpacity ?? 1));
    }
    ctx.fillStyle = gradient;
    return;
  }
  if (fillPaint?.type === "pattern") {
    const canvasFactory = globalThis as typeof globalThis & {
      OffscreenCanvas?: new (width: number, height: number) => {
        width: number;
        height: number;
        getContext(kind: "2d"): {
          clearRect(x: number, y: number, w: number, h: number): void;
          fillRect(x: number, y: number, w: number, h: number): void;
          arc(x: number, y: number, radius: number, start: number, end: number): void;
          beginPath(): void;
          fill(): void;
          fillStyle: string;
          globalAlpha: number;
        } | null;
      };
      document?: { createElement(name: "canvas"): {
        width: number;
        height: number;
        getContext(kind: "2d"): any;
      } };
    };
    const tileWidth = Math.max(1, Math.ceil(fillPaint.patternUnits === "objectBoundingBox" ? fillPaint.width * width : fillPaint.width));
    const tileHeight = Math.max(1, Math.ceil(fillPaint.patternUnits === "objectBoundingBox" ? fillPaint.height * height : fillPaint.height));
    const tile = canvasFactory.OffscreenCanvas
      ? new canvasFactory.OffscreenCanvas(tileWidth, tileHeight)
      : canvasFactory.document?.createElement("canvas");
    if (tile) {
      tile.width = tileWidth;
      tile.height = tileHeight;
      const tileContext = tile.getContext("2d") as Canvas2DReplayContext | null;
      if (tileContext) {
        tileContext.clearRect(0, 0, tileWidth, tileHeight);
        for (const content of fillPaint.content) {
          drawPatternNode(
            tileContext,
            content,
            tileWidth,
            tileHeight,
            fillPaint.patternContentUnits === "objectBoundingBox",
            1,
          );
        }
        const pattern = ctx.createPattern?.(tile, "repeat");
        if (pattern) {
          const patternTransform = fillPaint.patternTransform ?? fillPaint.transform;
          if (patternTransform && pattern.setTransform) pattern.setTransform(patternTransform);
          ctx.fillStyle = pattern;
          return;
        }
      }
    }
  }
  ctx.fillStyle = hexColor(
    fill ?? (fillPaint?.type === "solid" ? fillPaint.color : undefined),
  );
}

function drawPatternNode(
  ctx: Canvas2DReplayContext,
  node: PaintPatternContent,
  tileWidth: number,
  tileHeight: number,
  objectBoundingBox: boolean,
  inheritedOpacity: number,
): void {
  if (node.type === "group") {
    ctx.save();
    const transform = node.transform;
    if (transform && ctx.transform) {
      ctx.transform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f);
    }
    for (const child of node.children) {
      drawPatternNode(ctx, child, tileWidth, tileHeight, objectBoundingBox, inheritedOpacity * (node.opacity ?? 1));
    }
    ctx.restore();
    return;
  }

  const scaleX = objectBoundingBox ? tileWidth : 1;
  const scaleY = objectBoundingBox ? tileHeight : 1;
  const sx = (value: number) => value * scaleX;
  const sy = (value: number) => value * scaleY;
  const paint = node.fill;
  const paintColor = paint?.type === "solid" ? paint.color : undefined;

  ctx.save();
  ctx.globalAlpha = inheritedOpacity * (node.fillOpacity ?? 1) * (paint?.type === "solid" ? paint.opacity ?? 1 : 1);
  if (node.fill || paintColor) applyFill(ctx, paintColor, paint, tileWidth, tileHeight);
  ctx.beginPath();

  if (node.type === "rect") {
    const x = sx(node.x);
    const y = sy(node.y);
    const width = sx(node.width);
    const height = sy(node.height);
    const rx = sx(node.rx ?? 0);
    if (rx > 0 && ctx.roundRect) ctx.roundRect(x, y, width, height, Math.min(rx, width / 2, height / 2));
    else ctx.rect(x, y, width, height);
  } else if (node.type === "circle") {
    ctx.ellipse(sx(node.cx), sy(node.cy), sx(node.radius), sy(node.radius), 0, 0, Math.PI * 2);
  } else if (node.type === "ellipse") {
    ctx.ellipse(sx(node.cx), sy(node.cy), sx(node.rx), sy(node.ry), 0, 0, Math.PI * 2);
  } else if (node.type === "line") {
    ctx.moveTo(sx(node.x1), sy(node.y1));
    ctx.lineTo(sx(node.x2), sy(node.y2));
  } else if (node.type === "polyline" || node.type === "polygon") {
    ctx.moveTo(sx(node.points[0]!.x), sy(node.points[0]!.y));
    for (const point of node.points.slice(1)) ctx.lineTo(sx(point.x), sy(point.y));
    if (node.type === "polygon") ctx.closePath();
  } else if (node.type === "path") {
    strokePathContours(ctx, node.contours);
  }

  if (node.fill || paintColor) ctx.fill(node.type === "path" ? node.fillRule ?? "nonzero" : "nonzero");
  if (node.stroke) {
    const strokeColor = node.stroke.type === "solid" ? node.stroke.color : undefined;
    applyFill(ctx, strokeColor, node.stroke, tileWidth, tileHeight);
    ctx.globalAlpha = inheritedOpacity * (node.strokeOpacity ?? 1) * (node.stroke.type === "solid" ? node.stroke.opacity ?? 1 : 1);
    ctx.lineWidth = node.strokeWidth ?? 1;
    ctx.stroke();
  }
  ctx.restore();
}

function blendOp(
  mode: PaintBlendMode | undefined,
): string {
  if (!mode || mode === "normal") return "source-over";
  return mode;
}

function strokePathContours(
  ctx: Canvas2DReplayContext,
  contours: Extract<PaintCommand, { op: "drawPath" }>["contours"],
): void {
  ctx.beginPath();
  for (const contour of contours) {
    const hasArc = contour.segments.some((segment) => segment.kind === "arc");
    if (hasArc) {
      const flattened = flattenPathContourAny(contour);
      ctx.moveTo(flattened.points[0]!.x, flattened.points[0]!.y);
      for (const point of flattened.points.slice(1)) {
        ctx.lineTo(point.x, point.y);
      }
      if (contour.closed) ctx.closePath();
      continue;
    }
    ctx.moveTo(contour.start.x, contour.start.y);
    for (const segment of contour.segments) {
      if (segment.kind === "line") ctx.lineTo(segment.to.x, segment.to.y);
      else if (segment.kind === "quadratic") {
        ctx.quadraticCurveTo(segment.control.x, segment.control.y, segment.to.x, segment.to.y);
      } else if (segment.kind === "cubic") {
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

function drawFittedVideo(
  ctx: Canvas2DReplayContext,
  image: Replay2DImageSource,
  frameWidth: number,
  frameHeight: number,
  fit: "contain" | "cover" | "fill" | "none" | undefined,
): void {
  const size = imageSize(image);
  if (!size) {
    ctx.drawImage(image, 0, 0, frameWidth, frameHeight);
    return;
  }

  if (fit === "none") {
    ctx.drawImage(image, 0, 0, size.width, size.height);
    return;
  }
  if (fit === "fill" || !fit) {
    ctx.drawImage(image, 0, 0, frameWidth, frameHeight);
    return;
  }

  const scale = fit === "cover"
    ? Math.max(frameWidth / size.width, frameHeight / size.height)
    : Math.min(frameWidth / size.width, frameHeight / size.height);
  const drawWidth = size.width * scale;
  const drawHeight = size.height * scale;
  ctx.drawImage(
    image,
    (frameWidth - drawWidth) / 2,
    (frameHeight - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

function imageAlignFactors(align: RenderImageAlign): { x: number; y: number } {
  return {
    x: align.includes("xMin") ? 0 : align.includes("xMax") ? 1 : 0.5,
    y: align.includes("YMin") ? 0 : align.includes("YMax") ? 1 : 0.5,
  };
}

function drawSvgImage(
  ctx: Canvas2DReplayContext,
  image: Replay2DImageSource,
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number,
  preserveAspectRatio?: RenderImagePreserveAspectRatio,
  imageRendering?: RenderImageRendering,
): void {
  const smoothing = imageRendering !== "optimizeSpeed" && imageRendering !== "crisp-edges" && imageRendering !== "pixelated";
  if (ctx.imageSmoothingEnabled !== undefined) ctx.imageSmoothingEnabled = smoothing;
  const size = imageSize(image);
  if (!size) {
    ctx.drawImage(image, x, y, viewportWidth, viewportHeight);
    return;
  }

  const align = preserveAspectRatio?.align ?? "xMidYMid";
  if (align === "none") {
    ctx.drawImage(image, x, y, viewportWidth, viewportHeight);
    return;
  }

  const slice = preserveAspectRatio?.meetOrSlice === "slice";
  const scale = slice
    ? Math.max(viewportWidth / size.width, viewportHeight / size.height)
    : Math.min(viewportWidth / size.width, viewportHeight / size.height);
  const drawWidth = size.width * scale;
  const drawHeight = size.height * scale;
  const factors = imageAlignFactors(align);
  const drawX = x + (viewportWidth - drawWidth) * factors.x;
  const drawY = y + (viewportHeight - drawHeight) * factors.y;

  if (slice && ctx.clip) {
    ctx.beginPath();
    ctx.rect(x, y, viewportWidth, viewportHeight);
    ctx.clip();
  }

  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
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
      const paintOrder = cmd.op === "drawShape"
        ? cmd.paintOrder ?? ["fill", "stroke", "markers"]
        : ["fill"];
      for (const paint of paintOrder) {
        if (paint === "fill") {
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
        } else if (paint === "stroke" && cmd.op === "drawShape" && cmd.stroke) {
          ctx.globalAlpha = layerAlpha * (cmd.strokeOpacity ?? 1);
          if (cmd.strokePaint) {
            applyFill(ctx, cmd.stroke, cmd.strokePaint, cmd.width, cmd.height);
            ctx.strokeStyle = ctx.fillStyle;
          } else ctx.strokeStyle = cmd.stroke;
          ctx.lineWidth = cmd.strokeWidth ?? 1;
          ctx.stroke();
        }
      }
    } else if (cmd.op === "drawPath") {
      const pathWidth = cmd.width ?? cmd.mesh?.bounds.width ?? 200;
      const pathHeight = cmd.height ?? cmd.mesh?.bounds.height ?? 200;
      strokePathContours(ctx, cmd.contours);
      const paintOrder = cmd.paintOrder ?? ["fill", "stroke", "markers"];
      for (const paint of paintOrder) {
        if (paint === "fill" && (cmd.fill || cmd.fillPaint)) {
          applyFill(ctx, cmd.fill, cmd.fillPaint, pathWidth, pathHeight);
          ctx.globalAlpha = cmd.fillOpacity ?? 1;
          ctx.fill(cmd.fillRule);
        } else if (paint === "stroke" && cmd.stroke) {
          ctx.globalAlpha = cmd.strokeOpacity ?? 1;
          if (cmd.strokePaint) {
            applyFill(ctx, cmd.stroke, cmd.strokePaint, pathWidth, pathHeight);
            ctx.strokeStyle = ctx.fillStyle;
          } else ctx.strokeStyle = cmd.stroke;
          ctx.lineWidth = cmd.strokeWidth ?? 1;
          ctx.stroke();
        }
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
        if (cmd.op === "drawImage") {
          drawSvgImage(
            ctx,
            image,
            cmd.x,
            cmd.y,
            cmd.width,
            cmd.height,
            cmd.preserveAspectRatio,
            cmd.imageRendering,
          );
        } else {
          drawFittedVideo(ctx, image, cmd.width, cmd.height, cmd.fit);
        }
      } else {
        ctx.fillStyle = "#334155";
        ctx.fillRect(0, 0, cmd.width, cmd.height);
      }
    }

    ctx.restore();
  }
}
