import { hasPerspectiveTerms, type PaintCommand } from "@motionvideo/motion-runtime";
import type { SkiaCanvas, SkiaCanvasKit, SkiaImage, SkiaImageFilter, SkiaPath } from "../canvas-kit";
import { createSkiaPaint } from "../paint";
import { matrix4ToSkia3x3, pathSvg, polygonSvg, projectiveMeshSvg, projectiveShapeSvg, projectiveTextureMesh, projectiveTextureShaderMatrix, rRectArgs, type SkiaProjectionContext } from "./geometry";
import { drawAsset } from "./images";
import { canDrawNativeTextGlyph, drawNativeTextGlyphRun, drawTextDecoration, drawTextGlyph, drawTextStroke } from "./text";
import { configureStroke } from "./paint";
import type { SkiaReplayResources } from "./types";
import type { ReplayContext } from "./replay-context";

function beginTransformedCommand(
  canvas: SkiaCanvas,
  transform: Extract<PaintCommand, { op: "setTransform" }> | null,
  applyMatrix = true,
): number | null {
  if (transform && (!transform.visible || transform.alpha <= 0)) return null;
  canvas.save();
  if (transform && applyMatrix) canvas.concat(matrix4ToSkia3x3(transform.matrix4));
  return transform?.alpha ?? 1;
}

function isInteger(value: number): boolean {
  return Math.abs(value - Math.round(value)) < 1e-6;
}

/**
 * CSS paints axis-aligned integer rectangles without geometry antialiasing.
 *
 * This matters for compiler-lowered background tiles: Skia's antialiased
 * rectangle edge can add a full extra pixel at every tile boundary when the
 * gradient itself is narrower than one device pixel. Transformed, rounded,
 * and fractional geometry must continue to use antialiasing.
 */
function needsShapeAntialias(
  command: Extract<PaintCommand, { op: "drawShape" }>,
  transform: Extract<PaintCommand, { op: "setTransform" }> | null,
): boolean {
  if (command.shape !== "rectangle" || command.cornerRadius !== undefined) return true;
  if (!transform) return !isInteger(command.width) || !isInteger(command.height);
  const matrix = transform.matrix4;
  return !(
    Math.abs(matrix[0]! - 1) < 1e-6 &&
    Math.abs(matrix[1]!) < 1e-6 &&
    Math.abs(matrix[2]!) < 1e-6 &&
    Math.abs(matrix[3]!) < 1e-6 &&
    Math.abs(matrix[4]!) < 1e-6 &&
    Math.abs(matrix[5]! - 1) < 1e-6 &&
    Math.abs(matrix[6]!) < 1e-6 &&
    Math.abs(matrix[7]!) < 1e-6 &&
    Math.abs(matrix[8]!) < 1e-6 &&
    Math.abs(matrix[9]!) < 1e-6 &&
    Math.abs(matrix[10]! - 1) < 1e-6 &&
    Math.abs(matrix[11]!) < 1e-6 &&
    isInteger(matrix[12]!) &&
    isInteger(matrix[13]!) &&
    Math.abs(matrix[14]!) < 1e-6 &&
    Math.abs(matrix[15]! - 1) < 1e-6 &&
    isInteger(command.width) &&
    isInteger(command.height)
  );
}

function drawShapeGeometry(
  kit: SkiaCanvasKit,
  canvas: SkiaCanvas,
  command: Extract<PaintCommand, { op: "drawShape" }>,
  paint: Parameters<SkiaCanvas["drawRect"]>[1],
): void {
  if (command.shape === "rectangle") {
    if (command.cornerRadius) canvas.drawRRect(rRectArgs(0, 0, command.width, command.height, command.cornerRadius), paint);
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

function cachedPathFor(
  kit: SkiaCanvasKit,
  command: Extract<PaintCommand, { op: "drawPath" }>,
  cache: SkiaReplayResources["pathCache"],
): SkiaPath | null {
  const signature = JSON.stringify(command.contours);
  const cached = cache.get(command.key);
  if (cached?.signature === signature) return cached.path;
  cached?.path.delete();
  const path = kit.Path.MakeFromSVGString(pathSvg(command));
  if (!path) return null;
  cache.set(command.key, { signature, path });
  return path;
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
    // See the identical comment in images.ts: a projective quad minifies
    // unevenly across the surface, so mip sampling is needed to avoid
    // aliasing at the most foreshortened edge.
    kit.MipmapMode?.Linear ?? kit.MipmapMode?.None ?? 0,
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

export function drawSolid(ctx: ReplayContext, command: Extract<PaintCommand, { op: "drawSolid" }>): void {
  const { kit, canvas, stats, layers, projectionContext, addDiagnostic, acquireSurface, releaseSurface } = ctx;
  const activeTransform = ctx.pendingTransform;
  const projectiveFilterLayer = layers.at(-1);
  if (activeTransform && projectiveFilterLayer?.projectiveFilter && projectiveFilterLayer.projectiveFilterTransform?.key === activeTransform.key) {
    const commandAlpha = activeTransform.visible && activeTransform.alpha > 0 ? activeTransform.alpha : null;
    ctx.pendingTransform = null;
    if (commandAlpha === null) return;
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
      return;
    }
    addDiagnostic(`skia_projective_effect_fallback:${command.key}`);
  }
  const commandAlpha = beginTransformedCommand(canvas, ctx.pendingTransform);
  ctx.pendingTransform = null;
  if (commandAlpha === null) return;
  const paint = createSkiaPaint(kit, command.fill, commandAlpha, kit.PaintStyle.Fill);
  canvas.drawRect([0, 0, command.width, command.height], paint);
  paint.delete();
  canvas.restore();
  stats.drawCalls++;
}

export function drawShape(ctx: ReplayContext, command: Extract<PaintCommand, { op: "drawShape" }>): void {
  const { kit, canvas, stats, layers, projectionContext, addDiagnostic, acquireSurface, releaseSurface } = ctx;
  const shapeStartedAt = performance.now();
  const activeTransform = ctx.pendingTransform;
  const projectiveFilterLayer = layers.at(-1);
  if (activeTransform && projectiveFilterLayer?.projectiveFilter && projectiveFilterLayer.projectiveFilterTransform?.key === activeTransform.key) {
    const commandAlpha = activeTransform.visible && activeTransform.alpha > 0 ? activeTransform.alpha : null;
    ctx.pendingTransform = null;
    if (commandAlpha === null) return;
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
      return;
    }
    addDiagnostic(`skia_projective_effect_fallback:${command.key}`);
  }
  const projective = activeTransform && projectionContext && hasPerspectiveTerms(activeTransform.matrix4);
  const commandAlpha = beginTransformedCommand(canvas, activeTransform);
  ctx.pendingTransform = null;
  if (commandAlpha === null) return;
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
      const fill = createSkiaPaint(kit, command.fill, commandAlpha * (command.fillOpacity ?? 1), kit.PaintStyle.Fill, command.fillPaint, command.width, command.height, needsShapeAntialias(command, activeTransform));
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
  stats.shapeTimeMs += performance.now() - shapeStartedAt;
}

export function drawPath(ctx: ReplayContext, command: Extract<PaintCommand, { op: "drawPath" }>): void {
  const { kit, canvas, resources, stats, layers, projectionContext, addDiagnostic, acquireSurface, releaseSurface } = ctx;
  const pathStartedAt = performance.now();
  const activeTransform = ctx.pendingTransform;
  const projective = activeTransform && projectionContext && hasPerspectiveTerms(activeTransform.matrix4);
  const projectiveFilterLayer = layers.at(-1);
  if (activeTransform && projectiveFilterLayer?.projectiveFilter && projectiveFilterLayer.projectiveFilterTransform?.key === activeTransform.key) {
    const commandAlpha = activeTransform.visible && activeTransform.alpha > 0 ? activeTransform.alpha : null;
    ctx.pendingTransform = null;
    if (commandAlpha === null) return;
    const path = cachedPathFor(kit, command, resources?.pathCache ?? new Map());
    if (!path) {
      stats.skippedCommands++;
      addDiagnostic(`path:${command.key}`);
      return;
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
    if (surface) releaseSurface(surfaceWidth, surfaceHeight, surface);
    if (projected) {
      stats.drawCalls++;
      return;
    }
    addDiagnostic(`skia_projective_effect_fallback:${command.key}`);
  }
  const commandAlpha = beginTransformedCommand(canvas, activeTransform);
  ctx.pendingTransform = null;
  if (commandAlpha === null) return;
  const path = cachedPathFor(kit, command, resources?.pathCache ?? new Map());
  if (!path) {
    stats.skippedCommands++;
    stats.diagnostics.push(`path:${command.key}`);
    canvas.restore();
    return;
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
  canvas.restore();
  stats.pathTimeMs += performance.now() - pathStartedAt;
  stats.drawCalls++;
}

export function drawText(ctx: ReplayContext, command: Extract<PaintCommand, { op: "drawText" }>): void {
  const { kit, canvas, assets, fontFor, stats } = ctx;
  const textStartedAt = performance.now();
  const commandAlpha = beginTransformedCommand(canvas, ctx.pendingTransform);
  ctx.pendingTransform = null;
  if (commandAlpha === null) return;
  let drawn = 0;
  let colorFallbacks = 0;
  const fillPaints = new Map<string, ReturnType<typeof createSkiaPaint>>();
  const batchedFillGlyphs = new Set<number>();
  const paintSignature = (paint: unknown): string => paint ? JSON.stringify(paint) : "";
  const paintOrder = command.paintOrder ?? ["fill", "stroke", "markers"];
  if (paintOrder[0] === "fill") {
    const glyphs = command.glyphs ?? [];
    for (let start = 0; start < glyphs.length;) {
      const first = glyphs[start]!;
      const color = first.fill ?? command.fill ?? "#000000";
      const firstPaint = first.fillPaint ?? command.fillPaint;
      const firstPaintSignature = paintSignature(firstPaint);
      const fontAssetId = first.fontAssetId ?? command.fontAssetId;
      const fontSize = first.fontSize ?? command.fontSize;
      let end = start + 1;
      while (end < glyphs.length) {
        const candidate = glyphs[end]!;
        if (!canDrawNativeTextGlyph(candidate)
          || (candidate.fill ?? command.fill ?? "#000000") !== color
          || paintSignature(candidate.fillPaint ?? command.fillPaint) !== firstPaintSignature
          || (candidate.fontAssetId ?? command.fontAssetId) !== fontAssetId
          || (candidate.fontSize ?? command.fontSize) !== fontSize) break;
        end += 1;
      }
      if (end - start >= 2 && canDrawNativeTextGlyph(first)) {
        const paintKey = `${color}\0${firstPaintSignature}\0${commandAlpha}`;
        let sharedPaint = fillPaints.get(paintKey);
        if (!sharedPaint) {
          sharedPaint = createSkiaPaint(kit, color, commandAlpha, kit.PaintStyle.Fill, firstPaint, command.width, command.height);
          fillPaints.set(paintKey, sharedPaint);
        }
        if (drawNativeTextGlyphRun(kit, canvas, command, glyphs.slice(start, end), sharedPaint, fontFor)) {
          for (let index = start; index < end; index += 1) batchedFillGlyphs.add(index);
          drawn += end - start;
          stats.nativeTextGlyphs += end - start;
        }
      }
      start = end;
    }
  }
  for (const [glyphIndex, glyph] of (command.glyphs ?? []).entries()) {
    for (const paintType of paintOrder) {
      if (paintType === "fill") {
        if (batchedFillGlyphs.has(glyphIndex)) continue;
        const color = glyph.fill ?? command.fill ?? "#000000";
        const glyphPaint = glyph.fillPaint ?? command.fillPaint;
        const paintKey = `${color}\0${paintSignature(glyphPaint)}\0${commandAlpha}`;
        let sharedPaint = fillPaints.get(paintKey);
        if (!sharedPaint) {
          sharedPaint = createSkiaPaint(kit, color, commandAlpha, kit.PaintStyle.Fill, glyphPaint, command.width, command.height);
          fillPaints.set(paintKey, sharedPaint);
        }
        const result = drawTextGlyph(kit, canvas, command, glyph, glyphIndex, commandAlpha, assets, fontFor, sharedPaint);
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
  for (const paint of fillPaints.values()) paint.delete();
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
  stats.textTimeMs += performance.now() - textStartedAt;
}

export function drawMedia(ctx: ReplayContext, command: Extract<PaintCommand, { op: "drawImage" }> | Extract<PaintCommand, { op: "drawVideo" }>): void {
  const { kit, canvas, assets, resources, stats, projectionContext } = ctx;
  const activeTransform = ctx.pendingTransform;
  const projective = activeTransform && projectionContext && hasPerspectiveTerms(activeTransform.matrix4)
    ? { matrix: activeTransform.matrix4, context: projectionContext }
    : undefined;
  const commandAlpha = beginTransformedCommand(canvas, activeTransform, !projective);
  ctx.pendingTransform = null;
  if (commandAlpha === null) return;
  if (command.op === "drawVideo" && command.mediaVisible === false) {
    canvas.restore();
    return;
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
}
