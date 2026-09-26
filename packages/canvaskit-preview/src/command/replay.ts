import type { PaintCommandBuffer } from "@motionvideo/motion-runtime";
import { cssColorToRgba } from "../color";
import type { SkiaCanvas, SkiaCanvasKit } from "../canvas-kit";
import type { SkiaAsset } from "../types";
import { drawCommandBounds, transformForSkiaCanvas, unionBounds } from "./geometry";
import { sourcePathCommands } from "./masks";
import { createReplayContext } from "./replay-context";
import { beginLayer, endLayer } from "./layers";
import { drawMedia, drawPath, drawShape, drawSolid, drawText } from "./draw-ops";
import type { SkiaFontResolver, SkiaReplayResources, SkiaReplayStats } from "./types";

/**
 * Replays one frame's PaintCommandBuffer onto a CanvasKit canvas. This file
 * only owns command dispatch and frame/group/transform bookkeeping; the
 * per-command work lives in layers.ts (beginLayer/endLayer, masks, backdrop
 * and effect filters), box-effect.ts (box-shadow halos) and draw-ops.ts
 * (solid/shape/path/text/media draws), all sharing one ReplayContext.
 */
export function replaySkiaCommands(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  buffer: PaintCommandBuffer,
  assets: ReadonlyMap<string, SkiaAsset> = new Map(),
  defaultBackground = "#000000",
  fontFor: SkiaFontResolver = () => null,
  deviceScale = 1,
  resources?: SkiaReplayResources,
): SkiaReplayStats {
  const ctx = createReplayContext({ kit, canvas, buffer, assets, defaultBackground, fontFor, deviceScale, resources });
  const { stats, layers, isBlocked } = ctx;

  for (let commandIndex = 0; commandIndex < buffer.commands.length; commandIndex += 1) {
    const command = buffer.commands[commandIndex]!;
    if (command.op === "beginFrame") {
      ctx.frameWidth = command.width;
      ctx.frameHeight = command.height;
      ctx.graphId = command.graphId;
      ctx.projectionContext = {
        width: command.width,
        height: command.height,
        projection: command.projection?.worldToClipMatrix,
        depthClip: command.projection?.depthClip,
      };
      ctx.semanticSources = sourcePathCommands(buffer, ctx.projectionContext);
      const [backgroundR, backgroundG, backgroundB, backgroundA] = cssColorToRgba(command.background ?? defaultBackground);
      canvas.clear(kit.Color(backgroundR * 255, backgroundG * 255, backgroundB * 255, backgroundA));
      ctx.pendingTransform = null;
      continue;
    }
    if (command.op === "beginGroup") {
      canvas.save();
      layers.push({ key: command.key, saved: true, blocked: isBlocked(), clipSourceKeys: new Set(), maskSourceKeys: new Set() });
      continue;
    }
    if (command.op === "endGroup") {
      const layer = layers.pop();
      if (layer?.saved) canvas.restore();
      ctx.pendingTransform = null;
      continue;
    }
    if (command.op === "beginLayer") {
      beginLayer(ctx, command, commandIndex);
      continue;
    }
    if (command.op === "endLayer") {
      endLayer(ctx);
      continue;
    }
    if (command.op === "setTransform") {
      ctx.pendingTransform = ctx.projectionContext
        ? transformForSkiaCanvas(command, ctx.projectionContext)
        : command;
      continue;
    }
    if (isBlocked()) {
      if (["drawPath", "drawShape", "drawSolid", "drawText", "drawImage", "drawVideo"].includes(command.op)) ctx.pendingTransform = null;
      continue;
    }
    if ((command.op === "drawPath" || command.op === "drawImage") && layers.some((layer) => layer.clipSourceKeys.has(command.key) || layer.maskSourceKeys.has(command.key))) {
      // Compiler-lowered clipPath/mask geometry is a source node, not visible content.
      ctx.pendingTransform = null;
      continue;
    }
    const noiseLayer = [...layers].reverse().find((candidate) => candidate.noiseEffect);
    if (noiseLayer) {
      const bounds = drawCommandBounds(command, ctx.pendingTransform);
      if (bounds) noiseLayer.noiseBounds = unionBounds(noiseLayer.noiseBounds, bounds);
    }
    if (command.op === "drawSolid") {
      drawSolid(ctx, command);
      continue;
    }
    if (command.op === "drawShape") {
      drawShape(ctx, command);
      continue;
    }
    if (command.op === "drawPath") {
      drawPath(ctx, command);
      continue;
    }
    if (command.op === "drawText") {
      drawText(ctx, command);
      continue;
    }
    if (command.op === "drawImage" || command.op === "drawVideo") {
      drawMedia(ctx, command);
      continue;
    }
    if (command.op !== "endFrame") {
      stats.skippedCommands++;
      stats.diagnostics.push(command.op);
    }
  }
  return stats;
}
