import { createCanvas, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AspectRatio, NormalizedMotionProjectV2 } from "@motionvideo/motion-schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const FONT_PATH = path.join(REPO_ROOT, "assets/fonts/BeVietnamPro-Regular.ttf");

type RuntimeScene = NormalizedMotionProjectV2["scenes"][number];
type RuntimeNode = RuntimeScene["nodes"][number];
type RuntimeTrack = RuntimeScene["tracks"][number];
type Brand = NormalizedMotionProjectV2["metadata"]["brand"];

let fontRegistered = false;

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

function ease(t: number, easing = "linear"): number {
  const x = Math.min(1, Math.max(0, t));
  switch (easing) {
    case "step": return x < 1 ? 0 : 1;
    case "easeIn": return x * x;
    case "easeInOut": return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
    case "spring": return Math.min(1.08, 1 - Math.cos(x * Math.PI * 2.5) * Math.exp(-5 * x));
    case "easeOut": return 1 - (1 - x) ** 3;
    default: return x;
  }
}

function trackValue(track: RuntimeTrack | undefined, time: number, fallback: unknown): unknown {
  if (!track || track.keys.length === 0) return fallback;
  const keys = track.keys;
  if (time <= keys[0]!.t) return keys[0]!.v;
  const last = keys[keys.length - 1]!;
  if (time >= last.t) return last.v;
  for (let index = 1; index < keys.length; index += 1) {
    const right = keys[index]!;
    const left = keys[index - 1]!;
    if (time > right.t) continue;
    if (typeof left.v !== "number" || typeof right.v !== "number") return left.v;
    const progress = ease((time - left.t) / Math.max(0.000001, right.t - left.t), right.easing);
    return left.v + (right.v - left.v) * progress;
  }
  return fallback;
}

function value(scene: RuntimeScene, node: RuntimeNode, property: string, time: number, fallback: unknown): unknown {
  return trackValue(scene.tracks.find((track) => track.targetId === node.id && track.property === property), time, fallback);
}

function wrapText(ctx: SKRSContext2D, text: string, maxWidth: number, lineHeight: number): void {
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
  const startY = -((lines.length - 1) * lineHeight) / 2;
  lines.forEach((textLine, index) => ctx.fillText(textLine, 0, startY + index * lineHeight));
}

function drawNode(
  ctx: SKRSContext2D,
  scene: RuntimeScene,
  node: RuntimeNode,
  brand: Brand,
  aspect: AspectRatio,
  time: number,
  width: number,
  height: number,
): void {
  if (!node.transform.visible) return;
  const source = sourceSize(aspect);
  const sx = width / source.width;
  const sy = height / source.height;
  const x = Number(value(scene, node, "transform.x", time, node.transform.x)) * sx;
  const y = Number(value(scene, node, "transform.y", time, node.transform.y)) * sy;
  const opacity = Number(value(scene, node, "transform.opacity", time, node.transform.opacity));
  const scaleX = Number(value(scene, node, "transform.scaleX", time, node.transform.scaleX));
  const scaleY = Number(value(scene, node, "transform.scaleY", time, node.transform.scaleY));
  if (opacity <= 0.001) return;

  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, opacity));
  ctx.translate(x, y);
  ctx.rotate((node.transform.rotation * Math.PI) / 180);
  ctx.scale(scaleX * (node.transform.flipX ? -1 : 1), scaleY * (node.transform.flipY ? -1 : 1));

  if (node.type === "logo") {
    const size = Math.min(width, height) * 0.12;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(-size / 2, -size / 2, size, size, size * 0.2);
    ctx.fill();
    ctx.fillStyle = brand.primaryColor ?? "#1A5D3A";
    ctx.font = `bold ${Math.round(size * 0.28)}px "Be Vietnam Pro", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(brand.name.slice(0, 2).toUpperCase(), 0, 0);
  } else if (node.type === "text") {
    const rawText = typeof node.payload?.text === "string" ? node.payload.text : brand.name;
    const counter = Number(value(scene, node, "payload.counterProgress", time, 1));
    const numeric = Number(rawText);
    const text = Number.isFinite(numeric) && counter < 1 ? Math.round(numeric * counter).toString() : rawText;
    const fontSizeRaw = typeof node.payload?.fontSize === "number" ? node.payload.fontSize * sy : Math.min(width, height) * 0.055;
    ctx.fillStyle = typeof node.style?.fill === "string" ? node.style.fill : "#ffffff";
    ctx.font = `600 ${Math.round(fontSizeRaw)}px "Be Vietnam Pro", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    wrapText(ctx, text, Math.max(1, node.transform.width * sx || width * 0.8), fontSizeRaw * 1.25);
  }
  ctx.restore();
}

export function drawSceneFrame(
  scene: RuntimeScene,
  metadata: NormalizedMotionProjectV2["metadata"],
  localTime: number,
  width: number,
  height: number,
): Buffer {
  ensureFont();
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = metadata.brand.primaryColor ?? "#1A5D3A";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0, height * 0.35, width, height * 0.3);
  for (const node of [...scene.nodes].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))) {
    drawNode(ctx, scene, node, metadata.brand, metadata.aspectRatio, localTime, width, height);
  }
  return canvas.toBuffer("image/png");
}
