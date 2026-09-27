import { hasPerspectiveTerms, type PaintCommand } from "@motionvideo/motion-runtime";
import type { SkiaAsset } from "../types";
import { boundsToRect, compositionBounds, drawCommandBounds, expandBounds, matrix4ToSkia3x3, transformForSkiaCanvas, unionBounds, type SkiaProjectionContext } from "./geometry";
import { cssBlurRadiusToSkiaSigma, effectFilterExpansionPadding, effectFilterFor } from "./effects";
import { applyClipPath, drawMaskSource, type MaskSource } from "./masks";
import { blendModeFor } from "./paint";
import type { ReplayLayer } from "./types";
import type { ReplayContext } from "./replay-context";
import { boxShadowOverlayBranches, drawBoxEffect } from "./box-effect";

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

/**
 * Extra pixels the backdrop saveLayer must capture so a CSS blur kernel can
 * sample content just outside the owner. Output is still hard-clipped to the
 * element bounds; this only widens the offscreen/input region.
 */
function backdropFilterPadding(
  program: Extract<PaintCommand, { op: "beginLayer" }>['backdropEffectProgram'],
): number {
  if (!program) return 0;
  let padding = 0;
  for (const op of program.ops) {
    if (op.kind === "blur") {
      const sigma = cssBlurRadiusToSkiaSigma(op.radius);
      padding = Math.max(padding, Math.ceil(sigma * 3 + 1));
    }
  }
  return padding;
}

/**
 * Union the drawable content bounds inside a beginLayer..endLayer scope.
 * Backdrop filters must be clipped to this element region; using the full
 * frame lets the blurred backdrop bleed outside the owner.
 */
function layerContentBounds(
  commands: readonly PaintCommand[],
  beginIndex: number,
  layerKey: string,
  projectionContext: SkiaProjectionContext | undefined,
): { left: number; top: number; right: number; bottom: number } | undefined {
  let depth = 0;
  let pending: Extract<PaintCommand, { op: "setTransform" }> | null = null;
  let bounds: { left: number; top: number; right: number; bottom: number } | undefined;
  for (let index = beginIndex + 1; index < commands.length; index += 1) {
    const command = commands[index]!;
    if (command.op === "beginLayer" || command.op === "beginGroup") {
      depth += 1;
      continue;
    }
    if (command.op === "endLayer" || command.op === "endGroup") {
      if (depth === 0) {
        if (command.op === "endLayer" && command.key === layerKey) break;
        break;
      }
      depth -= 1;
      pending = null;
      continue;
    }
    if (depth > 0) continue;
    if (command.op === "setTransform") {
      pending = projectionContext ? transformForSkiaCanvas(command, projectionContext) : command;
      continue;
    }
    if (!["drawPath", "drawShape", "drawSolid", "drawText", "drawImage", "drawVideo"].includes(command.op)) continue;
    const next = drawCommandBounds(command, pending);
    pending = null;
    if (next) bounds = unionBounds(bounds, next);
  }
  return bounds;
}

function effectFilterForCached(ctx: ReplayContext, program: Extract<PaintCommand, { op: "beginLayer" }>['effectProgram']) {
  const { kit, resources, stats } = ctx;
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
      const evicted = resources.filterCache.get(oldest);
      evicted?.filter?.delete();
      evicted?.tailFilter?.delete();
      resources.filterCache.delete(oldest);
    }
  }
  resources.filterCache.set(key, created);
  return created;
}

/**
 * CSS confines a filtered backdrop to the element's rounded border box
 * (Filter Effects 2), but never clips the element's children unless it has
 * `overflow: hidden`. The backdrop saveLayer above is only clipped to a
 * rectangle - the union of all drawable content, overflowing children
 * included - so without this the filtered backdrop shows through as square
 * corners outside border-radius (clearly visible once a dark box-shadow halo
 * sits in those corners) and under any child that overflows the box.
 * Clearing the layer outside the box right after the backdrop is captured -
 * before any content is drawn - fixes both without clipping later content.
 */
function confineBackdropToBox(ctx: ReplayContext, box: NonNullable<Extract<PaintCommand, { op: "beginLayer" }>["backdropBox"]>): void {
  const { kit, canvas, addDiagnostic } = ctx;
  if (!canvas.clipPath || kit.ClipOp.Difference === undefined) {
    addDiagnostic("skia_backdrop_box_clip_unsupported");
    return;
  }
  const { width, height } = box;
  const radius = Math.max(0, Math.min(box.cornerRadius ?? 0, width / 2, height / 2));
  const svg = radius > 0
    ? `M${radius} 0H${width - radius}A${radius} ${radius} 0 0 1 ${width} ${radius}V${height - radius}A${radius} ${radius} 0 0 1 ${width - radius} ${height}H${radius}A${radius} ${radius} 0 0 1 0 ${height - radius}V${radius}A${radius} ${radius} 0 0 1 ${radius} 0Z`
    : `M0 0H${width}V${height}H0Z`;
  const path = kit.Path.MakeFromSVGString(svg);
  if (!path) return;
  canvas.save();
  canvas.concat(matrix4ToSkia3x3(box.matrix4));
  canvas.clipPath(path, kit.ClipOp.Difference, true);
  canvas.clear(kit.TRANSPARENT);
  canvas.restore();
  path.delete();
}

export function beginLayer(ctx: ReplayContext, command: Extract<PaintCommand, { op: "beginLayer" }>, commandIndex: number): void {
  const { kit, canvas, buffer, resources, stats, layers, layerTransforms, frameWidth, frameHeight, projectionContext, semanticSources, isBlocked, addDiagnostic } = ctx;
  const layerStartedAt = performance.now();
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
  const effectFilter = effectFilterForCached(ctx, command.effectProgram);
  const backdropEffectFilter = effectFilterForCached(ctx, command.backdropEffectProgram);
   // CSS filter effects on a projective layer are handled by the explicit
   // screen-space surface path below. Keeping the filter off the parent
   // saveLayer prevents Skia from filtering an unprojected local frame.
  const projectiveFilter = projectiveFilterTransform && hasPerspectiveTerms(projectiveFilterTransform.matrix4)
    ? effectFilter.filter
    : undefined;
  // css-effects-roadmap.md 1.2b: a backdrop-filter's pre-saveLayer clip
  // (see below) is fatal to a box-shadow rendered the "ordinary" way -
  // as a DropShadow ImageFilter installed directly on this same
  // saveLayer's paint - because that filter's output (which
  // deliberately expands past the owner's own bounds) restores while
  // the clip is still active, silently cutting the halo off at the
  // owner's edge. sourceOnly box-shadows (mixed lists, insets) already
  // route around this via drawBoxEffect's isolated-mask compositor
  // instead of a saveLayer-paint filter; force the SAME routing for an
  // ordinary single box-shadow whenever a backdrop-filter is also
  // present on this layer, using the same branch parser
  // (boxShadowOverlayBranches) drawBoxEffect itself uses to confirm
  // there is real box-shadow content to route.
  const boxEffectActive = !projectiveFilter && Boolean(
    effectFilter.sourceOnly || (backdropEffectFilter.filter && boxShadowOverlayBranches(command.effectProgram)),
  );
  const layer: ReplayLayer = {
    key: command.key,
    saved: false,
    blocked: isBlocked(),
    clipSourceKeys,
    maskMode: command.mask?.mode === "alpha" || command.mask?.mode === "luma" ? command.mask.mode : undefined,
    maskSourceKeys,
    maskLayers: command.mask?.layers?.flatMap((maskLayer) => maskLayer.mode === "clip" ? [] : [{ mode: maskLayer.mode, sourceKeys: maskLayer.sourceKeys, composite: maskLayer.composite }]),
    // A noise op is a separate CPU pass applied after readback (see
    // `applyNoise` in backend.ts), independent of position within the
    // effect program, so it is found rather than required to be the sole op.
    noiseEffect: command.effectProgram?.ops.find((op) => op.kind === "noise"),
    projectiveFilterTransform,
    projectiveFilter,
    projectiveFilterProgram: projectiveFilter ? command.effectProgram : undefined,
    boxEffectFilter: boxEffectActive ? effectFilter.filter : undefined,
    boxEffectProgram: boxEffectActive ? command.effectProgram : undefined,
    boxEffectSource: boxEffectActive ? command.effectBox : undefined,
    backdropFilter: backdropEffectFilter.filter,
    backdropFilterProgram: backdropEffectFilter.filter ? command.backdropEffectProgram : undefined,
  };
  layers.push(layer);
  if (command.effectProgram && !effectFilter.supported) addDiagnostic(`skia_effect_unsupported:${command.key}`);
  if (command.backdropEffectProgram && !backdropEffectFilter.supported) addDiagnostic(`skia_backdrop_filter_unsupported:${command.key}`);
  // CSS masks are rendered into a separate coverage surface at endLayer.
  // Keeping this out of saveLayer alpha is important for gradients and
  // for subtract/exclude, which cannot be represented by one scalar.
  const shouldSaveLayer = command.offscreen || command.isolation || command.compositeAlpha !== undefined || Boolean(effectFilter.filter && !projectiveFilter) || Boolean(effectFilter.sourceOnly && !projectiveFilter) || Boolean(command.backdropEffectProgram) || (command.blendMode !== undefined && command.blendMode !== "normal");
  if (shouldSaveLayer) {
    const paint = new kit.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(kit.PaintStyle.Fill);
    // compositeAlpha is applied exactly once here when the layer restores;
    // drawable paints inside the layer keep alpha 1 for isolated groups.
    paint.setAlphaf(Math.max(0, Math.min(1, command.compositeAlpha ?? 1)));
    paint.setBlendMode(blendModeFor(kit, command.blendMode));
    // Non-projective layers keep the compact saveLayer path. Projective
    // layers apply their filter after projection in the draw branches —
    // never install the same filter on this parent saveLayer.
    // A box-effect-active box-shadow's own `filter` never goes here
    // either (its pixels come from drawBoxEffect instead, per
    // boxEffectActive above) - but `tailFilter` does: a
    // `box-shadow: ...; filter: blur(...);` combination keeps the shadow
    // box-effect-active while still needing that trailing CSS filter
    // applied to the whole composited layer (owner + every shadow halo,
    // both drawn inside this same saveLayer) once it restores.
    const layerFilter = projectiveFilter ? null : boxEffectActive ? (effectFilter.tailFilter ?? null) : effectFilter.filter;
    if (layerFilter && paint.setImageFilter) paint.setImageFilter(layerFilter);
    // Bound kinds (Phase 5):
    // - layer content bounds: union of drawable geometry inside the layer
    // - filter-expanded bounds: content + blur/shadow expansion
    // - composition bounds: full frame fallback / isolation without filter
    // Backdrop filters clip to content and pad saveLayer for sampling.
    // Foreground filters use filter-expanded bounds so shadows/blurs are
    // not cropped, without always allocating the full composition.
    const frameBounds = compositionBounds(frameWidth, frameHeight);
    const boxEffectFilter = boxEffectActive ? effectFilter.filter : null;
    // css-effects-roadmap.md 1.2b: the backdrop-filter clip pushed just
    // below is scoped to the owner's own content bounds, to keep the
    // sampled backdrop from leaking past the box's shape. Skia clips can
    // only narrow within a save/restore scope - there is no way to
    // "unclip" a box-shadow halo once it is drawn inside that scope, so
    // drawing it at the normal endLayer timing (inside the clip) cuts
    // the halo off entirely and silently, with no diagnostic. Draw it
    // now instead, before that clip exists. Its position only depends on
    // effectBox's own matrix4 (applied via an explicit canvas.concat
    // inside drawBoxEffect, not ambient transform state), so calling it
    // here instead of at endLayer produces identical geometry - only the
    // clip state around it differs, which is exactly the point.
    if (boxEffectActive && backdropEffectFilter.filter) {
      drawBoxEffect(ctx, layer);
      layer.boxEffectDrawnEarly = true;
    }
    const contentBounds = (command.offscreen || command.isolation || command.compositeAlpha !== undefined
      || backdropEffectFilter.filter || layerFilter || boxEffectFilter || boxEffectActive)
      ? layerContentBounds(buffer.commands, commandIndex, command.key, projectionContext)
      : undefined;
    let saveBounds = boundsToRect(frameBounds);
    if (backdropEffectFilter.filter) {
      const clipBounds = contentBounds ? boundsToRect(contentBounds) : undefined;
      // The backdrop is sampled while saveLayer is installed. Keep every
      // owner clip active before that point: a rectangular bounds clip
      // contains blur expansion, while a semantic rounded clip prevents
      // the filtered backdrop from leaking into transparent corners.
      if (clipBounds || command.clipPath) {
        canvas.save();
        layer.backdropClip = true;
        if (clipBounds) canvas.clipRect(clipBounds, kit.ClipOp.Intersect, false);
        if (command.clipPath) {
          const sources = command.clipPath.sourceKeys ?? [command.clipPath.sourceKey];
          let applied = true;
          for (const sourceKey of sources) {
            const source = semanticSources.get(sourceKey);
            if (!source || !applyClipPath(kit, canvas, source, projectionContext)) {
              addDiagnostic(`skia_clip_path_unsupported:${command.key}:${sourceKey}`);
              applied = false;
            }
          }
          layer.backdropClipPathApplied = applied;
        }
      }
      const pad = clipBounds ? backdropFilterPadding(command.backdropEffectProgram) : 0;
      saveBounds = clipBounds
        ? [clipBounds[0] - pad, clipBounds[1] - pad, clipBounds[2] + pad, clipBounds[3] + pad]
        : boundsToRect(frameBounds);
    } else if (contentBounds && (!command.backdropEffectProgram || backdropEffectFilter.filter)) {
      // Group opacity/isolation still needs a saveLayer, but it does not
      // need a full-composition offscreen surface. Restricting the layer
      // to its authored draw bounds avoids allocating and restoring a
      // 1920x1080 surface for small cards, glows, and text groups.
      const pad = layerFilter || boxEffectFilter
        ? effectFilterExpansionPadding(command.effectProgram)
        : 0;
      saveBounds = boundsToRect(expandBounds(contentBounds, pad));
    }
    canvas.saveLayer(paint, saveBounds, backdropEffectFilter.filter);
    paint.delete();
    if (backdropEffectFilter.filter && command.backdropBox && !layer.backdropClipPathApplied) {
      confineBackdropToBox(ctx, command.backdropBox);
    }
    if (!resources && !projectiveFilter && !effectFilter.sourceOnly) effectFilter.filter?.delete();
    // tailFilter (see layerFilter above) is always consumed here on the
    // saveLayer paint, unlike `filter` which a sourceOnly box-shadow
    // keeps alive for drawBoxEffect to use later at endLayer.
    if (!resources) effectFilter.tailFilter?.delete();
    if (!resources) backdropEffectFilter.filter?.delete();
  } else {
    canvas.save();
  }
  layer.saved = true;
  if (command.clipPath && !layer.backdropClipPathApplied) {
    const sources = command.clipPath.sourceKeys ?? [command.clipPath.sourceKey];
    for (const sourceKey of sources) {
      const source = semanticSources.get(sourceKey);
      if (!source || !applyClipPath(kit, canvas, source, projectionContext)) addDiagnostic(`skia_clip_path_unsupported:${command.key}:${sourceKey}`);
    }
  }
  stats.layerTimeMs += performance.now() - layerStartedAt;
}

export function endLayer(ctx: ReplayContext): void {
  const { kit, canvas, assets, deviceScale, resources, stats, layers, frameWidth, frameHeight, graphId, projectionContext, semanticSources, addDiagnostic, acquireSurface, releaseSurface } = ctx;
  const endLayerStartedAt = performance.now();
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
  if (layer?.boxEffectProgram && layer.boxEffectSource) {
    if (!layer.boxEffectDrawnEarly) drawBoxEffect(ctx, layer);
    if (!resources) layer.boxEffectFilter?.delete();
  }
  if (layer?.saved) {
    canvas.restore();
    // Pop the backdrop paint-containment clip pushed around saveLayer.
    if (layer.backdropClip) canvas.restore();
  }
  if (layer?.projectiveFilter && !resources) layer.projectiveFilter.delete();
  ctx.pendingTransform = null;
  stats.endLayerTimeMs += performance.now() - endLayerStartedAt;
}
