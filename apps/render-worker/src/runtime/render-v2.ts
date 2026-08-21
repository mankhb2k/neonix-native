import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import {
  evaluateRuntimeProjectV2,
  type PaintCommand,
  type RuntimeFrameV2,
  type RuntimeProjectV2,
} from "@motionvideo/motion-runtime";
import type { AspectRatio } from "../aspect";
import type { RenderResult } from "./index";

type Point = { x: number; y: number };

function projectPoint(matrix: number[], x: number, y: number, width: number, height: number): Point {
  const clipX = matrix[0]! * x + matrix[4]! * y + matrix[12]!;
  const clipY = matrix[1]! * x + matrix[5]! * y + matrix[13]!;
  const clipW = matrix[3]! * x + matrix[7]! * y + matrix[15]!;
  const safeW = Math.abs(clipW) > 1e-8 ? clipW : 1;
  return {
    x: ((clipX / safeW) + 1) * width / 2,
    y: (1 - (clipY / safeW)) * height / 2,
  };
}

function color(value: string | undefined, fallback = "#ffffff"): string {
  return value && (value.startsWith("#") || value.startsWith("rgb"))
    ? value
    : fallback;
}

function fillStyle(
  ctx: SKRSContext2D,
  fill: string,
  fillPaint: Extract<PaintCommand, { op: "drawShape" }>['fillPaint'],
  width: number,
  height: number,
): void {
  if (fillPaint?.type === "linear-gradient" && fillPaint.stops.length > 0) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    for (const stop of fillPaint.stops) gradient.addColorStop(stop.offset, stop.color);
    ctx.fillStyle = gradient;
    return;
  }
  if (fillPaint?.type === "radial-gradient" && fillPaint.stops.length > 0) {
    const radius = Math.min(width, height) / 2;
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, radius);
    for (const stop of fillPaint.stops) gradient.addColorStop(stop.offset, stop.color);
    ctx.fillStyle = gradient;
    return;
  }
  ctx.fillStyle = color(fill);
}

function modelPoints(
  matrix: number[],
  projection: number[],
  shape: "rectangle" | "ellipse",
  width: number,
  height: number,
  canvasWidth: number,
  canvasHeight: number,
): Point[] {
  const local: Point[] = [];
  if (shape === "ellipse") {
    for (let index = 0; index < 64; index += 1) {
      const angle = (index / 64) * Math.PI * 2;
      local.push({
        x: width / 2 + Math.cos(angle) * width / 2,
        y: height / 2 + Math.sin(angle) * height / 2,
      });
    }
  } else {
    local.push({ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height });
  }
  const combined = new Array<number>(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let k = 0; k < 4; k += 1) {
        combined[row + column * 4] += projection[row + k * 4]! * matrix[k + column * 4]!;
      }
    }
  }
  return local.map((point) => projectPoint(combined, point.x, point.y, canvasWidth, canvasHeight));
}

function drawShape(
  ctx: SKRSContext2D,
  command: Extract<PaintCommand, { op: "drawShape" }>,
  transform: Extract<PaintCommand, { op: "setTransform" }> | null,
  projection: number[] | undefined,
  canvasWidth: number,
  canvasHeight: number,
): void {
  if (!transform || !transform.visible || transform.alpha <= 0) return;
  if (command.shape !== "rectangle" && command.shape !== "ellipse") return;
  const matrix = transform.matrix4 ?? [
    transform.matrix.a, transform.matrix.b, 0, 0,
    transform.matrix.c, transform.matrix.d, 0, 0,
    0, 0, 1, 0,
    transform.matrix.e, transform.matrix.f, 0, 1,
  ];
  const points = modelPoints(
    matrix,
    projection ?? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    command.shape,
    command.width,
    command.height,
    canvasWidth,
    canvasHeight,
  );
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
  ctx.globalAlpha = Math.max(0, Math.min(1, transform.alpha * (command.fillOpacity ?? 1)));
  fillStyle(ctx, command.fill, command.fillPaint, command.width, command.height);
  ctx.fill();
  if (command.stroke) {
    ctx.globalAlpha = Math.max(0, Math.min(1, transform.alpha * (command.strokeOpacity ?? 1)));
    ctx.strokeStyle = command.stroke;
    ctx.lineWidth = command.strokeWidth ?? 1;
    ctx.stroke();
  }
}

/** Rasterize one V2 RuntimeFrame into a CPU PNG for export/contact sheets. */
export function rasterRuntimeFrameV2(
  frame: RuntimeFrameV2,
  width: number,
  height: number,
): Buffer {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  let transform: Extract<PaintCommand, { op: "setTransform" }> | null = null;
  let projection: number[] | undefined;
  for (const command of frame.commands) {
    if (command.op === "beginFrame") {
      projection = command.projection?.viewProjectionMatrix;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = color(command.background, "#000000");
      ctx.fillRect(0, 0, width, height);
    } else if (command.op === "setTransform") {
      transform = command;
    } else if (command.op === "drawShape") {
      drawShape(ctx, command, transform, projection, width, height);
      transform = null;
    }
  }
  return canvas.toBuffer("image/png");
}

export function runtimeProjectV2Duration(project: RuntimeProjectV2): number {
  return project.nodes.reduce(
    (duration, node) => Math.max(duration, node.timing.start + node.timing.duration),
    0,
  );
}

export function runtimeProjectV2Aspect(project: RuntimeProjectV2): AspectRatio {
  const ratio = project.composition.width / project.composition.height;
  if (Math.abs(ratio - 1) < 0.01) return "1:1";
  return ratio > 1 ? "16:9" : "9:16";
}

export async function renderRuntimeProjectV2(
  project: RuntimeProjectV2,
  options: {
    outDir: string;
    fps?: number;
    onProgress?: (ratio: number) => void;
  },
): Promise<RenderResult> {
  const fps = options.fps ?? project.composition.fps;
  const durationSec = runtimeProjectV2Duration(project);
  const frameCount = Math.max(1, Math.ceil(durationSec * fps));
  await mkdir(options.outDir, { recursive: true });
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const time = frameIndex / fps;
    const frame = evaluateRuntimeProjectV2(project, frameIndex, { time });
    const png = rasterRuntimeFrameV2(frame, project.composition.width, project.composition.height);
    const name = `frame_${String(frameIndex).padStart(6, "0")}.png`;
    await writeFile(path.join(options.outDir, name), png);
    options.onProgress?.((frameIndex + 1) / frameCount);
  }
  return {
    projectId: project.id,
    framesDir: options.outDir,
    frameCount,
    fps,
    width: project.composition.width,
    height: project.composition.height,
    durationSec,
  };
}
