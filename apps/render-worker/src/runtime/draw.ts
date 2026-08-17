import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, GlobalFonts, Image, loadImage, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";
import type {
  AspectRatio,
  MotionPaintStyle,
} from "@motionvideo/motion-protocol";
import type {
  MotionRuntimeProject,
} from "@motionvideo/motion-protocol/runtime";
import {
  evaluateNodeEffects,
  evaluateProperty,
  evaluateScene,
  planOffscreenSurface,
  hierarchyRenderOrder,
  type EvaluatedNode,
  type RuntimeEffect,
  type RuntimeScene,
  layerGraphFromRuntime,
} from "@motionvideo/motion-runtime";
import { projectFrameLayers } from "./frame-plan";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const FONT_PATH = path.join(REPO_ROOT, "assets/fonts/BeVietnamPro-Regular.ttf");
const require = createRequire(import.meta.url);

type RuntimeAsset = MotionRuntimeProject["assets"][number];
type Brand = MotionRuntimeProject["metadata"]["brand"];
type RuntimeNode = Exclude<
  MotionRuntimeProject["layers"][number],
  { type: "audio" }
>;
type PaintNode = Extract<RuntimeNode, { type: "shape" | "path" }>;
type BlendMode = NonNullable<RuntimeNode["blendMode"]>;
type GradientFill = Exclude<MotionPaintStyle["fill"], string | undefined>;

let fontRegistered = false;
const imageCache = new Map<string, Image>();
const videoFrameCache = new Map<string, Image>();

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

function resolveFfmpegPath(): string {
  const fromEnv = process.env.FFMPEG_BIN;
  if (fromEnv) return fromEnv;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bin = require("ffmpeg-static") as string | null;
  return bin && existsSync(bin) ? bin : "ffmpeg";
}

function loadVideoFrame(asset: RuntimeAsset, assetBaseDir: string, time: number): Image {
  if (asset.assetType !== "video") throw new Error(`Expected video asset, got ${asset.assetType}`);
  const frameRate = asset.fps;
  const frameIndex = Math.max(0, Math.floor(time * frameRate + 1e-6));
  const cacheKey = `${resolveAssetPath(asset, assetBaseDir)}:${frameIndex}`;
  const cached = videoFrameCache.get(cacheKey);
  if (cached) return cached;

  const result = spawnSync(resolveFfmpegPath(), [
    "-v", "error",
    "-ss", (frameIndex / frameRate).toFixed(6),
    "-i", resolveAssetPath(asset, assetBaseDir),
    "-frames:v", "1",
    "-f", "image2pipe",
    "-vcodec", "png",
    "pipe:1",
  ], { encoding: null, maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0 || !result.stdout?.length) {
    throw new Error(`Could not decode video frame ${asset.uri} at ${frameIndex / frameRate}s: ${result.stderr?.toString().trim() ?? "unknown ffmpeg error"}`);
  }
  const image = new Image();
  image.src = result.stdout;
  videoFrameCache.set(cacheKey, image);
  return image;
}

function drawFittedImage(
  ctx: SKRSContext2D,
  image: Image,
  width: number,
  height: number,
  fit: "contain" | "cover" | "fill" | "none" | undefined,
): void {
  const sourceWidth = image.width;
  const sourceHeight = image.height;
  if (!sourceWidth || !sourceHeight) return;
  if (fit === "fill" || !fit) {
    ctx.drawImage(image, 0, 0, width, height);
    return;
  }
  if (fit === "none") {
    ctx.drawImage(image, 0, 0);
    return;
  }
  const scale = fit === "cover"
    ? Math.max(width / sourceWidth, height / sourceHeight)
    : Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function videoFrameTime(
  asset: Extract<RuntimeAsset, { assetType: "video" }>,
  payload: Extract<RuntimeNode, { type: "video" }>["payload"],
  localTime: number,
): number | undefined {
  const trimStart = payload.trimStart ?? 0;
  const trimEnd = payload.trimEnd ?? asset.duration;
  const duration = trimEnd - trimStart;
  if (duration <= 0) return undefined;
  const policy = payload.framePolicy ?? (payload.loop ? "loop" : "hold");
  if (localTime >= duration) {
    if (policy === "transparent") return undefined;
    if (policy === "loop") return trimStart + (localTime % duration);
    return Math.max(trimStart, trimEnd - 1 / asset.fps);
  }
  return trimStart + Math.max(0, localTime);
}

async function prepareFrameAssets(
  scene: RuntimeScene,
  assets: RuntimeAsset[],
  assetBaseDir: string,
  time: number,
): Promise<void> {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const pending: Promise<void>[] = [];
  for (const { layer: node } of evaluateScene(scene, time)) {
    if (node.type === "image" || node.type === "svg") {
      const asset = assetById.get(evaluateProperty(scene, node, "payload.assetId", time, node.payload.assetId) as string);
      if (asset) pending.push(loadAssetImage(asset, assetBaseDir).decode());
    } else if (node.type === "video") {
      const asset = assetById.get(evaluateProperty(scene, node, "payload.assetId", time, node.payload.assetId) as string);
      if (asset?.assetType === "video") {
        const mediaTime = videoFrameTime(asset, node.payload, time);
        if (mediaTime !== undefined) pending.push(loadVideoFrame(asset, assetBaseDir, mediaTime).decode());
      }
    }
  }
  await Promise.all(pending);
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

function compositeOperation(blendMode: BlendMode | undefined): SKRSContext2D["globalCompositeOperation"] {
  switch (blendMode) {
    case "multiply": return "multiply";
    case "screen": return "screen";
    case "add": return "lighter";
    default: return "source-over";
  }
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
  const contours = node.type === "path" ? node.payload.contours : [];
  for (const contour of contours) {
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

function drawPaintNode(ctx: SKRSContext2D, scene: RuntimeScene, node: PaintNode, time: number, width: number, height: number, clipMask = false): void {
  buildGeometryPath(ctx, node, scene, time, width, height);
  if (clipMask) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.fill(node.type === "path" ? node.payload.fillRule : "nonzero");
    return;
  }
  const baseAlpha = ctx.globalAlpha;
  const fill = evaluateProperty(scene, node, "style.fill", time, node.style?.fill);
  if (typeof fill === "string" || (fill && typeof fill === "object" && "type" in fill && "stops" in fill)) {
    const opacity = evaluateProperty(scene, node, "style.fillOpacity", time, node.style?.fillOpacity ?? 1);
    ctx.globalAlpha = baseAlpha * (typeof opacity === "number" ? opacity : 1);
    if (typeof fill === "string") {
      ctx.fillStyle = fill;
    } else {
      const gradientFill = fill as GradientFill;
      if (gradientFill.type === "linear-gradient") {
        const radians = ((gradientFill.angle ?? 0) * Math.PI) / 180;
        const centerX = width / 2;
        const centerY = height / 2;
        const extent = Math.hypot(width, height) / 2;
        const dx = Math.cos(radians) * extent;
        const dy = Math.sin(radians) * extent;
        const gradient = ctx.createLinearGradient(centerX - dx, centerY - dy, centerX + dx, centerY + dy);
        for (const stop of gradientFill.stops) gradient.addColorStop(stop.offset, stop.color);
        ctx.fillStyle = gradient;
      } else {
        const gradient = ctx.createRadialGradient(
          gradientFill.cx * width,
          gradientFill.cy * height,
          0,
          gradientFill.cx * width,
          gradientFill.cy * height,
          gradientFill.radius * Math.min(width, height),
        );
        for (const stop of gradientFill.stops) gradient.addColorStop(stop.offset, stop.color);
        ctx.fillStyle = gradient;
      }
    }
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
    const dash = evaluateProperty(scene, node, "style.dash", time, node.style?.dash ?? []);
    ctx.setLineDash(Array.isArray(dash) && dash.every((item) => typeof item === "number") ? dash : []);
    const dashOffset = evaluateProperty(scene, node, "style.dashOffset", time, node.style?.dashOffset ?? 0);
    ctx.lineDashOffset = typeof dashOffset === "number" ? dashOffset : 0;
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
  maskPass?: "alpha" | "clip",
): void {
  if (!evaluated.visible || evaluated.worldOpacity <= 0.001) return;
  const { layer: node, transform, worldMatrix } = evaluated;
  if (node.type === "group" || node.type === "bone" || node.type === "camera") return;

  ctx.save();
  ctx.globalAlpha = maskPass === "clip" ? 1 : Math.min(1, Math.max(0, evaluated.worldOpacity));
  ctx.globalCompositeOperation = compositeOperation(node.blendMode);
  ctx.transform(worldMatrix.a, worldMatrix.b, worldMatrix.c, worldMatrix.d, worldMatrix.e, worldMatrix.f);

  if (node.type === "shape" || node.type === "path") {
    drawPaintNode(ctx, scene, node, time, transform.width, transform.height, maskPass === "clip");
  } else if (node.type === "image" || node.type === "svg") {
    const rawAssetId = evaluateProperty(scene, node, "payload.assetId", time, node.payload?.assetId);
    const asset = typeof rawAssetId === "string" ? assetById.get(rawAssetId) : undefined;
    if (asset) {
      const image = loadAssetImage(asset, assetBaseDir);
      drawFittedImage(ctx, image, transform.width, transform.height, node.payload.fit);
    }
  } else if (node.type === "video") {
    const rawAssetId = evaluateProperty(scene, node, "payload.assetId", time, node.payload.assetId);
    const asset = typeof rawAssetId === "string" ? assetById.get(rawAssetId) : undefined;
    if (asset?.assetType === "video") {
      const mediaTime = videoFrameTime(asset, node.payload, time);
      if (mediaTime !== undefined) {
        drawFittedImage(ctx, loadVideoFrame(asset, assetBaseDir, mediaTime), transform.width, transform.height, node.payload.fit);
      }
    }
  } else if (node.type === "solid") {
    const color = evaluateProperty(scene, node, "payload.color", time, node.payload.color);
    const width = evaluateProperty(scene, node, "payload.width", time, node.payload.width ?? transform.width);
    const height = evaluateProperty(scene, node, "payload.height", time, node.payload.height ?? transform.height);
    ctx.fillStyle = typeof color === "string" ? color : "#ffffff";
    ctx.fillRect(0, 0, typeof width === "number" ? width : transform.width, typeof height === "number" ? height : transform.height);
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

function effectPadding(effect: RuntimeEffect): number {
  switch (effect.type) {
    case "blur": return effect.radius;
    case "shadow": return Math.max(Math.abs(effect.offset.x), Math.abs(effect.offset.y)) + effect.blur;
    case "glow": return effect.radius;
    case "inner-glow":
    case "noise":
    case "color-adjust":
      return 0;
    default:
      return 0;
  }
}

function colorWithOpacity(color: string, opacity: number): string {
  const bounded = Math.min(1, Math.max(0, opacity));
  const short = /^#([\da-f]{3})$/i.exec(color);
  if (short) {
    const [r, g, b] = [...short[1]!].map((channel) => Number.parseInt(`${channel}${channel}`, 16));
    return `rgba(${r},${g},${b},${bounded})`;
  }
  const hex = /^#([\da-f]{6})$/i.exec(color);
  if (hex) {
    const value = Number.parseInt(hex[1]!, 16);
    return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${bounded})`;
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(color);
  if (rgb) {
    const channels = rgb[1]!.split(",").map((channel) => channel.trim());
    if (channels.length >= 3) return `rgba(${channels[0]},${channels[1]},${channels[2]},${bounded})`;
  }
  return color;
}

function applyInnerGlow(layer: Canvas, effect: Extract<RuntimeEffect, { type: "inner-glow" }>): Canvas {
  const output = createCanvas(layer.width, layer.height);
  const out = output.getContext("2d");
  out.drawImage(layer, 0, 0);

  const inverted = createCanvas(layer.width, layer.height);
  const inv = inverted.getContext("2d");
  inv.fillStyle = "#ffffff";
  inv.fillRect(0, 0, layer.width, layer.height);
  inv.globalCompositeOperation = "destination-out";
  inv.drawImage(layer, 0, 0);

  const glow = createCanvas(layer.width, layer.height);
  const g = glow.getContext("2d");
  if (effect.radius > 0) g.filter = `blur(${effect.radius}px)`;
  g.drawImage(inverted, 0, 0);
  g.filter = "none";
  g.globalCompositeOperation = "destination-in";
  g.drawImage(layer, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = colorWithOpacity(effect.color, effect.opacity);
  g.fillRect(0, 0, layer.width, layer.height);

  out.drawImage(glow, 0, 0);
  return output;
}

function noiseHash(x: number, y: number, seed: number): number {
  let h = seed >>> 0;
  h = Math.imul(h ^ (x >>> 0), 0x9e3779b1);
  h = Math.imul(h ^ (y >>> 0), 0x85ebca6b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function applyNoise(layer: Canvas, effect: Extract<RuntimeEffect, { type: "noise" }>): Canvas {
  const output = createCanvas(layer.width, layer.height);
  const ctx = output.getContext("2d");
  ctx.drawImage(layer, 0, 0);
  const image = ctx.getImageData(0, 0, layer.width, layer.height);
  const data = image.data;
  const scale = Math.max(0.25, effect.scale);
  const strength = (effect.amount / 50) * effect.opacity;
  const seed = effect.seed ?? 0;
  for (let y = 0; y < layer.height; y += 1) {
    for (let x = 0; x < layer.width; x += 1) {
      const i = (y * layer.width + x) * 4;
      if (data[i + 3] === 0) continue;
      const grain = (noiseHash(Math.floor(x / scale), Math.floor(y / scale), seed) - 0.5) * strength * 255;
      data[i] = Math.min(255, Math.max(0, data[i]! + grain));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1]! + grain));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2]! + grain));
    }
  }
  ctx.putImageData(image, 0, 0);
  return output;
}

function applyEffect(layer: Canvas, effect: RuntimeEffect): Canvas {
  const output = createCanvas(layer.width, layer.height);
  const outputContext = output.getContext("2d");
  if (effect.type === "blur") {
    outputContext.filter = `blur(${effect.radius}px)`;
    outputContext.drawImage(layer, 0, 0);
    outputContext.filter = "none";
    return output;
  }
  if (effect.type === "shadow") {
    outputContext.shadowColor = colorWithOpacity(effect.color, effect.opacity);
    outputContext.shadowBlur = effect.blur;
    outputContext.shadowOffsetX = effect.offset.x;
    outputContext.shadowOffsetY = effect.offset.y;
    outputContext.drawImage(layer, 0, 0);
    outputContext.shadowColor = "transparent";
    outputContext.shadowBlur = 0;
    outputContext.shadowOffsetX = 0;
    outputContext.shadowOffsetY = 0;
    return output;
  }
  if (effect.type === "glow") {
    outputContext.shadowColor = colorWithOpacity(effect.color, effect.opacity);
    outputContext.shadowBlur = effect.radius;
    outputContext.drawImage(layer, 0, 0);
    outputContext.shadowColor = "transparent";
    outputContext.shadowBlur = 0;
    return output;
  }
  if (effect.type === "inner-glow") return applyInnerGlow(layer, effect);
  if (effect.type === "noise") return applyNoise(layer, effect);
  outputContext.filter = `brightness(${(1 + effect.brightness) * 100}%) contrast(${effect.contrast * 100}%) saturate(${effect.saturation * 100}%)`;
  outputContext.drawImage(layer, 0, 0);
  outputContext.filter = "none";
  return output;
}

function applyEffects(
  layer: Canvas,
  effects: RuntimeEffect[],
  bounds: EvaluatedNode["worldBounds"],
): Canvas {
  if (effects.length === 0) return layer;
  const padding = effects.reduce((max, effect) => Math.max(max, effectPadding(effect)), 0);
  // Validate the effect's expanded footprint before allocating/rendering an
  // offscreen surface. The reference renderer still uses a full-frame layer,
  // but this gate keeps the same resource policy as a cropped adapter.
  planOffscreenSurface(bounds, padding);
  return effects.reduce((current, effect) => applyEffect(current, effect), layer);
}

function applyCameraView(
  ctx: SKRSContext2D,
  scene: RuntimeScene,
  camera: Extract<RuntimeNode, { type: "camera" }>,
  time: number,
  source: AspectSize,
): void {
  const x = evaluateProperty(scene, camera, "transform.translate.x", time, camera.transform.x);
  const y = evaluateProperty(scene, camera, "transform.translate.y", time, camera.transform.y);
  const rotation = evaluateProperty(scene, camera, "transform.rotate.z", time, camera.transform.rotation);
  const zoom = evaluateProperty(scene, camera, "payload.zoom", time, camera.payload.zoom);
  if (typeof x !== "number" || typeof y !== "number" || typeof rotation !== "number" || typeof zoom !== "number") return;
  ctx.translate(source.width / 2, source.height / 2);
  ctx.rotate((-rotation * Math.PI) / 180);
  ctx.scale(zoom, zoom);
  ctx.translate(-x, -y);
}

export async function drawSceneFrame(
  scene: RuntimeScene,
  metadata: MotionRuntimeProject["metadata"],
  assets: RuntimeAsset[],
  localTime: number,
  width: number,
  height: number,
  assetBaseDir = REPO_ROOT,
): Promise<Buffer> {
  await prepareFrameAssets(scene, assets, assetBaseDir, localTime);
  ensureFont();
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = metadata.brand.primaryColor ?? "#1A5D3A";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0, height * 0.35, width, height * 0.3);

  const source = sourceSize(metadata.aspectRatio);
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const evaluated = hierarchyRenderOrder(evaluateScene(scene, localTime))
    .map((item, index) => ({ item, index }));
  const activeCamera = scene.activeCameraLayerId
    ? scene.layers.find((node): node is Extract<RuntimeNode, { type: "camera" }> => node.id === scene.activeCameraLayerId && node.type === "camera")
    : undefined;
  const byId = new Map(evaluated.map(({ item }) => [item.layer.id, item]));
  const visibleMaskSources = new Set(evaluated.filter(({ item }) => item.layer.compositing?.mask?.["source-visibility"] === "content-and-mask").map(({ item }) => item.layer.compositing!.mask!.sourceLayerId));
  const hiddenMaskSources = new Set(evaluated.filter(({ item }) => item.layer.compositing?.mask?.["source-visibility"] === "mask-only").map(({ item }) => item.layer.compositing!.mask!.sourceLayerId));
  const rasterize = (item: EvaluatedNode, stack = new Set<string>(), maskPass?: "alpha" | "clip") => {
    if (stack.has(item.layer.id)) throw new Error(`Runtime mask cycle: ${item.layer.id}`);
    const nextStack = new Set(stack).add(item.layer.id);
    const layer = createCanvas(width, height);
    const layerContext = layer.getContext("2d");
    layerContext.scale(width / source.width, height / source.height);
    if (activeCamera) applyCameraView(layerContext, scene, activeCamera, localTime, source);
    drawEvaluatedNode(layerContext, scene, item, metadata.brand, assetById, assetBaseDir, localTime, maskPass);
    if (item.layer.compositing?.mask) {
      const maskSource = byId.get(item.layer.compositing.mask.sourceLayerId);
      if (!maskSource) throw new Error(`Runtime mask source missing: ${item.layer.compositing.mask.sourceLayerId}`);
      const maskMode = item.layer.compositing.mask.mode;
      const maskLayer = rasterize(maskSource, nextStack, maskMode === "clip" ? "clip" : "alpha");
      if (maskMode === "luma" || maskMode === "inverse-luma") {
        const maskCtx = maskLayer.getContext("2d");
        const imageData = maskCtx.getImageData(0, 0, width, height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]!;
          const g = data[i + 1]!;
          const b = data[i + 2]!;
          const a = data[i + 3]! / 255;
          let luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          if (maskMode === "inverse-luma") luma = 255 - luma;
          data[i + 3] = Math.round(luma * a);
        }
        maskCtx.putImageData(imageData, 0, 0);
      }
      layerContext.setTransform(1, 0, 0, 1, 0, 0);
      layerContext.globalCompositeOperation = maskMode === "inverse-alpha" ? "destination-out" : "destination-in";
      layerContext.drawImage(maskLayer, 0, 0);
      layerContext.globalCompositeOperation = "source-over";
    }
    if (maskPass) return layer;
    return applyEffects(layer, evaluateNodeEffects(scene, item.layer, localTime), item.worldBounds);
  };
  ctx.save();
  ctx.scale(width / source.width, height / source.height);
  if (activeCamera) applyCameraView(ctx, scene, activeCamera, localTime, source);
  for (const { item } of evaluated) {
    if (hiddenMaskSources.has(item.layer.id) && !visibleMaskSources.has(item.layer.id)) continue;
    if (!item.layer.compositing?.mask && (item.layer.effects?.length ?? 0) === 0) {
      drawEvaluatedNode(ctx, scene, item, metadata.brand, assetById, assetBaseDir, localTime);
      continue;
    }
    const layer = rasterize(item);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = compositeOperation(item.layer.blendMode);
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  }
  ctx.restore();
  return canvas.toBuffer("image/png");
}

/** Draws all scene layers at a project-global timestamp. Crossfades overlap
 * authored scene durations; each layer is independently rendered and blended. */
export async function drawProjectFrame(
  project: MotionRuntimeProject,
  globalTime: number,
  width: number,
  height: number,
  assetBaseDir = REPO_ROOT,
): Promise<Buffer> {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  for (const layer of projectFrameLayers(project, globalTime)) {
    const scene = layerGraphFromRuntime(project);
    if (layer.opacity <= 0) continue;
    const image = await loadImage(await drawSceneFrame(scene, project.metadata, project.assets, layer.localTime, width, height, assetBaseDir));
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, layer.opacity));
    ctx.drawImage(image, 0, 0);
    ctx.restore();
  }
  return canvas.toBuffer("image/png");
}
