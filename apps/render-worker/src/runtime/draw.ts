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

  if (node.type === "image" || node.type === "svg") {
    const rawAssetId = evaluateProperty(scene, node, "payload.assetId", time, node.payload?.assetId);
    const asset = typeof rawAssetId === "string" ? assetById.get(rawAssetId) : undefined;
    if (asset) {
      const image = loadAssetImage(asset, assetBaseDir);
      ctx.drawImage(image, 0, 0, transform.width, transform.height);
    }
  } else if (node.type === "text") {
    const rawText = typeof node.payload?.text === "string" ? node.payload.text : brand.name;
    const counter = Number(evaluateProperty(scene, node, "payload.counterProgress", time, 1));
    const numeric = Number(rawText);
    const text = Number.isFinite(numeric) && counter < 1 ? Math.round(numeric * counter).toString() : rawText;
    const fontSize = typeof node.payload?.fontSize === "number" ? node.payload.fontSize : Math.max(24, transform.height * 0.45);
    ctx.fillStyle = typeof node.style?.fill === "string" ? node.style.fill : "#ffffff";
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
