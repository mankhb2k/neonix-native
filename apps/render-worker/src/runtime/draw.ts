import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, GlobalFonts, Image, type SKRSContext2D } from "@napi-rs/canvas";
import type { AspectRatio, NormalizedMotionProjectV2 } from "@motionvideo/motion-schema";
import { evaluateProperty, evaluateScene, type EvaluatedNode, type RuntimeScene } from "@motionvideo/motion-runtime";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const FONT_PATH = path.join(REPO_ROOT, "assets/fonts/BeVietnamPro-Regular.ttf");

type RuntimeAsset = NormalizedMotionProjectV2["assets"][number];
type Brand = NormalizedMotionProjectV2["metadata"]["brand"];
type RuntimeNode = NormalizedMotionProjectV2["scenes"][number]["nodes"][number];
type PaintNode = Extract<RuntimeNode, { type: "shape" | "path" }>;

let fontRegistered = false;
const imageCache = new Map<string, Image>();

export function ensureFont(): void {
  if (fontRegistered) return;
  try {
    GlobalFonts.registerFromPath(FONT_PATH, "Be Vietnam Pro");
    fontRegistered = true;
  } catch {
    // System sans-serif remains the deterministic fallback.
  }
}

export type AspectSize = { width: number; height: number };

export function sizeForAspect(aspect: AspectRatio, scale = 0.5): AspectSize {
  const base = aspect === "16:9"
    ? { width: 1920, height: 1080 }
    : aspect === "1:1"
      ? { width: 1080, height: 1080 }
      : { width: 1080, height: 1920 };
  return { width: Math.round(base.width * scale), height: Math.round(base.height * scale) };
}

function sourceSize(aspect: AspectRatio): AspectSize {
  return sizeForAspect(aspect, 1);
}

function wrapText(
  ctx: SKRSContext2D,
  text: string,
  centerX: number,
  centerY: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  const startY = centerY - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((textLine, index) => ctx.fillText(textLine, centerX, startY + index * lineHeight));
}

function resolveAssetPath(asset: RuntimeAsset, assetBaseDir: string): string {
  if (path.isAbsolute(asset.uri)) throw new Error(`Absolute asset URI is not allowed: ${asset.uri}`);
  const resolved = path.resolve(assetBaseDir, asset.uri);
  const relative = path.relative(assetBaseDir, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Asset escapes base directory: ${asset.uri}`);
  return resolved;
}

function loadAssetImage(asset: RuntimeAsset, assetBaseDir: string): Image {
  const file = resolveAssetPath(asset, assetBaseDir);
  const cached = imageCache.get(file);
  if (cached) return cached;
  const image = new Image();
  image.src = readFileSync(file);
  imageCache.set(file, image);
  return image;
}

function rectanglePath(ctx: SKRSContext2D, width: number, height: number, radius: number): void {
  const bounded = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.moveTo(bounded, 0);
  ctx.lineTo(width - bounded, 0);
  ctx.quadraticCurveTo(width, 0, width, bounded);
  ctx.lineTo(width, height - bounded);
  ctx.quadraticCurveTo(width, height, width - bounded, height);
  ctx.lineTo(bounded, height);
  ctx.quadraticCurveTo(0, height, 0, height - bounded);
  ctx.lineTo(0, bounded);
  ctx.quadraticCurveTo(0, 0, bounded, 0);
  ctx.closePath();
}

function buildGeometryPath(ctx: SKRSContext2D, node: PaintNode, scene: RuntimeScene, time: number, width: number, height: number): void {
  ctx.beginPath();
  if (node.type === "shape") {
    if (node.payload.shape === "rectangle") {
      const rawRadius = evaluateProperty(scene, node, "payload.cornerRadius", time, node.payload.cornerRadius ?? 0);
      rectanglePath(ctx, width, height, typeof rawRadius === "number" ? rawRadius : 0);
    } else if (node.payload.shape === "ellipse") {
      ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
    } else {
      const [first, ...rest] = node.payload.points;
      if (!first) return;
      ctx.moveTo(first.x, first.y);
      for (const point of rest) ctx.lineTo(point.x, point.y);
      ctx.closePath();
    }
    return;
  }
  for (const contour of node.payload.contours) {
    ctx.moveTo(contour.start.x, contour.start.y);
    for (const segment of contour.segments) {
      if (segment.kind === "line") ctx.lineTo(segment.to.x, segment.to.y);
      else ctx.bezierCurveTo(
        segment.control1.x,
        segment.control1.y,
        segment.control2.x,
        segment.control2.y,
        segment.to.x,
        segment.to.y,
      );
    }
    if (contour.closed) ctx.closePath();
  }
}

function drawPaintNode(ctx: SKRSContext2D, scene: RuntimeScene, node: PaintNode, time: number, width: number, height: number): void {
  buildGeometryPath(ctx, node, scene, time, width, height);
  const baseAlpha = ctx.globalAlpha;
  const fill = evaluateProperty(scene, node, "style.fill", time, node.style?.fill);
  if (typeof fill === "string") {
    const opacity = evaluateProperty(scene, node, "style.fillOpacity", time, node.style?.fillOpacity ?? 1);
    ctx.globalAlpha = baseAlpha * (typeof opacity === "number" ? opacity : 1);
    ctx.fillStyle = fill;
    ctx.fill(node.type === "path" ? node.payload.fillRule : "nonzero");
  }
  const stroke = evaluateProperty(scene, node, "style.stroke", time, node.style?.stroke);
  if (typeof stroke === "string") {
    const opacity = evaluateProperty(scene, node, "style.strokeOpacity", time, node.style?.strokeOpacity ?? 1);
    const strokeWidth = evaluateProperty(scene, node, "style.strokeWidth", time, node.style?.strokeWidth ?? 1);
    ctx.globalAlpha = baseAlpha * (typeof opacity === "number" ? opacity : 1);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = typeof strokeWidth === "number" ? strokeWidth : 1;
    ctx.lineCap = node.style?.lineCap ?? "butt";
    ctx.lineJoin = node.style?.lineJoin ?? "miter";
    ctx.miterLimit = node.style?.miterLimit ?? 10;
    ctx.stroke();
  }
  ctx.globalAlpha = baseAlpha;
}

function drawEvaluatedNode(
  ctx: SKRSContext2D,
  scene: RuntimeScene,
  evaluated: EvaluatedNode,
  brand: Brand,
  assetById: Map<string, RuntimeAsset>,
  assetBaseDir: string,
  time: number,
): void {
  if (!evaluated.visible || evaluated.worldOpacity <= 0.001) return;
  const { node, transform, worldMatrix } = evaluated;
  if (node.type === "group" || node.type === "bone" || node.type === "camera") return;

  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, evaluated.worldOpacity));
  ctx.transform(worldMatrix.a, worldMatrix.b, worldMatrix.c, worldMatrix.d, worldMatrix.e, worldMatrix.f);

  if (node.type === "shape" || node.type === "path") {
    drawPaintNode(ctx, scene, node, time, transform.width, transform.height);
  } else if (node.type === "image" || node.type === "svg") {
    const rawAssetId = evaluateProperty(scene, node, "payload.assetId", time, node.payload?.assetId);
    const asset = typeof rawAssetId === "string" ? assetById.get(rawAssetId) : undefined;
    if (asset) {
      const image = loadAssetImage(asset, assetBaseDir);
      ctx.drawImage(image, 0, 0, transform.width, transform.height);
    }
  } else if (node.type === "text") {
    const evaluatedText = evaluateProperty(scene, node, "payload.text", time, node.payload.text);
    const rawText = typeof evaluatedText === "string" ? evaluatedText : brand.name;
    const counter = Number(evaluateProperty(scene, node, "payload.counterProgress", time, 1));
    const numeric = Number(rawText);
    const text = Number.isFinite(numeric) && counter < 1 ? Math.round(numeric * counter).toString() : rawText;
    const evaluatedFontSize = evaluateProperty(scene, node, "payload.fontSize", time, node.payload.fontSize);
    const fontSize = typeof evaluatedFontSize === "number" ? evaluatedFontSize : Math.max(24, transform.height * 0.45);
    const evaluatedFill = evaluateProperty(scene, node, "style.fill", time, node.style?.fill ?? "#ffffff");
    ctx.fillStyle = typeof evaluatedFill === "string" ? evaluatedFill : "#ffffff";
    ctx.font = `600 ${Math.round(fontSize)}px "Be Vietnam Pro", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    wrapText(ctx, text, transform.width / 2, transform.height / 2, Math.max(1, transform.width), fontSize * 1.25);
  }
  ctx.restore();
}

export function drawSceneFrame(
  scene: RuntimeScene,
  metadata: NormalizedMotionProjectV2["metadata"],
  assets: RuntimeAsset[],
  localTime: number,
  width: number,
  height: number,
  assetBaseDir = REPO_ROOT,
): Buffer {
  ensureFont();
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = metadata.brand.primaryColor ?? "#1A5D3A";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0, height * 0.35, width, height * 0.3);

  const source = sourceSize(metadata.aspectRatio);
  ctx.save();
  ctx.scale(width / source.width, height / source.height);
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const evaluated = evaluateScene(scene, localTime)
    .map((item, index) => ({ item, index }))
    .sort((left, right) => ((left.item.node.zIndex ?? 0) - (right.item.node.zIndex ?? 0)) || left.index - right.index);
  for (const { item } of evaluated) drawEvaluatedNode(ctx, scene, item, metadata.brand, assetById, assetBaseDir, localTime);
  ctx.restore();
  return canvas.toBuffer("image/png");
}
