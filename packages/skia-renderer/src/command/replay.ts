import type { PaintCommandBuffer, PaintCommand } from "@motionvideo/motion-runtime";
import { cssColorToRgba } from "../color";
import type { SkiaCanvas, SkiaCanvasKit } from "../canvas-kit";
import type { SkiaAsset } from "../types";
import { createSkiaPaint } from "../paint";
import { drawCommandBounds, matrix4ToSkia3x3, pathSvg, polygonSvg, unionBounds } from "./geometry";
import { effectFilterFor } from "./effects";
import { applyClipPath, applyMaskSource, maskColorAlpha, sourcePathCommands } from "./masks";
import { drawAsset } from "./images";
import { drawTextDecoration, drawTextGlyph, drawTextStroke } from "./text";
import { blendModeFor, configureStroke } from "./paint";
import type { ReplayLayer, SkiaReplayStats, SkiaTypefaceResolver } from "./types";

function beginTransformedCommand(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  transform: Extract<PaintCommand, { op: "setTransform" }> | null,
): number | null {
  if (transform && (!transform.visible || transform.alpha <= 0)) return null;
  canvas.save();
  if (transform) canvas.concat(matrix4ToSkia3x3(transform.matrix4));
  return transform?.alpha ?? 1;
}

export function replaySkiaCommands(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  buffer: PaintCommandBuffer,
  assets: ReadonlyMap<string, SkiaAsset> = new Map(),
  defaultBackground = "#000000",
  typefaceFor: SkiaTypefaceResolver = () => null,
): SkiaReplayStats {
  const stats: SkiaReplayStats = {
    drawCalls: 0,
    skippedCommands: 0,
    textureUploads: 0,
    videoTextureUploads: 0,
    nativeTextGlyphs: 0,
    nativeColorTextGlyphs: 0,
    outlineTextGlyphs: 0,
    colorTextGlyphs: 0,
    diagnostics: [],
    noiseRegions: [],
  };
  const semanticSources = sourcePathCommands(buffer);
  const layers: ReplayLayer[] = [];
  let pendingTransform: Extract<PaintCommand, { op: "setTransform" }> | null = null;
  const isBlocked = () => layers.some((layer) => layer.blocked);
  const addDiagnostic = (value: string) => stats.diagnostics.push(value);

  for (const command of buffer.commands) {
    if (command.op === "beginFrame") {
      const [backgroundR, backgroundG, backgroundB, backgroundA] = cssColorToRgba(command.background ?? defaultBackground);
      canvas.clear(kit.Color(backgroundR * 255, backgroundG * 255, backgroundB * 255, backgroundA));
      pendingTransform = null;
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
      pendingTransform = null;
      continue;
    }
    if (command.op === "beginLayer") {
      const clipSourceKeys = new Set(command.clipPath?.sourceKeys ?? (command.clipPath ? [command.clipPath.sourceKey] : []));
      const maskSourceKeys = new Set(command.mask?.sourceKeys ?? (command.mask ? [command.mask.sourceKey] : []));
      const layer: ReplayLayer = {
        key: command.key,
        saved: false,
        blocked: isBlocked(),
        clipSourceKeys,
        maskMode: command.mask?.mode === "alpha" || command.mask?.mode === "luma" ? command.mask.mode : undefined,
        maskSourceKeys,
        noiseEffect: command.effectProgram?.ops.length === 1 && command.effectProgram.ops[0]?.kind === "noise"
          ? command.effectProgram.ops[0]
          : undefined,
      };
      layers.push(layer);
      const effectFilter = effectFilterFor(kit, command.effectProgram);
      if (command.effectProgram && !effectFilter.supported) addDiagnostic(`skia_effect_unsupported:${command.key}`);
      let maskCoverage = 1;
      if (command.mask && command.mask.mode !== "clip") {
        for (const sourceKey of maskSourceKeys) {
          const source = semanticSources.get(sourceKey);
          if (!source) {
            addDiagnostic(`skia_mask_source_unsupported:${command.key}:${sourceKey}`);
            continue;
          }
          maskCoverage = Math.min(maskCoverage, maskColorAlpha(source.command, command.mask.mode));
        }
        layer.maskMode = undefined;
      }
      const shouldSaveLayer = command.offscreen || command.isolation || command.compositeAlpha !== undefined || Boolean(effectFilter.filter) || (command.blendMode !== undefined && command.blendMode !== "normal");
      if (shouldSaveLayer) {
        const paint = new kit.Paint();
        paint.setAntiAlias(true);
        paint.setStyle(kit.PaintStyle.Fill);
        paint.setAlphaf(Math.max(0, Math.min(1, (command.compositeAlpha ?? 1) * maskCoverage)));
        paint.setBlendMode(blendModeFor(kit, command.blendMode));
        if (effectFilter.filter && paint.setImageFilter) paint.setImageFilter(effectFilter.filter);
        canvas.saveLayer(paint);
        paint.delete();
        effectFilter.filter?.delete();
      } else {
        canvas.save();
      }
      layer.saved = true;
      if (command.mask && command.mask.mode !== "clip") {
        for (const sourceKey of maskSourceKeys) {
          const source = semanticSources.get(sourceKey);
          if (source && !applyClipPath(kit, canvas, source)) addDiagnostic(`skia_mask_source_unsupported:${command.key}:${sourceKey}`);
        }
      }
      if (command.clipPath) {
        const sources = command.clipPath.sourceKeys ?? [command.clipPath.sourceKey];
        for (const sourceKey of sources) {
          const source = semanticSources.get(sourceKey);
          if (!source || !applyClipPath(kit, canvas, source)) addDiagnostic(`skia_clip_path_unsupported:${command.key}:${sourceKey}`);
        }
      }
      continue;
    }
    if (command.op === "endLayer") {
      const layer = layers.pop();
      if (layer?.saved && layer.maskMode) {
        for (const sourceKey of layer.maskSourceKeys) {
          const source = semanticSources.get(sourceKey);
          if (!source || !applyMaskSource(kit, canvas, source, layer.maskMode)) addDiagnostic(`skia_mask_source_unsupported:${layer.key}:${sourceKey}`);
        }
      }
      if (layer?.noiseEffect && layer.noiseBounds) stats.noiseRegions.push({ effect: layer.noiseEffect, bounds: layer.noiseBounds });
      if (layer?.saved) canvas.restore();
      pendingTransform = null;
      continue;
    }
    if (command.op === "setTransform") {
      pendingTransform = command;
      continue;
    }
    if (isBlocked()) {
      if (["drawPath", "drawShape", "drawSolid", "drawText", "drawImage", "drawVideo"].includes(command.op)) pendingTransform = null;
      continue;
    }
    if (command.op === "drawPath" && layers.some((layer) => layer.clipSourceKeys.has(command.key) || layer.maskSourceKeys.has(command.key))) {
      // Compiler-lowered clipPath/mask geometry is a source node, not visible content.
      pendingTransform = null;
      continue;
    }
    const noiseLayer = [...layers].reverse().find((candidate) => candidate.noiseEffect);
    if (noiseLayer) {
      const bounds = drawCommandBounds(command, pendingTransform);
      if (bounds) noiseLayer.noiseBounds = unionBounds(noiseLayer.noiseBounds, bounds);
    }
    if (command.op === "drawSolid") {
      const commandAlpha = beginTransformedCommand(kit, canvas, pendingTransform);
      pendingTransform = null;
      if (commandAlpha === null) continue;
      const paint = createSkiaPaint(kit, command.fill, commandAlpha, kit.PaintStyle.Fill);
      canvas.drawRect([0, 0, command.width, command.height], paint);
      paint.delete();
      canvas.restore();
      stats.drawCalls++;
      continue;
    }
    if (command.op === "drawShape") {
      const commandAlpha = beginTransformedCommand(kit, canvas, pendingTransform);
      pendingTransform = null;
      if (commandAlpha === null) continue;
      const drawShape = (paint: Parameters<SkiaCanvas["drawRect"]>[1]) => {
        if (command.shape === "rectangle") {
          if (command.cornerRadius) canvas.drawRRect([0, 0, command.width, command.height, command.cornerRadius, command.cornerRadius], paint);
          else canvas.drawRect([0, 0, command.width, command.height], paint);
        } else if (command.shape === "ellipse") {
          canvas.drawOval([0, 0, command.width, command.height], paint);
        } else {
          const polygon = kit.Path.MakeFromSVGString(polygonSvg(command.points ?? []));
          if (polygon) {
            canvas.drawPath(polygon, paint);
            polygon.delete();
          }
        }
      };
      const paintOrder = command.paintOrder ?? ["fill", "stroke", "markers"];
      for (const paintType of paintOrder) {
        if (paintType === "fill") {
          const fill = createSkiaPaint(kit, command.fill, commandAlpha * (command.fillOpacity ?? 1), kit.PaintStyle.Fill, command.fillPaint, command.width, command.height);
          drawShape(fill);
          fill.delete();
        } else if (paintType === "stroke" && command.stroke) {
          const stroke = createSkiaPaint(kit, command.stroke, commandAlpha * (command.strokeOpacity ?? 1), kit.PaintStyle.Stroke, command.strokePaint, command.width, command.height);
          const effect = configureStroke(kit, stroke, command);
          drawShape(stroke);
          effect?.delete();
          stroke.delete();
        }
      }
      canvas.restore();
      stats.drawCalls++;
      continue;
    }
    if (command.op === "drawPath") {
      const commandAlpha = beginTransformedCommand(kit, canvas, pendingTransform);
      pendingTransform = null;
      if (commandAlpha === null) continue;
      const path = kit.Path.MakeFromSVGString(pathSvg(command));
      if (!path) {
        stats.skippedCommands++;
        stats.diagnostics.push(`path:${command.key}`);
        canvas.restore();
        continue;
      }
      const fillType = command.fillRule === "evenodd" ? kit.FillType?.EvenOdd : kit.FillType?.Winding;
      if (fillType !== undefined) path.setFillType?.(fillType);
      const paintOrder = command.paintOrder ?? ["fill", "stroke", "markers"];
      for (const paintType of paintOrder) {
        if (paintType === "fill" && command.fill) {
          const fill = createSkiaPaint(kit, command.fill, commandAlpha * (command.fillOpacity ?? 1), kit.PaintStyle.Fill, command.fillPaint, command.width ?? 1, command.height ?? 1);
          canvas.drawPath(path, fill);
          fill.delete();
        } else if (paintType === "stroke" && command.stroke) {
          const stroke = createSkiaPaint(kit, command.stroke, commandAlpha * (command.strokeOpacity ?? 1), kit.PaintStyle.Stroke, command.strokePaint, command.width ?? 1, command.height ?? 1);
          const effect = configureStroke(kit, stroke, command);
          canvas.drawPath(path, stroke);
          effect?.delete();
          stroke.delete();
        }
      }
      path.delete();
      canvas.restore();
      stats.drawCalls++;
      continue;
    }
    if (command.op === "drawText") {
      const commandAlpha = beginTransformedCommand(kit, canvas, pendingTransform);
      pendingTransform = null;
      if (commandAlpha === null) continue;
      let drawn = 0;
      let colorFallbacks = 0;
      const paintOrder = command.paintOrder ?? ["fill", "stroke", "markers"];
      for (const [glyphIndex, glyph] of (command.glyphs ?? []).entries()) {
        for (const paintType of paintOrder) {
          if (paintType === "fill") {
            const result = drawTextGlyph(kit, canvas, command, glyph, glyphIndex, commandAlpha, assets, typefaceFor);
            if (result.drawn) drawn++;
            if (result.fallback) colorFallbacks++;
            if (result.mode === "native") stats.nativeTextGlyphs++;
            else if (result.mode === "native-color") { stats.nativeColorTextGlyphs++; stats.colorTextGlyphs++; }
            else if (result.mode === "outline") stats.outlineTextGlyphs++;
            else if (result.mode === "color") stats.colorTextGlyphs++;
          } else if (paintType === "stroke" && drawTextStroke(kit, canvas, command, glyph, commandAlpha)) {
            drawn++;
          }
        }
      }
      for (const decoration of command.decorations ?? []) {
        drawTextDecoration(kit, canvas, command, decoration, commandAlpha);
        drawn++;
      }
      if (colorFallbacks) stats.diagnostics.push(`text_color_glyph_fallback:${command.key}:${colorFallbacks}`);
      if (drawn) stats.drawCalls++;
      else {
        stats.skippedCommands++;
        stats.diagnostics.push(`text:${command.key}`);
      }
      canvas.restore();
      continue;
    }
    if (command.op === "drawImage" || command.op === "drawVideo") {
      const commandAlpha = beginTransformedCommand(kit, canvas, pendingTransform);
      pendingTransform = null;
      if (commandAlpha === null) continue;
      if (command.op === "drawVideo" && command.mediaVisible === false) {
        canvas.restore();
        continue;
      }
      const asset = assets.get(command.assetId);
      if (!asset || !drawAsset(kit, canvas, command, asset, commandAlpha)) {
        stats.skippedCommands++;
        stats.diagnostics.push(`${command.op}:${command.key}`);
      } else {
        stats.drawCalls++;
        if (command.op === "drawVideo") stats.videoTextureUploads++;
        else stats.textureUploads++;
      }
      canvas.restore();
      continue;
    }
    if (command.op !== "endFrame") {
      stats.skippedCommands++;
      stats.diagnostics.push(command.op);
    }
  }
  return stats;
}
