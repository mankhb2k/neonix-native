/**
 * Canvas consumer of shared PaintCommandBuffer (parity with Pixi paint path).
 * Used when MOTIONVIDEO_PAINT_PATH=1 — legacy draw.ts remains the default until goldens match.
 */

import path from "node:path";
import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import {
  evaluateFrame,
  layerGraphFromRuntime,
  type PaintCommand,
  type PaintCommandBuffer,
  type PaintFill,
} from "@motionvideo/motion-runtime";
import type {
  MotionRuntimeProject,
} from "@motionvideo/motion-protocol/runtime";
import { projectFrameLayers } from "./frame-plan";
import { ensureFont } from "./draw";

type RuntimeAsset = MotionRuntimeProject["assets"][number];

function hexColor(color: string | undefined, fallback = "#ffffff"): string {
  if (!color) return fallback;
  return color.startsWith("#") ? color : fallback;
}

function applyFill(
  ctx: SKRSContext2D,
  fill: string | undefined,
  fillPaint: PaintFill | undefined,
  width: number,
  height: number,
  alpha = 1,
): void {
  ctx.globalAlpha = Math.min(1, Math.max(0, alpha));
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
  ctx.fillStyle = hexColor(fill ?? (fillPaint?.type === "solid" ? fillPaint.color : undefined));
}

function applyMatrix(
  ctx: SKRSContext2D,
  matrix: { a: number; b: number; c: number; d: number; e: number; f: number },
): void {
  ctx.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
}

function blendOp(
  mode: "normal" | "multiply" | "screen" | "add" | undefined,
): GlobalCompositeOperation {
  if (mode === "multiply") return "multiply";
  if (mode === "screen") return "screen";
  if (mode === "add") return "lighter";
  return "source-over";
}

function strokePathContours(
  ctx: SKRSContext2D,
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

function resolveAssetUri(
  assetId: string,
  assets: RuntimeAsset[],
  assetBaseDir: string,
): string | undefined {
  const asset = assets.find((item) => item.id === assetId);
  if (!asset?.uri) return undefined;
  if (path.isAbsolute(asset.uri)) return undefined;
  return path.resolve(assetBaseDir, asset.uri);
}

/**
 * Replay a PaintCommandBuffer onto a 2D canvas context.
 * Camera view is already baked into command matrices by evaluateFrame.
 */
export function paintCommandsToContext(
  ctx: SKRSContext2D,
  buffer: PaintCommandBuffer,
  options?: {
    loadImageSync?: (uri: string) => ReturnType<typeof loadImage> | null;
  },
): void {
  let pending: Extract<PaintCommand, { op: "setTransform" }> | null = null;

  for (const cmd of buffer.commands) {
    if (cmd.op === "beginFrame") {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = hexColor(cmd.background, "#000000");
      ctx.fillRect(0, 0, cmd.width, cmd.height);
      ctx.restore();
      continue;
    }
    if (cmd.op === "endFrame" || cmd.op === "beginGroup" || cmd.op === "endGroup" || cmd.op === "beginLayer" || cmd.op === "endLayer") {
      continue;
    }
    if (cmd.op === "setTransform") {
      pending = cmd;
      continue;
    }
    if (cmd.op === "unsupported") continue;

    ctx.save();
    if (pending && pending.key === cmd.key) {
      applyMatrix(ctx, pending.matrix);
      ctx.globalAlpha = pending.alpha;
      ctx.globalCompositeOperation = blendOp(pending.blendMode);
      pending = null;
    }

    if (cmd.op === "drawText") {
      ctx.font = `${cmd.fontWeight ?? 400} ${cmd.fontSize}px "Be Vietnam Pro", sans-serif`;
      applyFill(ctx, cmd.fill, cmd.fillPaint, cmd.width, cmd.height, 1);
      ctx.textAlign = cmd.align ?? "left";
      ctx.textBaseline = "top";
      ctx.fillText(cmd.text, 0, 0, Math.max(8, cmd.width));
    } else if (cmd.op === "drawShape" || cmd.op === "drawSolid") {
      ctx.beginPath();
      if (cmd.op === "drawShape" && cmd.shape === "ellipse") {
        ctx.ellipse(cmd.width / 2, cmd.height / 2, cmd.width / 2, cmd.height / 2, 0, 0, Math.PI * 2);
      } else if (cmd.op === "drawShape" && cmd.cornerRadius) {
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
      ctx.fill();
    } else if (cmd.op === "drawPath") {
      strokePathContours(ctx, cmd.contours);
      if (cmd.fill || cmd.fillPaint) {
        applyFill(ctx, cmd.fill, cmd.fillPaint, 200, 200, cmd.fillOpacity ?? 1);
        ctx.fill(cmd.fillRule);
      }
      if (cmd.stroke) {
        ctx.globalAlpha = cmd.strokeOpacity ?? 1;
        ctx.strokeStyle = cmd.stroke;
        ctx.lineWidth = cmd.strokeWidth ?? 1;
        ctx.stroke();
      }
    } else if (cmd.op === "drawImage" || cmd.op === "drawVideo") {
      const uri = cmd.uri;
      if (uri && options?.loadImageSync) {
        const image = options.loadImageSync(uri);
        if (image) {
          // sync decode path unused — images filled async below
          void image;
        }
      }
      // Placeholder rect when image not decoded yet (async fill in drawSceneFramePaint)
      ctx.fillStyle = "#334155";
      ctx.fillRect(0, 0, cmd.width, cmd.height);
    }

    ctx.restore();
  }
}

async function paintCommandsToContextAsync(
  ctx: SKRSContext2D,
  buffer: PaintCommandBuffer,
  assets: RuntimeAsset[],
  assetBaseDir: string,
): Promise<void> {
  let pending: Extract<PaintCommand, { op: "setTransform" }> | null = null;
  const imageCache = new Map<string, Awaited<ReturnType<typeof loadImage>>>();

  for (const cmd of buffer.commands) {
    if (cmd.op === "beginFrame") {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = hexColor(cmd.background, "#000000");
      ctx.fillRect(0, 0, cmd.width, cmd.height);
      ctx.restore();
      continue;
    }
    if (cmd.op === "endFrame" || cmd.op === "beginGroup" || cmd.op === "endGroup" || cmd.op === "beginLayer" || cmd.op === "endLayer") continue;
    if (cmd.op === "setTransform") {
      pending = cmd;
      continue;
    }
    if (cmd.op === "unsupported") continue;

    ctx.save();
    if (pending && pending.key === cmd.key) {
      applyMatrix(ctx, pending.matrix);
      ctx.globalAlpha = pending.alpha;
      ctx.globalCompositeOperation = blendOp(pending.blendMode);
      pending = null;
    }

    if (cmd.op === "drawText") {
      ctx.font = `${cmd.fontWeight ?? 400} ${cmd.fontSize}px "Be Vietnam Pro", sans-serif`;
      applyFill(ctx, cmd.fill, cmd.fillPaint, cmd.width, cmd.height);
      ctx.textAlign = cmd.align ?? "left";
      ctx.textBaseline = "top";
      ctx.fillText(cmd.text, 0, 0, Math.max(8, cmd.width));
    } else if (cmd.op === "drawShape" || cmd.op === "drawSolid") {
      ctx.beginPath();
      if (cmd.op === "drawShape" && cmd.shape === "ellipse") {
        ctx.ellipse(cmd.width / 2, cmd.height / 2, cmd.width / 2, cmd.height / 2, 0, 0, Math.PI * 2);
      } else if (cmd.op === "drawShape" && cmd.cornerRadius) {
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
      ctx.fill();
    } else if (cmd.op === "drawPath") {
      strokePathContours(ctx, cmd.contours);
      if (cmd.fill || cmd.fillPaint) {
        applyFill(ctx, cmd.fill, cmd.fillPaint, 200, 200, cmd.fillOpacity ?? 1);
        ctx.fill(cmd.fillRule);
      }
      if (cmd.stroke) {
        ctx.globalAlpha = cmd.strokeOpacity ?? 1;
        ctx.strokeStyle = cmd.stroke;
        ctx.lineWidth = cmd.strokeWidth ?? 1;
        ctx.stroke();
      }
    } else if (cmd.op === "drawImage" || cmd.op === "drawVideo") {
      const uri =
        cmd.uri ??
        resolveAssetUri(cmd.assetId, assets, assetBaseDir);
      if (uri) {
        try {
          let image = imageCache.get(uri);
          if (!image) {
            image = await loadImage(uri);
            imageCache.set(uri, image);
          }
          ctx.drawImage(image, 0, 0, cmd.width, cmd.height);
        } catch {
          ctx.fillStyle = "#334155";
          ctx.fillRect(0, 0, cmd.width, cmd.height);
        }
      } else {
        ctx.fillStyle = "#334155";
        ctx.fillRect(0, 0, cmd.width, cmd.height);
      }
    }

    ctx.restore();
  }
}

export async function drawSceneFramePaint(
  scene: Parameters<typeof evaluateFrame>[0]["scene"],
  metadata: MotionRuntimeProject["metadata"],
  assets: RuntimeAsset[],
  localTime: number,
  width: number,
  height: number,
  assetBaseDir: string,
): Promise<Buffer> {
  ensureFont();
  const assetUriById: Record<string, string> = {};
  for (const asset of assets) {
    const uri = resolveAssetUri(asset.id, assets, assetBaseDir);
    if (uri) assetUriById[asset.id] = uri;
  }
  const fps = metadata.fps ?? 24;
  const frame = Math.round(localTime * fps);
  const evaluated = evaluateFrame({
    scene,
    frame,
    time: localTime,
    width,
    height,
    background: metadata.brand.primaryColor ?? "#000000",
    assetUriById,
  });
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  await paintCommandsToContextAsync(ctx, evaluated.paint, assets, assetBaseDir);
  return canvas.toBuffer("image/png");
}

/** Project-global timestamp via shared paint semantics (multi-scene layers). */
export async function drawProjectFramePaint(
  project: MotionRuntimeProject,
  globalTime: number,
  width: number,
  height: number,
  assetBaseDir: string,
): Promise<Buffer> {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  for (const layer of projectFrameLayers(project, globalTime)) {
    const scene = layerGraphFromRuntime(project);
    if (layer.opacity <= 0) continue;
    const png = await drawSceneFramePaint(
      scene,
      project.metadata,
      project.assets,
      layer.localTime,
      width,
      height,
      assetBaseDir,
    );
    const image = await loadImage(png);
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, layer.opacity));
    ctx.drawImage(image, 0, 0);
    ctx.restore();
  }
  return canvas.toBuffer("image/png");
}
