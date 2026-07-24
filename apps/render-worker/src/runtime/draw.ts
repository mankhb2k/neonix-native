import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, GlobalFonts, Image, loadImage, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";
import type { AspectRatio, NormalizedMotionProjectV2 } from "@motionvideo/motion-schema";
import {
  evaluateNodeEffects,
  evaluateProperty,
  evaluateScene,
  pathMorphContours,
  planOffscreenSurface,
  type EvaluatedNode,
  type RuntimeEffect,
  type RuntimeScene,
} from "@motionvideo/motion-runtime";
import { projectFrameLayers } from "./frame-plan";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const FONT_PATH = path.join(REPO_ROOT, "assets/fonts/BeVietnamPro-Regular.ttf");
const require = createRequire(import.meta.url);

type RuntimeAsset = NormalizedMotionProjectV2["assets"][number];
type Brand = NormalizedMotionProjectV2["metadata"]["brand"];
type RuntimeNode = NormalizedMotionProjectV2["scenes"][number]["nodes"][number];
type PaintNode = Extract<RuntimeNode, { type: "shape" | "path" }>;

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
  for (const { node } of evaluateScene(scene, time)) {
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
  const morph = node.type === "path" ? node.modifiers?.find((modifier) => modifier.type === "path-morph") : undefined;
  const morphProgress = morph ? evaluateProperty(scene, node, `modifiers.${morph.id}.progress`, time, morph.progress) : 0;
  const contours = morph ? pathMorphContours(node, typeof morphProgress === "number" ? morphProgress : 0) : node.payload.contours;
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
  maskPass?: "alpha" | "clip",
): void {
  if (!evaluated.visible || evaluated.worldOpacity <= 0.001) return;
  const { node, transform, worldMatrix } = evaluated;
  if (node.type === "group" || node.type === "bone" || node.type === "camera") return;

  ctx.save();
  ctx.globalAlpha = maskPass === "clip" ? 1 : Math.min(1, Math.max(0, evaluated.worldOpacity));
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
    case "shadow": return Math.max(Math.abs(effect.offsetX), Math.abs(effect.offsetY)) + effect.blur;
    case "glow": return effect.radius;
    case "color-adjust": return 0;
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

function applyEffect(layer: Canvas, effect: RuntimeEffect): Canvas {
  const output = createCanvas(layer.width, layer.height);
  const outputContext = output.getContext("2d");
  if (effect.type === "blur") {
    outputContext.filter = `blur(${effect.radius}px)`;
    outputContext.drawImage(layer, 0, 0);
    outputContext.filter = "none";
  } else if (effect.type === "shadow") {
    outputContext.shadowColor = colorWithOpacity(effect.color, effect.opacity);
    outputContext.shadowBlur = effect.blur;
    outputContext.shadowOffsetX = effect.offsetX;
    outputContext.shadowOffsetY = effect.offsetY;
    outputContext.drawImage(layer, 0, 0);
    outputContext.shadowColor = "transparent";
    outputContext.shadowBlur = 0;
    outputContext.shadowOffsetX = 0;
    outputContext.shadowOffsetY = 0;
  } else if (effect.type === "glow") {
    outputContext.shadowColor = colorWithOpacity(effect.color, Math.min(1, effect.opacity * effect.intensity));
    outputContext.shadowBlur = effect.radius;
    outputContext.drawImage(layer, 0, 0);
    outputContext.shadowColor = "transparent";
    outputContext.shadowBlur = 0;
  } else {
    outputContext.filter = `brightness(${(1 + effect.brightness) * 100}%) contrast(${effect.contrast * 100}%) saturate(${effect.saturation * 100}%)`;
    outputContext.drawImage(layer, 0, 0);
    outputContext.filter = "none";
  }
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
  const x = evaluateProperty(scene, camera, "transform.x", time, camera.transform.x);
  const y = evaluateProperty(scene, camera, "transform.y", time, camera.transform.y);
  const rotation = evaluateProperty(scene, camera, "transform.rotation", time, camera.transform.rotation);
  const zoom = evaluateProperty(scene, camera, "payload.zoom", time, camera.payload.zoom);
  if (typeof x !== "number" || typeof y !== "number" || typeof rotation !== "number" || typeof zoom !== "number") return;
  ctx.translate(source.width / 2, source.height / 2);
  ctx.rotate((-rotation * Math.PI) / 180);
  ctx.scale(zoom, zoom);
  ctx.translate(-x, -y);
}

export async function drawSceneFrame(
  scene: RuntimeScene,
  metadata: NormalizedMotionProjectV2["metadata"],
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
  const evaluated = evaluateScene(scene, localTime)
    .map((item, index) => ({ item, index }))
    .sort((left, right) => ((left.item.node.zIndex ?? 0) - (right.item.node.zIndex ?? 0)) || left.index - right.index);
  const activeCamera = scene.activeCameraId
    ? scene.nodes.find((node): node is Extract<RuntimeNode, { type: "camera" }> => node.id === scene.activeCameraId && node.type === "camera")
    : undefined;
  const byId = new Map(evaluated.map(({ item }) => [item.node.id, item]));
  const visibleMaskSources = new Set(evaluated.filter(({ item }) => item.node.mask?.sourceVisibility === "content-and-mask").map(({ item }) => item.node.mask!.sourceNodeId));
  const hiddenMaskSources = new Set(evaluated.filter(({ item }) => item.node.mask?.sourceVisibility === "mask-only").map(({ item }) => item.node.mask!.sourceNodeId));
  const rasterize = (item: EvaluatedNode, stack = new Set<string>(), maskPass?: "alpha" | "clip") => {
    if (stack.has(item.node.id)) throw new Error(`Runtime mask cycle: ${item.node.id}`);
    const nextStack = new Set(stack).add(item.node.id);
    const layer = createCanvas(width, height);
    const layerContext = layer.getContext("2d");
    layerContext.scale(width / source.width, height / source.height);
    if (activeCamera) applyCameraView(layerContext, scene, activeCamera, localTime, source);
    drawEvaluatedNode(layerContext, scene, item, metadata.brand, assetById, assetBaseDir, localTime, maskPass);
    if (item.node.mask) {
      const maskSource = byId.get(item.node.mask.sourceNodeId);
      if (!maskSource) throw new Error(`Runtime mask source missing: ${item.node.mask.sourceNodeId}`);
      const maskLayer = rasterize(maskSource, nextStack, item.node.mask.mode === "clip" ? "clip" : "alpha");
      layerContext.setTransform(1, 0, 0, 1, 0, 0);
      layerContext.globalCompositeOperation = item.node.mask.mode === "inverse-alpha" ? "destination-out" : "destination-in";
      layerContext.drawImage(maskLayer, 0, 0);
      layerContext.globalCompositeOperation = "source-over";
    }
    if (maskPass) return layer;
    return applyEffects(layer, evaluateNodeEffects(scene, item.node, localTime), item.worldBounds);
  };
  ctx.save();
  ctx.scale(width / source.width, height / source.height);
  if (activeCamera) applyCameraView(ctx, scene, activeCamera, localTime, source);
  for (const { item } of evaluated) {
    if (hiddenMaskSources.has(item.node.id) && !visibleMaskSources.has(item.node.id)) continue;
    if (!item.node.mask && (item.node.effects?.length ?? 0) === 0) {
      drawEvaluatedNode(ctx, scene, item, metadata.brand, assetById, assetBaseDir, localTime);
      continue;
    }
    const layer = rasterize(item);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  }
  ctx.restore();
  return canvas.toBuffer("image/png");
}

/** Draws all scene layers at a project-global timestamp. Crossfades overlap
 * authored scene durations; each layer is independently rendered and blended. */
export async function drawProjectFrame(
  project: NormalizedMotionProjectV2,
  globalTime: number,
  width: number,
  height: number,
  assetBaseDir = REPO_ROOT,
): Promise<Buffer> {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  for (const layer of projectFrameLayers(project, globalTime)) {
    const scene = project.scenes[layer.sceneIndex];
    if (!scene || layer.opacity <= 0) continue;
    const image = await loadImage(await drawSceneFrame(scene, project.metadata, project.assets, layer.localTime, width, height, assetBaseDir));
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, layer.opacity));
    ctx.drawImage(image, 0, 0);
    ctx.restore();
  }
  return canvas.toBuffer("image/png");
}
