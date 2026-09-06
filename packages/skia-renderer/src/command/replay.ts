import { hasPerspectiveTerms, type PaintCommandBuffer, type PaintCommand } from "@motionvideo/motion-runtime";
import { cssColorToRgba } from "../color";
import type { SkiaCanvas, SkiaCanvasKit } from "../canvas-kit";
import type { SkiaAsset } from "../types";
import { createSkiaPaint } from "../paint";
import { drawCommandBounds, matrix4ToSkia3x3, pathSvg, polygonSvg, projectiveMeshSvg, projectiveShapeSvg, transformForSkiaCanvas, unionBounds, type SkiaProjectionContext } from "./geometry";
import { effectFilterFor } from "./effects";
import { applyClipPath, drawMaskSource, sourcePathCommands, type MaskSource } from "./masks";
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
  deviceScale = 1,
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
  let semanticSources = new Map<string, MaskSource>();
  const layers: ReplayLayer[] = [];
  let pendingTransform: Extract<PaintCommand, { op: "setTransform" }> | null = null;
  let frameWidth = 0;
  let frameHeight = 0;
  let projectionContext: SkiaProjectionContext | undefined;
  const isBlocked = () => layers.some((layer) => layer.blocked);
  const addDiagnostic = (value: string) => stats.diagnostics.push(value);

  for (const command of buffer.commands) {
    if (command.op === "beginFrame") {
      frameWidth = command.width;
      frameHeight = command.height;
      projectionContext = {
        width: command.width,
        height: command.height,
        projection: command.projection?.worldToClipMatrix,
        depthClip: command.projection?.depthClip,
      };
      semanticSources = sourcePathCommands(buffer, projectionContext);
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
      const maskSourceKeys = new Set([
        ...(command.mask?.sourceKeys ?? (command.mask ? [command.mask.sourceKey] : [])),
        ...(command.mask?.layers?.flatMap((maskLayer) => maskLayer.sourceKeys) ?? []),
      ]);
      const layer: ReplayLayer = {
        key: command.key,
        saved: false,
        blocked: isBlocked(),
        clipSourceKeys,
        maskMode: command.mask?.mode === "alpha" || command.mask?.mode === "luma" ? command.mask.mode : undefined,
        maskSourceKeys,
        maskLayers: command.mask?.layers?.flatMap((maskLayer) => maskLayer.mode === "clip" ? [] : [{ mode: maskLayer.mode, sourceKeys: maskLayer.sourceKeys, composite: maskLayer.composite }]),
        noiseEffect: command.effectProgram?.ops.length === 1 && command.effectProgram.ops[0]?.kind === "noise"
          ? command.effectProgram.ops[0]
          : undefined,
      };
      layers.push(layer);
      const effectFilter = effectFilterFor(kit, command.effectProgram);
      if (command.effectProgram && !effectFilter.supported) addDiagnostic(`skia_effect_unsupported:${command.key}`);
      // CSS masks are rendered into a separate coverage surface at endLayer.
      // Keeping this out of saveLayer alpha is important for gradients and
      // for subtract/exclude, which cannot be represented by one scalar.
      const shouldSaveLayer = command.offscreen || command.isolation || command.compositeAlpha !== undefined || Boolean(effectFilter.filter) || (command.blendMode !== undefined && command.blendMode !== "normal");
      if (shouldSaveLayer) {
        const paint = new kit.Paint();
        paint.setAntiAlias(true);
        paint.setStyle(kit.PaintStyle.Fill);
        paint.setAlphaf(Math.max(0, Math.min(1, command.compositeAlpha ?? 1)));
        paint.setBlendMode(blendModeFor(kit, command.blendMode));
        if (effectFilter.filter && paint.setImageFilter) paint.setImageFilter(effectFilter.filter);
        canvas.saveLayer(paint);
        paint.delete();
        effectFilter.filter?.delete();
      } else {
        canvas.save();
      }
      layer.saved = true;
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
      if (layer?.saved && layer.maskSourceKeys.size > 0) {
        const maskLayers = layer.maskLayers ?? [{ mode: layer.maskMode ?? "alpha", sourceKeys: [...layer.maskSourceKeys], composite: "intersect" as const }];
        const maskSurface = kit.MakeSurface(Math.max(1, Math.ceil(frameWidth * deviceScale)), Math.max(1, Math.ceil(frameHeight * deviceScale)));
        if (!maskSurface?.makeImageSnapshot) {
          addDiagnostic(`skia_mask_surface_unsupported:${layer.key}`);
        } else if (!maskSurface) {
          addDiagnostic(`skia_mask_surface_unavailable:${layer.key}`);
        } else {
          const maskCanvas = maskSurface.getCanvas();
          maskCanvas.clear(kit.TRANSPARENT);
          if (deviceScale !== 1) maskCanvas.concat([deviceScale, 0, 0, 0, deviceScale, 0, 0, 0, 1]);
          let firstLayer = true;
          for (const maskLayer of maskLayers) {
            // Build each CSS mask-image layer separately. Tiles in one layer
            // are unioned with SrcOver; only then is the authored composite
            // operator applied between the accumulated layers.
            const layerSurface = kit.MakeSurface(Math.max(1, Math.ceil(frameWidth * deviceScale)), Math.max(1, Math.ceil(frameHeight * deviceScale)));
            if (!layerSurface?.makeImageSnapshot) {
              addDiagnostic(`skia_mask_surface_unsupported:${layer.key}`);
              layerSurface?.dispose();
              continue;
            }
            if (!layerSurface) {
              addDiagnostic(`skia_mask_surface_unavailable:${layer.key}`);
              continue;
            }
            const layerCanvas = layerSurface.getCanvas();
            layerCanvas.clear(kit.TRANSPARENT);
            if (deviceScale !== 1) layerCanvas.concat([deviceScale, 0, 0, 0, deviceScale, 0, 0, 0, 1]);
            const sourceBlendMode = kit.BlendMode.SrcOver;
            for (const sourceKey of maskLayer.sourceKeys) {
              const source = semanticSources.get(sourceKey);
              if (!source || !drawMaskSource(kit, layerCanvas, source, maskLayer.mode, assets, sourceBlendMode)) {
                addDiagnostic(`skia_mask_source_unsupported:${layer.key}:${sourceKey}`);
              }
            }
            layerSurface.flush();
            const layerImage = layerSurface.makeImageSnapshot();
            if (!layerImage) {
              addDiagnostic(`skia_mask_snapshot_unsupported:${layer.key}`);
              layerSurface.dispose();
              continue;
            }
            const operation = firstLayer ? "add" as const : maskLayer.composite;
            const modeKey = operation === "add" ? "SrcOver" : operation === "intersect" ? "DstIn" : operation === "subtract" ? "DstOut" : "Xor";
            const blendMode = kit.BlendMode[modeKey];
            if (blendMode === undefined) {
              addDiagnostic(`skia_mask_composite_unsupported:${layer.key}:${operation}`);
              layerImage.delete();
              layerSurface.dispose();
              continue;
            }
            const layerPaint = new kit.Paint();
            layerPaint.setAntiAlias(true);
            layerPaint.setStyle(kit.PaintStyle.Fill);
            layerPaint.setAlphaf(1);
            layerPaint.setBlendMode(blendMode);
            maskCanvas.drawImageRect(layerImage, [0, 0, frameWidth * deviceScale, frameHeight * deviceScale], [0, 0, frameWidth, frameHeight], layerPaint, false);
            layerPaint.delete();
            layerImage.delete();
            layerSurface.dispose();
            firstLayer = false;
          }
          maskSurface.flush();
          const snapshot = maskSurface.makeImageSnapshot();
          if (!snapshot) addDiagnostic(`skia_mask_snapshot_unsupported:${layer.key}`);
          else {
            const paint = new kit.Paint();
            paint.setAntiAlias(true);
            paint.setStyle(kit.PaintStyle.Fill);
            paint.setAlphaf(1);
            paint.setBlendMode(kit.BlendMode.DstIn);
            canvas.drawImageRect(snapshot, [0, 0, frameWidth, frameHeight], [0, 0, frameWidth, frameHeight], paint, false);
            paint.delete();
            snapshot.delete();
          }
          maskSurface.dispose();
        }
      }
      if (layer?.noiseEffect && layer.noiseBounds) stats.noiseRegions.push({ effect: layer.noiseEffect, bounds: layer.noiseBounds });
      if (layer?.saved) canvas.restore();
      pendingTransform = null;
      continue;
    }
    if (command.op === "setTransform") {
      pendingTransform = projectionContext
        ? transformForSkiaCanvas(command, projectionContext)
        : command;
      continue;
    }
    if (isBlocked()) {
      if (["drawPath", "drawShape", "drawSolid", "drawText", "drawImage", "drawVideo"].includes(command.op)) pendingTransform = null;
      continue;
    }
    if ((command.op === "drawPath" || command.op === "drawImage") && layers.some((layer) => layer.clipSourceKeys.has(command.key) || layer.maskSourceKeys.has(command.key))) {
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
      const activeTransform = pendingTransform;
      const commandAlpha = beginTransformedCommand(kit, canvas, activeTransform);
      pendingTransform = null;
      if (commandAlpha === null) continue;
      const projectedShape = activeTransform && projectionContext && hasPerspectiveTerms(activeTransform.matrix4)
        ? projectiveShapeSvg(command, activeTransform.matrix4, projectionContext)
        : null;
      const drawShape = (paint: Parameters<SkiaCanvas["drawRect"]>[1]) => {
        if (projectedShape !== null) {
          const projectedPath = kit.Path.MakeFromSVGString(projectedShape);
          if (projectedPath) {
            canvas.drawPath(projectedPath, paint);
            projectedPath.delete();
          }
          return;
        }
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
      const activeTransform = pendingTransform;
      const commandAlpha = beginTransformedCommand(kit, canvas, activeTransform);
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
      const projectedFill = activeTransform && projectionContext && hasPerspectiveTerms(activeTransform.matrix4) && command.mesh
        ? projectiveMeshSvg(command.mesh, activeTransform.matrix4, projectionContext)
        : null;
      const paintOrder = command.paintOrder ?? ["fill", "stroke", "markers"];
      for (const paintType of paintOrder) {
        if (paintType === "fill" && command.fill) {
          const fill = createSkiaPaint(kit, command.fill, commandAlpha * (command.fillOpacity ?? 1), kit.PaintStyle.Fill, command.fillPaint, command.width ?? 1, command.height ?? 1);
          if (projectedFill === null) {
            canvas.drawPath(path, fill);
          } else {
            const projectedPath = kit.Path.MakeFromSVGString(projectedFill);
            if (projectedPath) {
              projectedPath.setFillType?.(fillType);
              canvas.drawPath(projectedPath, fill);
              projectedPath.delete();
            }
          }
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
