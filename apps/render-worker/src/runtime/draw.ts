import { createCanvas, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { MotionProject } from "@motionvideo/motion-schema";
import type { CompiledLayer, CompiledScene } from "../compiler";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const FONT_PATH = path.join(REPO_ROOT, "assets/fonts/BeVietnamPro-Regular.ttf");

let fontRegistered = false;

/** Each worker thread has its own canvas/font runtime — call once per thread. */
export function ensureFont() {
  if (fontRegistered) return;
  try {
    GlobalFonts.registerFromPath(FONT_PATH, "Be Vietnam Pro");
    fontRegistered = true;
  } catch {
    // Fall back to system sans-serif if vendor font missing
  }
}

export type AspectSize = { width: number; height: number };

export function sizeForAspect(
  aspect: MotionProject["aspectRatio"],
  scale = 0.5,
): AspectSize {
  const base =
    aspect === "16:9"
      ? { width: 1920, height: 1080 }
      : aspect === "1:1"
        ? { width: 1080, height: 1080 }
        : { width: 1080, height: 1920 };
  return {
    width: Math.round(base.width * scale),
    height: Math.round(base.height * scale),
  };
}

function ease(t: number, easing: string): number {
  const x = Math.min(1, Math.max(0, t));
  switch (easing) {
    case "linear":
      return x;
    case "easeIn":
      return x * x;
    case "easeInOut":
      return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
    case "spring":
    case "easeOut":
    default:
      return 1 - (1 - x) ** 3;
  }
}

type Transform = { opacity: number; tx: number; ty: number; scale: number };

function animTransform(preset: string, progress: number, eased: number): Transform {
  if (progress < 0) return { opacity: 0, tx: 0, ty: 0, scale: 1 };
  if (progress >= 1) return { opacity: 1, tx: 0, ty: 0, scale: 1 };

  const e = eased;
  switch (preset) {
    case "fade-in":
    case "fade":
      return { opacity: e, tx: 0, ty: 0, scale: 1 };
    case "fade-up":
      return { opacity: e, tx: 0, ty: (1 - e) * 48, scale: 1 };
    case "fade-down":
      return { opacity: e, tx: 0, ty: (e - 1) * 48, scale: 1 };
    case "fade-left":
      return { opacity: e, tx: (1 - e) * 48, ty: 0, scale: 1 };
    case "fade-right":
      return { opacity: e, tx: (e - 1) * 48, ty: 0, scale: 1 };
    case "slide-up":
      return { opacity: e, tx: 0, ty: (1 - e) * 120, scale: 1 };
    case "slide-left":
      return { opacity: e, tx: (1 - e) * 120, ty: 0, scale: 1 };
    case "slide-right":
      return { opacity: e, tx: (e - 1) * 120, ty: 0, scale: 1 };
    case "scale-in":
    case "zoom-in":
      return { opacity: e, tx: 0, ty: 0, scale: 0.6 + 0.4 * e };
    case "pop": {
      const overshoot = e < 1 ? Math.sin(e * Math.PI) * 0.12 : 0;
      return { opacity: Math.min(1, e * 1.2), tx: 0, ty: 0, scale: 0.7 + 0.3 * e + overshoot };
    }
    case "bounce-in": {
      const bounce = Math.abs(Math.sin(e * Math.PI * 2)) * (1 - e) * 0.15;
      return { opacity: e, tx: 0, ty: (1 - e) * 80, scale: 0.85 + bounce };
    }
    default:
      return { opacity: e, tx: 0, ty: 0, scale: 1 };
  }
}

function layerTransform(layer: CompiledLayer, localTime: number): Transform {
  const anim = layer.animations[0];
  if (!anim) return { opacity: 1, tx: 0, ty: 0, scale: 1 };
  const start = anim.start + anim.delay;
  const progress = (localTime - start) / anim.duration;
  const eased = ease(progress, anim.easing);
  return animTransform(anim.preset, progress, eased);
}

function wrapText(
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
}

function drawLayer(
  ctx: SKRSContext2D,
  layer: CompiledLayer,
  brand: MotionProject["brand"],
  localTime: number,
  width: number,
  height: number,
) {
  const t = layerTransform(layer, localTime);
  if (t.opacity <= 0.01) return;

  const cx = width / 2 + layer.x + t.tx;
  const cy = height / 2 + layer.y + t.ty;

  ctx.save();
  ctx.globalAlpha = t.opacity;
  ctx.translate(cx, cy);
  ctx.scale(t.scale, t.scale);

  if (layer.type === "logo") {
    const size = Math.min(width, height) * 0.12;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(-size / 2, -size / 2, size, size, size * 0.2);
    ctx.fill();
    ctx.fillStyle = brand.primaryColor ?? "#1A5D3A";
    ctx.font = `bold ${Math.round(size * 0.28)}px "Be Vietnam Pro", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((brand.name || "MV").slice(0, 2).toUpperCase(), 0, 0);
  } else {
    const fontSize = Math.round(Math.min(width, height) * 0.055);
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 ${fontSize}px "Be Vietnam Pro", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const text = layer.content || brand.name || "";
    wrapText(ctx, text, 0, 0, width * 0.8, fontSize * 1.25);
  }

  ctx.restore();
}

/** Rasterize one scene at one point in local time → PNG buffer. */
export function drawSceneFrame(
  scene: CompiledScene,
  brand: MotionProject["brand"],
  localTime: number,
  width: number,
  height: number,
): Buffer {
  ensureFont();
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = brand.primaryColor ?? "#1A5D3A";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0, height * 0.35, width, height * 0.3);

  for (const layer of scene.layers) {
    drawLayer(ctx, layer, brand, localTime, width, height);
  }

  return canvas.toBuffer("image/png");
}
