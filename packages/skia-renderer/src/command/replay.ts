import { hasPerspectiveTerms, type PaintCommandBuffer, type PaintCommand } from "@motionvideo/motion-runtime";
import { cssColorToRgba } from "../color";
import type { SkiaCanvas, SkiaCanvasKit, SkiaImage, SkiaImageFilter } from "../canvas-kit";
import type { SkiaAsset } from "../types";
import { createSkiaPaint } from "../paint";
import { drawCommandBounds, matrix4ToSkia3x3, pathSvg, polygonSvg, projectiveMeshSvg, projectiveShapeSvg, projectiveTextureMesh, projectiveTextureShaderMatrix, transformForSkiaCanvas, unionBounds, type SkiaProjectionContext } from "./geometry";
import { effectFilterFor } from "./effects";
import { applyClipPath, drawMaskSource, sourcePathCommands, type MaskSource } from "./masks";
import { drawAsset } from "./images";
import { drawTextDecoration, drawTextGlyph, drawTextStroke } from "./text";
import { blendModeFor, configureStroke } from "./paint";
import type { ReplayLayer, SkiaReplayResources, SkiaReplayStats, SkiaTypefaceResolver } from "./types";

function beginTransformedCommand(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  transform: Extract<PaintCommand, { op: "setTransform" }> | null,
  applyMatrix = true,
): number | null {
  if (transform && (!transform.visible || transform.alpha <= 0)) return null;
  canvas.save();
  if (transform && applyMatrix) canvas.concat(matrix4ToSkia3x3(transform.matrix4));
  return transform?.alpha ?? 1;
}

function drawShapeGeometry(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  command: Extract<PaintCommand, { op: "drawShape" }>,
  paint: Parameters<SkiaCanvas["drawRect"]>[1],
): void {
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
}

function projectiveFilterPadding(
  program: Extract<PaintCommand, { op: "beginLayer" }>['effectProgram'],
): number {
  if (!program) return 0;
  let padding = 2;
  for (const op of program.ops) {
    if (op.kind === "blur") padding = Math.max(padding, Math.ceil(op.radius * 3 + 2));
    else if (op.kind === "offset") padding = Math.max(padding, Math.ceil(Math.max(Math.abs(op.x), Math.abs(op.y)) + 2));
  }
  // Keep enough local pixels for the blur kernel and the translated shadow.
  // This is intentionally conservative: the expanded local quad is clipped
  // again by the composition boundary after projection.
  return Math.min(128, Math.max(16, padding + 48));
}

function drawProjectiveSnapshot(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  image: SkiaImage,
  sourceWidth: number,
  sourceHeight: number,
  destination: readonly [number, number, number, number],
  matrix: readonly number[],
  context: SkiaProjectionContext,
): boolean {
  if (!kit.MakeVertices || !canvas.drawVertices || !image.makeShaderOptions) return false;
  const mesh = projectiveTextureMesh(
    destination,
    [0, 0, sourceWidth, sourceHeight],
    matrix,
    { width: context.width, height: context.height, projection: context.projection, depthClip: context.depthClip, outputSpace: "screen" },
  );
  if (!mesh) return false;
  const shaderMatrix = projectiveTextureShaderMatrix(destination, [0, 0, sourceWidth, sourceHeight], matrix);
  const shader = image.makeShaderOptions(
    kit.TileMode.Clamp,
    kit.TileMode.Clamp,
    kit.FilterMode?.Linear ?? 1,
    kit.MipmapMode?.None ?? 0,
    shaderMatrix ?? [1, 0, 0, 0, 1, 0, 0, 0, 1],
  );
  const vertices = shader
    ? kit.MakeVertices(kit.VertexMode?.Triangles ?? 0, mesh.positions, shaderMatrix ? undefined : mesh.texCoords, undefined, mesh.indices, false)
    : null;
  if (!shader || !vertices) {
    shader?.delete();
    return false;
  }
  const paint = new kit.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(kit.PaintStyle.Fill);
  paint.setAlphaf(1);
  paint.setBlendMode(kit.BlendMode.SrcOver);
  paint.setShader(shader);
  canvas.drawVertices(vertices, kit.BlendMode.SrcOver, paint);
  paint.delete();
  vertices.delete();
  shader.delete();
  return true;
}

/**
 * Project the source into device/screen space first, then run the image
 * filter on that surface. This is the CSS-facing contract for a filtered
 * perspective layer: hidden local pixels must not contribute across a
 * near-plane cut, and blur expansion must be measured in screen pixels.
 */
function drawProjectiveSnapshotWithFilter(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  image: SkiaImage,
  sourceWidth: number,
  sourceHeight: number,
  destination: readonly [number, number, number, number],
  matrix: readonly number[],
  context: SkiaProjectionContext,
  filter: SkiaImageFilter,
): boolean {
  const paint = new kit.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(kit.PaintStyle.Fill);
  paint.setAlphaf(1);
  paint.setBlendMode(kit.BlendMode.SrcOver);
  if (!paint.setImageFilter) {
    paint.delete();
    return false;
  }
  paint.setImageFilter(filter);
  canvas.saveLayer(paint, [0, 0, context.width, context.height]);
  paint.delete();
  const drawn = drawProjectiveSnapshot(
    kit,
    canvas,
    image,
    sourceWidth,
    sourceHeight,
    destination,
    matrix,
    context,
  );
  canvas.restore();
  return drawn;
}

function revisionForAsset(asset: SkiaAsset | undefined): string | number | undefined {
  if (!asset) return undefined;
  return asset.decodedFrameRevision ?? asset.frameVersion ?? asset.contentRevision ?? asset.resourceGeneration;
}

function maskCacheKey(
  graphId: string,
  width: number,
  height: number,
  deviceScale: number,
  layerKey: string,
  maskLayers: readonly { mode: "alpha" | "luma"; sourceKeys: string[]; composite: "add" | "subtract" | "intersect" | "exclude" }[],
  sources: ReadonlyMap<string, MaskSource>,
  assets: ReadonlyMap<string, SkiaAsset>,
  projectionContext: SkiaProjectionContext | undefined,
): string | undefined {
  const sourceData = maskLayers.flatMap((layer) => layer.sourceKeys.map((sourceKey) => {
    const source = sources.get(sourceKey);
    if (!source) return { sourceKey, missing: true };
    const asset = source.command.op === "drawImage" ? assets.get(source.command.assetId) : undefined;
    const revision = revisionForAsset(asset);
    if (asset?.kind === "video" && revision === undefined) return undefined;
    return { sourceKey, command: source.command, transform: source.transform?.matrix4, revision };
  }));
  if (sourceData.some((value) => value === undefined)) return undefined;
  return JSON.stringify({ graphId, width, height, deviceScale, layerKey, maskLayers, sourceData, projectionContext });
}

export function replaySkiaCommands(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  buffer: PaintCommandBuffer,
  assets: ReadonlyMap<string, SkiaAsset> = new Map(),
  defaultBackground = "#000000",
  typefaceFor: SkiaTypefaceResolver = () => null,
  deviceScale = 1,
  resources?: SkiaReplayResources,
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
    imageCacheHits: 0,
    filterCacheHits: 0,
    maskCacheHits: 0,
    projectiveMeshCacheHits: 0,
    offscreenSurfaceCreates: 0,
    offscreenSurfaceReuses: 0,
    diagnostics: [],
    noiseRegions: [],
  };
  let semanticSources = new Map<string, MaskSource>();
  const layers: ReplayLayer[] = [];
  let pendingTransform: Extract<PaintCommand, { op: "setTransform" }> | null = null;
  let frameWidth = 0;
  let frameHeight = 0;
  let graphId = "";
  let projectionContext: SkiaProjectionContext | undefined;
  const layerTransforms = new Map<string, Extract<PaintCommand, { op: "setTransform" }>>();
  for (const command of buffer.commands) {
    if (command.op === "setTransform") layerTransforms.set(command.key, command);
  }
  const isBlocked = () => layers.some((layer) => layer.blocked);
  const addDiagnostic = (value: string) => stats.diagnostics.push(value);
  const acquireSurface = (surfaceWidth: number, surfaceHeight: number) => {
    const result = resources?.surfacePool.acquire(surfaceWidth, surfaceHeight) ?? { surface: kit.MakeSurface(surfaceWidth, surfaceHeight), reused: false };
    if (result.reused) stats.offscreenSurfaceReuses++;
    else if (result.surface) stats.offscreenSurfaceCreates++;
    return result.surface;
  };
  const releaseSurface = (surfaceWidth: number, surfaceHeight: number, value: NonNullable<ReturnType<typeof acquireSurface>>) => {
    if (resources && value) resources.surfacePool.release(surfaceWidth, surfaceHeight, value);
    else value?.dispose();
  };
  const effectFilterForCached = (program: Extract<PaintCommand, { op: "beginLayer" }>['effectProgram']) => {
    if (!program || !resources) return effectFilterFor(kit, program);
    const key = JSON.stringify(program);
    const cached = resources.filterCache.get(key);
    if (cached) {
      stats.filterCacheHits++;
      return cached;
    }
    const created = effectFilterFor(kit, program);
    if (resources.filterCache.size >= 64) {
      const oldest = resources.filterCache.keys().next().value as string | undefined;
      if (oldest !== undefined) {
        resources.filterCache.get(oldest)?.filter?.delete();
        resources.filterCache.delete(oldest);
      }
    }
    resources.filterCache.set(key, created);
    return created;
  };

  for (const command of buffer.commands) {
    if (command.op === "beginFrame") {
      frameWidth = command.width;
      frameHeight = command.height;
      graphId = command.graphId;
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
      const layerTransform = layerTransforms.get(command.key) ?? [...layerTransforms.entries()]
        .find(([key]) => key.startsWith(`${command.key}::`))?.[1];
      const projectiveFilterTransform = layerTransform && projectionContext
        ? transformForSkiaCanvas(layerTransform, projectionContext)
        : undefined;
      const effectFilter = effectFilterForCached(command.effectProgram);
      const backdropEffectFilter = effectFilterForCached(command.backdropEffectProgram);
       // CSS filter effects on a projective layer are handled by the explicit
       // screen-space surface path below. Keeping the filter off the parent
       // saveLayer prevents Skia from filtering an unprojected local frame.
      const projectiveFilter = projectiveFilterTransform && hasPerspectiveTerms(projectiveFilterTransform.matrix4)
        ? effectFilter.filter
        : undefined;
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
        projectiveFilterTransform,
        projectiveFilter,
        projectiveFilterProgram: projectiveFilter ? command.effectProgram : undefined,
        backdropFilter: backdropEffectFilter.filter,
        backdropFilterProgram: backdropEffectFilter.filter ? command.backdropEffectProgram : undefined,
      };
      layers.push(layer);
      if (command.effectProgram && !effectFilter.supported) addDiagnostic(`skia_effect_unsupported:${command.key}`);
      if (command.backdropEffectProgram && !backdropEffectFilter.supported) addDiagnostic(`skia_backdrop_filter_unsupported:${command.key}`);
      // CSS masks are rendered into a separate coverage surface at endLayer.
      // Keeping this out of saveLayer alpha is important for gradients and
      // for subtract/exclude, which cannot be represented by one scalar.
      const shouldSaveLayer = command.offscreen || command.isolation || command.compositeAlpha !== undefined || Boolean(effectFilter.filter && !projectiveFilter) || Boolean(command.backdropEffectProgram) || (command.blendMode !== undefined && command.blendMode !== "normal");
      if (shouldSaveLayer) {
        const paint = new kit.Paint();
        paint.setAntiAlias(true);
        paint.setStyle(kit.PaintStyle.Fill);
        paint.setAlphaf(Math.max(0, Math.min(1, command.compositeAlpha ?? 1)));
        paint.setBlendMode(blendModeFor(kit, command.blendMode));
        // Non-projective layers keep the compact saveLayer path. Projective
        // layers apply their filter after projection in the draw branches.
        const layerFilter = effectFilter.filter;
        if (layerFilter && paint.setImageFilter) paint.setImageFilter(layerFilter);
        // Image filters such as drop-shadow expand beyond the source
        // geometry. Give the offscreen pass the complete composition clip so
        // the filtered output is not cropped to the unfiltered source bounds,
        // especially for projective surfaces near an edge.
        canvas.saveLayer(paint, [0, 0, frameWidth, frameHeight], backdropEffectFilter.filter);
        paint.delete();
        if (!resources && !projectiveFilter) effectFilter.filter?.delete();
        if (!resources) backdropEffectFilter.filter?.delete();
      } else {
        canvas.save();
      }
      layer.saved = true;
      if (command.clipPath) {
        const sources = command.clipPath.sourceKeys ?? [command.clipPath.sourceKey];
        for (const sourceKey of sources) {
          const source = semanticSources.get(sourceKey);
          if (!source || !applyClipPath(kit, canvas, source, projectionContext)) addDiagnostic(`skia_clip_path_unsupported:${command.key}:${sourceKey}`);
        }
      }
      continue;
    }
    if (command.op === "endLayer") {
      const layer = layers.pop();
      if (layer?.saved && layer.maskSourceKeys.size > 0) {
        const maskLayers = layer.maskLayers ?? [{ mode: layer.maskMode ?? "alpha", sourceKeys: [...layer.maskSourceKeys], composite: "intersect" as const }];
        const cachedMaskKey = resources
          ? maskCacheKey(graphId, frameWidth, frameHeight, deviceScale, layer.key, maskLayers, semanticSources, assets, projectionContext)
          : undefined;
        const cachedMask = cachedMaskKey ? resources?.maskCache.get(cachedMaskKey) : undefined;
        if (cachedMask) {
          stats.maskCacheHits++;
          const paint = new kit.Paint();
          paint.setAntiAlias(true);
          paint.setStyle(kit.PaintStyle.Fill);
          paint.setAlphaf(1);
          paint.setBlendMode(kit.BlendMode.DstIn);
          canvas.drawImageRect(cachedMask, [0, 0, frameWidth, frameHeight], [0, 0, frameWidth, frameHeight], paint, false);
          paint.delete();
        } else {
        const surfaceWidth = Math.max(1, Math.ceil(frameWidth * deviceScale));
        const surfaceHeight = Math.max(1, Math.ceil(frameHeight * deviceScale));
        const maskSurface = acquireSurface(surfaceWidth, surfaceHeight);
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
            const layerSurface = acquireSurface(surfaceWidth, surfaceHeight);
            if (!layerSurface?.makeImageSnapshot) {
              addDiagnostic(`skia_mask_surface_unsupported:${layer.key}`);
              if (layerSurface) releaseSurface(surfaceWidth, surfaceHeight, layerSurface);
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
              const maskResult = source
                ? drawMaskSource(kit, layerCanvas, source, maskLayer.mode, assets, sourceBlendMode, projectionContext, resources)
                : false;
              if (!source || !maskResult) {
                addDiagnostic(`skia_mask_source_unsupported:${layer.key}:${sourceKey}`);
              }
              if (maskResult && typeof maskResult !== "boolean") {
                if (maskResult.imageCacheHit) stats.imageCacheHits++;
                if (maskResult.projectiveMeshCacheHit) stats.projectiveMeshCacheHits++;
              }
            }
            layerSurface.flush();
            const layerImage = layerSurface.makeImageSnapshot();
            if (!layerImage) {
              addDiagnostic(`skia_mask_snapshot_unsupported:${layer.key}`);
              releaseSurface(surfaceWidth, surfaceHeight, layerSurface);
              continue;
            }
            const operation = firstLayer ? "add" as const : maskLayer.composite;
            const modeKey = operation === "add" ? "SrcOver" : operation === "intersect" ? "DstIn" : operation === "subtract" ? "DstOut" : "Xor";
            const blendMode = kit.BlendMode[modeKey];
            if (blendMode === undefined) {
              addDiagnostic(`skia_mask_composite_unsupported:${layer.key}:${operation}`);
              layerImage.delete();
              releaseSurface(surfaceWidth, surfaceHeight, layerSurface);
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
            releaseSurface(surfaceWidth, surfaceHeight, layerSurface);
            firstLayer = false;
          }
          maskSurface.flush();
          const snapshot = maskSurface.makeImageSnapshot();
          if (!snapshot) addDiagnostic(`skia_mask_snapshot_unsupported:${layer.key}`);
          else {
            if (cachedMaskKey && resources) {
              if (resources.maskCache.size >= 64) {
                const oldest = resources.maskCache.keys().next().value as string | undefined;
                if (oldest !== undefined) {
                  resources.maskCache.get(oldest)?.delete();
                  resources.maskCache.delete(oldest);
                }
              }
              resources.maskCache.set(cachedMaskKey, snapshot);
            }
            const paint = new kit.Paint();
            paint.setAntiAlias(true);
            paint.setStyle(kit.PaintStyle.Fill);
            paint.setAlphaf(1);
            paint.setBlendMode(kit.BlendMode.DstIn);
            canvas.drawImageRect(snapshot, [0, 0, frameWidth, frameHeight], [0, 0, frameWidth, frameHeight], paint, false);
            paint.delete();
            if (!cachedMaskKey || !resources) snapshot.delete();
          }
          releaseSurface(surfaceWidth, surfaceHeight, maskSurface);
        }
        if (!maskSurface?.makeImageSnapshot) {
          if (maskSurface) releaseSurface(surfaceWidth, surfaceHeight, maskSurface);
        }
        }
      }
      if (layer?.noiseEffect && layer.noiseBounds) stats.noiseRegions.push({ effect: layer.noiseEffect, bounds: layer.noiseBounds });
      if (layer?.saved) canvas.restore();
      if (layer?.projectiveFilter && !resources) layer.projectiveFilter.delete();
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
      const activeTransform = pendingTransform;
      const projectiveFilterLayer = layers.at(-1);
      if (activeTransform && projectiveFilterLayer?.projectiveFilter && projectiveFilterLayer.projectiveFilterTransform?.key === activeTransform.key) {
        const commandAlpha = activeTransform.visible && activeTransform.alpha > 0 ? activeTransform.alpha : null;
        pendingTransform = null;
        if (commandAlpha === null) continue;
        const padding = projectiveFilterPadding(projectiveFilterLayer.projectiveFilterProgram);
        const surfaceWidth = Math.max(1, Math.ceil(command.width + padding * 2));
        const surfaceHeight = Math.max(1, Math.ceil(command.height + padding * 2));
        const surface = acquireSurface(surfaceWidth, surfaceHeight);
        let projected = false;
        if (surface?.makeImageSnapshot) {
          const localCanvas = surface.getCanvas();
          localCanvas.clear(kit.TRANSPARENT);
          localCanvas.save();
          localCanvas.concat([1, 0, padding, 0, 1, padding, 0, 0, 1]);
           const fill = createSkiaPaint(kit, command.fill, commandAlpha, kit.PaintStyle.Fill);
           localCanvas.drawRect([0, 0, command.width, command.height], fill);
           fill.delete();
           localCanvas.restore();
          surface.flush();
          const snapshot = surface.makeImageSnapshot();
          if (snapshot && projectionContext) {
             projected = drawProjectiveSnapshotWithFilter(
               kit,
               canvas,
               snapshot,
              surfaceWidth,
              surfaceHeight,
              [-padding, -padding, command.width + padding, command.height + padding],
               activeTransform.matrix4,
               projectionContext,
               projectiveFilterLayer.projectiveFilter,
             );
             snapshot.delete();
          }
        }
        if (surface) releaseSurface(surfaceWidth, surfaceHeight, surface);
        if (projected) {
          stats.drawCalls++;
          continue;
        }
        addDiagnostic(`skia_projective_effect_fallback:${command.key}`);
      }
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
      const projectiveFilterLayer = layers.at(-1);
      if (activeTransform && projectiveFilterLayer?.projectiveFilter && projectiveFilterLayer.projectiveFilterTransform?.key === activeTransform.key) {
        const commandAlpha = activeTransform.visible && activeTransform.alpha > 0 ? activeTransform.alpha : null;
        pendingTransform = null;
        if (commandAlpha === null) continue;
        const padding = projectiveFilterPadding(projectiveFilterLayer.projectiveFilterProgram);
        const surfaceWidth = Math.max(1, Math.ceil(command.width + padding * 2));
        const surfaceHeight = Math.max(1, Math.ceil(command.height + padding * 2));
        const surface = acquireSurface(surfaceWidth, surfaceHeight);
        let projected = false;
        if (surface?.makeImageSnapshot) {
          const localCanvas = surface.getCanvas();
          localCanvas.clear(kit.TRANSPARENT);
          localCanvas.save();
          localCanvas.concat([1, 0, padding, 0, 1, padding, 0, 0, 1]);
           const paintOrder = command.paintOrder ?? ["fill", "stroke", "markers"];
          for (const paintType of paintOrder) {
            if (paintType === "fill") {
              const fill = createSkiaPaint(kit, command.fill, commandAlpha * (command.fillOpacity ?? 1), kit.PaintStyle.Fill, command.fillPaint, command.width, command.height);
              drawShapeGeometry(kit, localCanvas, command, fill);
              fill.delete();
            } else if (paintType === "stroke" && command.stroke) {
              const stroke = createSkiaPaint(kit, command.stroke, commandAlpha * (command.strokeOpacity ?? 1), kit.PaintStyle.Stroke, command.strokePaint, command.width, command.height);
              const strokeEffect = configureStroke(kit, stroke, command);
              drawShapeGeometry(kit, localCanvas, command, stroke);
              strokeEffect?.delete();
              stroke.delete();
            }
          }
           localCanvas.restore();
          surface.flush();
          const snapshot = surface.makeImageSnapshot();
          if (snapshot && projectionContext) {
             projected = drawProjectiveSnapshotWithFilter(
               kit,
               canvas,
               snapshot,
              surfaceWidth,
              surfaceHeight,
              [-padding, -padding, command.width + padding, command.height + padding],
               activeTransform.matrix4,
               projectionContext,
               projectiveFilterLayer.projectiveFilter,
             );
             snapshot.delete();
          }
        }
        if (surface) releaseSurface(surfaceWidth, surfaceHeight, surface);
        if (projected) {
          stats.drawCalls++;
          continue;
        }
        addDiagnostic(`skia_projective_effect_fallback:${command.key}`);
      }
      const projective = activeTransform && projectionContext && hasPerspectiveTerms(activeTransform.matrix4);
      const commandAlpha = beginTransformedCommand(kit, canvas, activeTransform);
      pendingTransform = null;
      if (commandAlpha === null) continue;
      const projectedShape = projective
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
        drawShapeGeometry(kit, canvas, command, paint);
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
      const projective = activeTransform && projectionContext && hasPerspectiveTerms(activeTransform.matrix4);
      const projectiveFilterLayer = layers.at(-1);
      if (activeTransform && projectiveFilterLayer?.projectiveFilter && projectiveFilterLayer.projectiveFilterTransform?.key === activeTransform.key) {
        const commandAlpha = activeTransform.visible && activeTransform.alpha > 0 ? activeTransform.alpha : null;
        pendingTransform = null;
        if (commandAlpha === null) continue;
        const path = kit.Path.MakeFromSVGString(pathSvg(command));
        if (!path) {
          stats.skippedCommands++;
          addDiagnostic(`path:${command.key}`);
          continue;
        }
        const fillType = command.fillRule === "evenodd" ? kit.FillType?.EvenOdd : kit.FillType?.Winding;
        if (fillType !== undefined) path.setFillType?.(fillType);
        const padding = projectiveFilterPadding(projectiveFilterLayer.projectiveFilterProgram);
        const contentWidth = Math.max(1, command.width ?? 1);
        const contentHeight = Math.max(1, command.height ?? 1);
        const surfaceWidth = Math.max(1, Math.ceil(contentWidth + padding * 2));
        const surfaceHeight = Math.max(1, Math.ceil(contentHeight + padding * 2));
        const surface = acquireSurface(surfaceWidth, surfaceHeight);
        let projected = false;
        if (surface?.makeImageSnapshot) {
          const localCanvas = surface.getCanvas();
          localCanvas.clear(kit.TRANSPARENT);
          localCanvas.save();
          localCanvas.concat([1, 0, padding, 0, 1, padding, 0, 0, 1]);
           const paintOrder = command.paintOrder ?? ["fill", "stroke", "markers"];
          for (const paintType of paintOrder) {
            if (paintType === "fill" && command.fill) {
              const fill = createSkiaPaint(kit, command.fill, commandAlpha * (command.fillOpacity ?? 1), kit.PaintStyle.Fill, command.fillPaint, contentWidth, contentHeight);
              localCanvas.drawPath(path, fill);
              fill.delete();
            } else if (paintType === "stroke" && command.stroke) {
              const stroke = createSkiaPaint(kit, command.stroke, commandAlpha * (command.strokeOpacity ?? 1), kit.PaintStyle.Stroke, command.strokePaint, contentWidth, contentHeight);
              const strokeEffect = configureStroke(kit, stroke, command);
              localCanvas.drawPath(path, stroke);
              strokeEffect?.delete();
              stroke.delete();
            }
          }
           localCanvas.restore();
          surface.flush();
          const snapshot = surface.makeImageSnapshot();
          if (snapshot && projectionContext) {
             projected = drawProjectiveSnapshotWithFilter(
               kit,
               canvas,
               snapshot,
              surfaceWidth,
              surfaceHeight,
              [-padding, -padding, contentWidth + padding, contentHeight + padding],
               activeTransform.matrix4,
               projectionContext,
               projectiveFilterLayer.projectiveFilter,
             );
             snapshot.delete();
          }
        }
        path.delete();
        if (surface) releaseSurface(surfaceWidth, surfaceHeight, surface);
        if (projected) {
          stats.drawCalls++;
          continue;
        }
        addDiagnostic(`skia_projective_effect_fallback:${command.key}`);
      }
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
      const projectedFill = projective && command.mesh
        ? projectiveMeshSvg(command.mesh, activeTransform.matrix4, projectionContext)
        : null;
      const projectedStroke = projective && command.strokeMesh
        ? projectiveMeshSvg(command.strokeMesh, activeTransform.matrix4, projectionContext)
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
          if (projectedStroke !== null) {
            const projectedPath = kit.Path.MakeFromSVGString(projectedStroke);
            if (projectedPath) {
              projectedPath.setFillType?.(fillType);
              canvas.drawPath(projectedPath, stroke);
              projectedPath.delete();
            }
          } else {
            canvas.drawPath(path, stroke);
          }
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
      const activeTransform = pendingTransform;
      const projective = activeTransform && projectionContext && hasPerspectiveTerms(activeTransform.matrix4)
        ? { matrix: activeTransform.matrix4, context: projectionContext }
        : undefined;
      const commandAlpha = beginTransformedCommand(kit, canvas, activeTransform, !projective);
      pendingTransform = null;
      if (commandAlpha === null) continue;
      if (command.op === "drawVideo" && command.mediaVisible === false) {
        canvas.restore();
        continue;
      }
      const asset = assets.get(command.assetId);
      const projectiveForTexture = projective
        ? { ...projective, context: { ...projective.context, outputSpace: "screen" as const } }
        : undefined;
      const assetResult = asset
        ? drawAsset(kit, canvas, command, asset, commandAlpha, undefined, projectiveForTexture, resources)
        : false;
      if (!asset || !assetResult || (typeof assetResult !== "boolean" && !assetResult.drawn)) {
        stats.skippedCommands++;
        stats.diagnostics.push(`${command.op}:${command.key}`);
      } else {
        stats.drawCalls++;
        if (typeof assetResult !== "boolean") {
          if (assetResult.imageCacheHit) stats.imageCacheHits++;
          if (assetResult.projectiveMeshCacheHit) stats.projectiveMeshCacheHits++;
          if (assetResult.uploaded) {
            if (command.op === "drawVideo") stats.videoTextureUploads++;
            else stats.textureUploads++;
          }
        } else if (command.op === "drawVideo") stats.videoTextureUploads++;
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
