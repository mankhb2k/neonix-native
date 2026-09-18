import { hasPerspectiveTerms, type PaintCommandBuffer, type PaintCommand, type RuntimeEffectOp } from "@motionvideo/motion-runtime";
import { cssColorToRgba } from "../color";
import type { SkiaCanvas, SkiaCanvasKit, SkiaImage, SkiaImageFilter } from "../canvas-kit";
import type { SkiaAsset } from "../types";
import { createSkiaPaint } from "../paint";
import { boundsToRect, compositionBounds, drawCommandBounds, expandBounds, matrix4ToSkia3x3, pathSvg, polygonSvg, projectiveMeshSvg, projectiveShapeSvg, projectiveTextureMesh, projectiveTextureShaderMatrix, rRectArgs, transformForSkiaCanvas, unionBounds, type SkiaProjectionContext } from "./geometry";
import { cssBlurRadiusToSkiaSigma, cssShadowBlurRadiusToSkiaSigma, effectFilterExpansionPadding, effectFilterFor } from "./effects";
import { applyClipPath, drawMaskSource, sourcePathCommands, type MaskSource } from "./masks";
import { drawAsset } from "./images";
import { canDrawNativeTextGlyph, drawNativeTextGlyphRun, drawTextDecoration, drawTextGlyph, drawTextStroke } from "./text";
import { blendModeFor, configureStroke } from "./paint";
import type { ReplayLayer, SkiaFontResolver, SkiaReplayResources, SkiaReplayStats } from "./types";

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
): import("../canvas-kit").SkiaPath | null {
  const signature = JSON.stringify(command.contours);
  const cached = cache.get(command.key);
  if (cached?.signature === signature) return cached.path;
  cached?.path.delete();
  const path = kit.Path.MakeFromSVGString(pathSvg(command));
  if (!path) return null;
  cache.set(command.key, { signature, path });
  return path;
}

function tintEffectColor(kit: SkiaCanvasKit, color: string, opacity: number): unknown {
  const [red, green, blue, alpha] = cssColorToRgba(color);
  return kit.Color(red * 255, green * 255, blue * 255, Math.max(0, Math.min(1, alpha * opacity)));
}

type BoxShadowOverlayBranch = {
  kind: "outer" | "inner";
  blur: Extract<RuntimeEffectOp, { kind: "blur" }>;
  tint: Extract<RuntimeEffectOp, { kind: "tint" }>;
  offset?: Extract<RuntimeEffectOp, { kind: "offset" }>;
};

function boxShadowOverlayBranches(
  program: Extract<PaintCommand, { op: "beginLayer" }>['effectProgram'],
): BoxShadowOverlayBranch[] | null {
  if (!program) return null;
  const branches: BoxShadowOverlayBranch[] = [];
  let index = 0;
  while (index < program.ops.length) {
    const alpha = program.ops[index];
    if (alpha?.kind !== "alpha-mask" || alpha.input !== "source" || alpha.source !== "box") return null;

    const maybeOffset = program.ops[index + 1];
    const hasOffset = maybeOffset?.kind === "offset";
    const blur = program.ops[index + (hasOffset ? 2 : 1)];
    if (blur?.kind !== "blur") return null;

    const maybeInner = program.ops[index + (hasOffset ? 3 : 2)];
    if (maybeInner?.kind === "inner-alpha") {
      const tint = program.ops[index + (hasOffset ? 4 : 3)];
      const composite = program.ops[index + (hasOffset ? 5 : 4)];
      if (
        maybeInner.source !== alpha.output ||
        maybeInner.blurred !== blur.output ||
        tint?.kind !== "tint" ||
        composite?.kind !== "composite" ||
        composite.source !== tint.output ||
        composite.mode !== "source-over"
      ) return null;
      branches.push({
        kind: "inner",
        blur,
        tint,
        ...(hasOffset ? { offset: maybeOffset } : {}),
      });
      index += hasOffset ? 6 : 5;
      continue;
    }

    const tint = program.ops[index + (hasOffset ? 3 : 2)];
    const offset = program.ops[index + (hasOffset ? 4 : 3)];
    const composite = program.ops[index + (hasOffset ? 5 : 4)];
    if (
      tint?.kind !== "tint" ||
      offset?.kind !== "offset" ||
      composite?.kind !== "composite" ||
      composite.mode !== "source-over"
    ) return null;
    branches.push({ kind: "outer", blur, tint, offset });
    index += 5;
  }
  return branches.length > 0 ? branches : null;
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
  const stats: SkiaReplayStats = {
    drawCalls: 0,
    textTimeMs: 0,
    layerTimeMs: 0,
    endLayerTimeMs: 0,
    pathTimeMs: 0,
    shapeTimeMs: 0,
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
  const drawBoxEffect = (layer: ReplayLayer): void => {
    const filter = layer.boxEffectFilter;
    const source = layer.boxEffectSource;
    const program = layer.boxEffectProgram;
    const boxBranches = boxShadowOverlayBranches(program);
    if ((!filter && !boxBranches) || !source) {
      if (filter && !source) addDiagnostic(`skia_box_effect_source_missing:${layer.key}`);
      return;
    }
    if (boxBranches) {
      // Box-shadow filters are overlays. The owner is already rendered by the
      // normal layer path; feeding a white synthetic mask into a source-bearing
      // ImageFilter makes black owners turn into opaque white rectangles. Build
      // every branch from an isolated mask and composite only the resulting
      // halo images, in reverse order because the first CSS shadow is on top.
      const pad = effectFilterExpansionPadding(program);
      const localWidth = source.width + pad * 2;
      const localHeight = source.height + pad * 2;
      const surfaceWidth = Math.max(1, Math.ceil(localWidth * deviceScale));
      const surfaceHeight = Math.max(1, Math.ceil(localHeight * deviceScale));
      // Keep these surfaces alive until every snapshot has been composited.
      // A pooled surface can be reacquired by the next shadow branch while a
      // previous makeImageSnapshot is still being used, which overwrites the
      // first halo and makes an inner-first/multi-outer list look incomplete.
      const maskSurface = kit.MakeSurface(surfaceWidth, surfaceHeight);
      if (!maskSurface?.makeImageSnapshot) {
        addDiagnostic(`skia_box_effect_mask_surface_unsupported:${layer.key}`);
        if (maskSurface) maskSurface.dispose();
        return;
      }
      const maskCanvas = maskSurface.getCanvas();
      maskCanvas.clear(kit.TRANSPARENT);
      if (deviceScale !== 1) maskCanvas.concat([deviceScale, 0, 0, 0, deviceScale, 0, 0, 0, 1]);
      const maskPaint = createSkiaPaint(kit, "#ffffff", 1, kit.PaintStyle.Fill, undefined, source.width, source.height, true);
      const radius = Math.max(0, Math.min(source.cornerRadius ?? 0, Math.min(source.width, source.height) / 2));
      if (radius > 0) maskCanvas.drawRRect(rRectArgs(pad, pad, pad + source.width, pad + source.height, radius), maskPaint);
      else maskCanvas.drawRect([pad, pad, pad + source.width, pad + source.height], maskPaint);
      maskPaint.delete();
      maskSurface.flush();
      const maskImage = maskSurface.makeImageSnapshot();
      if (!maskImage) {
        addDiagnostic(`skia_box_effect_mask_snapshot_unsupported:${layer.key}`);
        maskSurface.dispose();
        return;
      }

      try {
        // CSS paints the first listed shadow on top of later shadows. Raster
        // and composite one branch at a time in reverse list order so a
        // CanvasKit snapshot can never be invalidated by the next branch.
        for (let index = boxBranches.length - 1; index >= 0; index -= 1) {
          const branch = boxBranches[index]!;
          const blurSurface = kit.MakeSurface(surfaceWidth, surfaceHeight);
          const branchSurface = kit.MakeSurface(surfaceWidth, surfaceHeight);
          if (!blurSurface || !branchSurface?.makeImageSnapshot) {
            addDiagnostic(`skia_box_effect_surface_unavailable:${layer.key}`);
            blurSurface?.dispose();
            branchSurface?.dispose();
            return;
          }

          const blurCanvas = blurSurface.getCanvas();
          blurCanvas.clear(kit.TRANSPARENT);
          if (deviceScale !== 1) blurCanvas.concat([deviceScale, 0, 0, 0, deviceScale, 0, 0, 0, 1]);
          const blurFilter = kit.ImageFilter.MakeBlur(
            cssShadowBlurRadiusToSkiaSigma(branch.blur.radius),
            cssShadowBlurRadiusToSkiaSigma(branch.blur.radius),
            kit.TileMode.Decal,
            null,
          );
          if (!blurFilter) {
            addDiagnostic(`skia_box_effect_blur_unsupported:${layer.key}`);
            return;
          }
          const blurPaint = new kit.Paint();
          blurPaint.setAntiAlias(true);
          blurPaint.setStyle(kit.PaintStyle.Fill);
          blurPaint.setAlphaf(1);
          blurPaint.setBlendMode(kit.BlendMode.SrcOver);
          blurPaint.setImageFilter?.(blurFilter);
          const offset = branch.offset;
          blurCanvas.save();
          if (offset && (offset.x !== 0 || offset.y !== 0)) {
            blurCanvas.concat([1, 0, offset.x, 0, 1, offset.y, 0, 0, 1]);
          }
          blurCanvas.drawImageRect(maskImage, [0, 0, surfaceWidth, surfaceHeight], [0, 0, localWidth, localHeight], blurPaint, false);
          blurCanvas.restore();
          blurPaint.delete();
          blurFilter.delete();
          blurSurface.flush();
          const blurImage = blurSurface.makeImageSnapshot?.();
          if (!blurImage) {
            addDiagnostic(`skia_box_effect_blur_snapshot_unsupported:${layer.key}`);
            return;
          }

          const branchCanvas = branchSurface.getCanvas();
          branchCanvas.clear(kit.TRANSPARENT);
          const branchPaint = new kit.Paint();
          branchPaint.setAntiAlias(true);
          branchPaint.setStyle(kit.PaintStyle.Fill);
          branchPaint.setAlphaf(1);
          branchPaint.setBlendMode(kit.BlendMode.SrcOver);
          if (branch.kind === "outer") {
            // CanvasKit's DropShadowOnly uses the same edge construction as
            // the single CSS box-shadow path. Prefer it for outer branches;
            // blur(mask)-mask narrows the edge profile when several shadows
            // are replayed from one synthetic mask.
            const offset = branch.offset ?? { x: 0, y: 0 };
            const outerFilter = kit.ImageFilter.MakeDropShadowOnly?.(
              offset.x,
              offset.y,
              cssShadowBlurRadiusToSkiaSigma(branch.blur.radius),
              cssShadowBlurRadiusToSkiaSigma(branch.blur.radius),
              tintEffectColor(kit, "#ffffff", 1),
              null,
            ) ?? null;
            if (outerFilter) {
              branchPaint.setImageFilter?.(outerFilter);
              branchCanvas.drawImageRect(maskImage, [0, 0, surfaceWidth, surfaceHeight], [0, 0, localWidth, localHeight], branchPaint, false);
              branchPaint.setImageFilter?.(null);
              // DropShadowOnly follows the backend shadow profile but can
              // retain coverage on the owner edge/interior. CSS outer shadow
              // is overlay-only, so subtract the unblurred owner silhouette.
              branchPaint.setBlendMode(kit.BlendMode.DstOut);
              branchCanvas.drawImageRect(maskImage, [0, 0, surfaceWidth, surfaceHeight], [0, 0, localWidth, localHeight], branchPaint, false);
              outerFilter.delete();
            } else {
              branchCanvas.drawImageRect(blurImage, [0, 0, surfaceWidth, surfaceHeight], [0, 0, localWidth, localHeight], branchPaint, false);
              branchPaint.setBlendMode(kit.BlendMode.DstOut);
              branchCanvas.drawImageRect(maskImage, [0, 0, surfaceWidth, surfaceHeight], [0, 0, localWidth, localHeight], branchPaint, false);
            }
          } else {
            branchCanvas.drawImageRect(maskImage, [0, 0, surfaceWidth, surfaceHeight], [0, 0, localWidth, localHeight], branchPaint, false);
            branchPaint.setBlendMode(kit.BlendMode.DstOut);
            branchCanvas.drawImageRect(blurImage, [0, 0, surfaceWidth, surfaceHeight], [0, 0, localWidth, localHeight], branchPaint, false);
          }
          branchPaint.delete();
          branchSurface.flush();
          const branchImage = branchSurface.makeImageSnapshot();
          blurImage.delete();
          if (!branchImage) {
            blurSurface.dispose();
            branchSurface.dispose();
            addDiagnostic(`skia_box_effect_branch_snapshot_unsupported:${layer.key}`);
            return;
          }
          const [red, green, blue, alpha] = cssColorToRgba(branch.tint.color);
          const isOpaqueWhite = red === 1 && green === 1 && blue === 1 && alpha * branch.tint.opacity === 1;
          const colorFilter = !isOpaqueWhite && kit.ColorFilter?.MakeBlend
            ? kit.ColorFilter.MakeBlend(
                tintEffectColor(kit, branch.tint.color, branch.tint.opacity),
                kit.BlendMode.SrcIn,
              )
            : null;
          const tintFilter = colorFilter && kit.ImageFilter.MakeColorFilter
            ? kit.ImageFilter.MakeColorFilter(colorFilter, null)
            : null;
          const paint = new kit.Paint();
          paint.setAntiAlias(true);
          paint.setStyle(kit.PaintStyle.Fill);
          paint.setAlphaf(1);
          paint.setBlendMode(kit.BlendMode.SrcOver);
          paint.setImageFilter?.(tintFilter);
          canvas.save();
          canvas.concat(matrix4ToSkia3x3(source.matrix4));
          canvas.drawImageRect(
            branchImage,
            [0, 0, surfaceWidth, surfaceHeight],
            [-pad, -pad, localWidth - pad, localHeight - pad],
            paint,
            false,
          );
          canvas.restore();
          paint.delete();
          tintFilter?.delete();
          colorFilter?.delete();
          branchImage.delete();
          blurSurface.dispose();
          branchSurface.dispose();
        }
      } finally {
        maskImage.delete();
        maskSurface.dispose();
      }
      return;
    }
    const blurOp = program?.ops.find((op): op is Extract<RuntimeEffectOp, { kind: "blur" }> => op.kind === "blur");
    const tintOp = program?.ops.find((op): op is Extract<RuntimeEffectOp, { kind: "tint" }> => op.kind === "tint");
    const hasOffset = program?.ops.some((op) => op.kind === "offset") ?? false;
    const directInset = Boolean(
      program &&
      program.ops.map((op) => op.kind).join(",") === "alpha-mask,blur,inner-alpha,tint,composite" &&
      blurOp &&
      tintOp &&
      !hasOffset,
    );
    if (directInset && blurOp && tintOp) {
      const pad = Math.ceil(cssShadowBlurRadiusToSkiaSigma(blurOp.radius) * 3 + 1);
      const localWidth = source.width + pad * 2;
      const localHeight = source.height + pad * 2;
      const surfaceWidth = Math.max(1, Math.ceil(localWidth * deviceScale));
      const surfaceHeight = Math.max(1, Math.ceil(localHeight * deviceScale));
      const maskSurface = acquireSurface(surfaceWidth, surfaceHeight);
      const blurSurface = acquireSurface(surfaceWidth, surfaceHeight);
      const innerSurface = acquireSurface(surfaceWidth, surfaceHeight);
      if (!maskSurface || !blurSurface || !innerSurface) {
        addDiagnostic(`skia_box_effect_surface_unavailable:${layer.key}`);
        if (maskSurface) releaseSurface(surfaceWidth, surfaceHeight, maskSurface);
        if (blurSurface) releaseSurface(surfaceWidth, surfaceHeight, blurSurface);
        if (innerSurface) releaseSurface(surfaceWidth, surfaceHeight, innerSurface);
        return;
      }
      const maskCanvas = maskSurface.getCanvas();
      maskCanvas.clear(kit.TRANSPARENT);
      if (deviceScale !== 1) maskCanvas.concat([deviceScale, 0, 0, 0, deviceScale, 0, 0, 0, 1]);
      const maskPaint = createSkiaPaint(kit, "#ffffff", 1, kit.PaintStyle.Fill, undefined, source.width, source.height, true);
      const radius = Math.max(0, Math.min(source.cornerRadius ?? 0, Math.min(source.width, source.height) / 2));
      if (radius > 0) maskCanvas.drawRRect(rRectArgs(pad, pad, pad + source.width, pad + source.height, radius), maskPaint);
      else maskCanvas.drawRect([pad, pad, pad + source.width, pad + source.height], maskPaint);
      maskPaint.delete();
      maskSurface.flush();
      const maskImage = maskSurface.makeImageSnapshot?.();
      if (!maskImage) {
        addDiagnostic(`skia_box_effect_mask_snapshot_unsupported:${layer.key}`);
        releaseSurface(surfaceWidth, surfaceHeight, maskSurface);
        releaseSurface(surfaceWidth, surfaceHeight, blurSurface);
        releaseSurface(surfaceWidth, surfaceHeight, innerSurface);
        return;
      }

      const sigma = cssShadowBlurRadiusToSkiaSigma(blurOp.radius);
      const blurFilter = kit.ImageFilter.MakeBlur(sigma, sigma, kit.TileMode.Decal, null);
      const blurCanvas = blurSurface.getCanvas();
      blurCanvas.clear(kit.TRANSPARENT);
      const blurPaint = new kit.Paint();
      blurPaint.setAntiAlias(true);
      blurPaint.setStyle(kit.PaintStyle.Fill);
      blurPaint.setAlphaf(1);
      blurPaint.setBlendMode(kit.BlendMode.SrcOver);
      blurPaint.setImageFilter?.(blurFilter);
      blurCanvas.drawImageRect(maskImage, [0, 0, surfaceWidth, surfaceHeight], [0, 0, localWidth, localHeight], blurPaint, false);
      blurPaint.delete();
      blurFilter?.delete();
      blurSurface.flush();
      const blurImage = blurSurface.makeImageSnapshot?.();
      if (!blurImage) {
        addDiagnostic(`skia_box_effect_blur_snapshot_unsupported:${layer.key}`);
        maskImage.delete();
        releaseSurface(surfaceWidth, surfaceHeight, maskSurface);
        releaseSurface(surfaceWidth, surfaceHeight, blurSurface);
        releaseSurface(surfaceWidth, surfaceHeight, innerSurface);
        return;
      }

      const innerCanvas = innerSurface.getCanvas();
      innerCanvas.clear(kit.TRANSPARENT);
      const sourcePaint = new kit.Paint();
      sourcePaint.setAntiAlias(true);
      sourcePaint.setStyle(kit.PaintStyle.Fill);
      sourcePaint.setAlphaf(1);
      sourcePaint.setBlendMode(kit.BlendMode.SrcOver);
      innerCanvas.drawImageRect(maskImage, [0, 0, surfaceWidth, surfaceHeight], [0, 0, localWidth, localHeight], sourcePaint, false);
      sourcePaint.setBlendMode(kit.BlendMode.DstOut);
      innerCanvas.drawImageRect(blurImage, [0, 0, surfaceWidth, surfaceHeight], [0, 0, localWidth, localHeight], sourcePaint, false);
      sourcePaint.delete();
      innerSurface.flush();
      const innerImage = innerSurface.makeImageSnapshot?.();
      if (!innerImage) {
        addDiagnostic(`skia_box_effect_inner_snapshot_unsupported:${layer.key}`);
        maskImage.delete();
        blurImage.delete();
        releaseSurface(surfaceWidth, surfaceHeight, maskSurface);
        releaseSurface(surfaceWidth, surfaceHeight, blurSurface);
        releaseSurface(surfaceWidth, surfaceHeight, innerSurface);
        return;
      }

      const [tintRed, tintGreen, tintBlue, tintAlpha] = cssColorToRgba(tintOp.color);
      const isWhiteTint = tintRed === 1 && tintGreen === 1 && tintBlue === 1 && tintAlpha * tintOp.opacity === 1;
      const tintedFilter = isWhiteTint
        ? null
        : kit.ColorFilter?.MakeBlend?.(
            tintEffectColor(kit, tintOp.color, tintOp.opacity),
            kit.BlendMode.SrcIn,
          );
      const tintImageFilter = tintedFilter ? kit.ImageFilter.MakeColorFilter?.(tintedFilter, null) : null;
      const paint = new kit.Paint();
      paint.setAntiAlias(true);
      paint.setStyle(kit.PaintStyle.Fill);
      paint.setAlphaf(1);
      paint.setBlendMode(kit.BlendMode.SrcOver);
      if (tintImageFilter) paint.setImageFilter?.(tintImageFilter);
      canvas.save();
      canvas.concat(matrix4ToSkia3x3(source.matrix4));
      canvas.drawImageRect(innerImage, [0, 0, surfaceWidth, surfaceHeight], [-pad, -pad, localWidth - pad, localHeight - pad], paint, false);
      canvas.restore();
      paint.delete();
      tintImageFilter?.delete();
      tintedFilter?.delete();
      innerImage.delete();
      maskImage.delete();
      blurImage.delete();
      releaseSurface(surfaceWidth, surfaceHeight, maskSurface);
      releaseSurface(surfaceWidth, surfaceHeight, blurSurface);
      releaseSurface(surfaceWidth, surfaceHeight, innerSurface);
      return;
    }
    const pad = effectFilterExpansionPadding(layer.boxEffectProgram);
    const localWidth = source.width + pad * 2;
    const localHeight = source.height + pad * 2;
    const surfaceWidth = Math.max(1, Math.ceil(localWidth * deviceScale));
    const surfaceHeight = Math.max(1, Math.ceil(localHeight * deviceScale));
    const maskSurface = acquireSurface(surfaceWidth, surfaceHeight);
    if (!maskSurface?.makeImageSnapshot) {
      addDiagnostic(`skia_box_effect_mask_surface_unsupported:${layer.key}`);
      if (maskSurface) releaseSurface(surfaceWidth, surfaceHeight, maskSurface);
      return;
    }
    const maskCanvas = maskSurface.getCanvas();
    maskCanvas.clear(kit.TRANSPARENT);
    if (deviceScale !== 1) maskCanvas.concat([deviceScale, 0, 0, 0, deviceScale, 0, 0, 0, 1]);
    const maskPaint = createSkiaPaint(kit, "#ffffff", 1, kit.PaintStyle.Fill, undefined, source.width, source.height, true);
    const radius = Math.max(0, Math.min(source.cornerRadius ?? 0, Math.min(source.width, source.height) / 2));
    if (source.cornerRadius && source.cornerRadius > 0) {
      maskCanvas.drawRRect(rRectArgs(pad, pad, pad + source.width, pad + source.height, radius), maskPaint);
    } else {
      maskCanvas.drawRect([pad, pad, pad + source.width, pad + source.height], maskPaint);
    }
    maskPaint.delete();
    maskSurface.flush();
    const snapshot = maskSurface.makeImageSnapshot();
    if (!snapshot) {
      addDiagnostic(`skia_box_effect_mask_snapshot_unsupported:${layer.key}`);
      releaseSurface(surfaceWidth, surfaceHeight, maskSurface);
      return;
    }
    // Keep the filtered overlay isolated from the owner's existing pixels.
    // The previous implementation installed a transformed SVG clipPath here.
    // That path was correct in local space but could clip three rounded
    // corners after PathBuilder transformed it into composition space. A
    // destination-in mask keeps the same owner geometry while avoiding a
    // second transformed path representation.
    const overlayLayerPaint = new kit.Paint();
    overlayLayerPaint.setAntiAlias(true);
    overlayLayerPaint.setStyle(kit.PaintStyle.Fill);
    overlayLayerPaint.setAlphaf(1);
    overlayLayerPaint.setBlendMode(kit.BlendMode.SrcOver);
    canvas.saveLayer(overlayLayerPaint, boundsToRect(compositionBounds(frameWidth, frameHeight)));
    overlayLayerPaint.delete();

    const paint = new kit.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(kit.PaintStyle.Fill);
    paint.setAlphaf(1);
    paint.setBlendMode(kit.BlendMode.SrcOver);
    paint.setImageFilter?.(filter ?? null);
    canvas.save();
    canvas.concat(matrix4ToSkia3x3(source.matrix4));
    canvas.drawImageRect(
      snapshot,
      [0, 0, surfaceWidth, surfaceHeight],
      [-pad, -pad, localWidth - pad, localHeight - pad],
      paint,
      false,
    );
    canvas.restore();
    paint.delete();

    // The runtime effect box is the owner's padding box when a border exists,
    // so this mask starts at the inner stroke edge like browser inset
    // box-shadow. Draw the mask as an RRect in the effect box's local space
    // and apply its transform through the canvas CTM, rather than transforming
    // an SVG path through PathBuilder. DstIn preserves the filtered alpha only
    // inside the owner.
    const ownerMaskPaint = new kit.Paint();
    ownerMaskPaint.setAntiAlias(true);
    ownerMaskPaint.setStyle(kit.PaintStyle.Fill);
    ownerMaskPaint.setAlphaf(1);
    ownerMaskPaint.setBlendMode(kit.BlendMode.DstIn);
    canvas.save();
    canvas.concat(matrix4ToSkia3x3(source.matrix4));
    if (radius > 0) {
      canvas.drawRRect(rRectArgs(0, 0, source.width, source.height, radius), ownerMaskPaint);
    } else {
      canvas.drawRect([0, 0, source.width, source.height], ownerMaskPaint);
    }
    canvas.restore();
    ownerMaskPaint.delete();
    canvas.restore();
    snapshot.delete();
    releaseSurface(surfaceWidth, surfaceHeight, maskSurface);
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

  for (let commandIndex = 0; commandIndex < buffer.commands.length; commandIndex += 1) {
    const command = buffer.commands[commandIndex]!;
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
      const effectFilter = effectFilterForCached(command.effectProgram);
      const backdropEffectFilter = effectFilterForCached(command.backdropEffectProgram);
       // CSS filter effects on a projective layer are handled by the explicit
       // screen-space surface path below. Keeping the filter off the parent
       // saveLayer prevents Skia from filtering an unprojected local frame.
      const projectiveFilter = projectiveFilterTransform && hasPerspectiveTerms(projectiveFilterTransform.matrix4)
        ? effectFilter.filter
        : undefined;
      const boxEffectActive = effectFilter.sourceOnly && !projectiveFilter;
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
        const layerFilter = projectiveFilter || effectFilter.sourceOnly ? null : effectFilter.filter;
        if (layerFilter && paint.setImageFilter) paint.setImageFilter(layerFilter);
        // Bound kinds (Phase 5):
        // - layer content bounds: union of drawable geometry inside the layer
        // - filter-expanded bounds: content + blur/shadow expansion
        // - composition bounds: full frame fallback / isolation without filter
        // Backdrop filters clip to content and pad saveLayer for sampling.
        // Foreground filters use filter-expanded bounds so shadows/blurs are
        // not cropped, without always allocating the full composition.
        const frameBounds = compositionBounds(frameWidth, frameHeight);
        const boxEffectActive = effectFilter.sourceOnly && !projectiveFilter;
        const boxEffectFilter = boxEffectActive ? effectFilter.filter : null;
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
        if (!resources && !projectiveFilter && !effectFilter.sourceOnly) effectFilter.filter?.delete();
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
      continue;
    }
    if (command.op === "endLayer") {
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
        drawBoxEffect(layer);
        if (!resources) layer.boxEffectFilter?.delete();
      }
      if (layer?.saved) {
        canvas.restore();
        // Pop the backdrop paint-containment clip pushed around saveLayer.
        if (layer.backdropClip) canvas.restore();
      }
      if (layer?.projectiveFilter && !resources) layer.projectiveFilter.delete();
      pendingTransform = null;
      stats.endLayerTimeMs += performance.now() - endLayerStartedAt;
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
      const commandAlpha = beginTransformedCommand(canvas, pendingTransform);
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
      const shapeStartedAt = performance.now();
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
      const commandAlpha = beginTransformedCommand(canvas, activeTransform);
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
      continue;
    }
    if (command.op === "drawPath") {
      const pathStartedAt = performance.now();
      const activeTransform = pendingTransform;
      const projective = activeTransform && projectionContext && hasPerspectiveTerms(activeTransform.matrix4);
      const projectiveFilterLayer = layers.at(-1);
      if (activeTransform && projectiveFilterLayer?.projectiveFilter && projectiveFilterLayer.projectiveFilterTransform?.key === activeTransform.key) {
        const commandAlpha = activeTransform.visible && activeTransform.alpha > 0 ? activeTransform.alpha : null;
        pendingTransform = null;
        if (commandAlpha === null) continue;
        const path = cachedPathFor(kit, command, resources?.pathCache ?? new Map());
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
        if (surface) releaseSurface(surfaceWidth, surfaceHeight, surface);
        if (projected) {
          stats.drawCalls++;
          continue;
        }
        addDiagnostic(`skia_projective_effect_fallback:${command.key}`);
      }
      const commandAlpha = beginTransformedCommand(canvas, activeTransform);
      pendingTransform = null;
      if (commandAlpha === null) continue;
      const path = cachedPathFor(kit, command, resources?.pathCache ?? new Map());
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
      canvas.restore();
      stats.pathTimeMs += performance.now() - pathStartedAt;
      stats.drawCalls++;
      continue;
    }
    if (command.op === "drawText") {
      const textStartedAt = performance.now();
      const commandAlpha = beginTransformedCommand(canvas, pendingTransform);
      pendingTransform = null;
      if (commandAlpha === null) continue;
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
      continue;
    }
    if (command.op === "drawImage" || command.op === "drawVideo") {
      const activeTransform = pendingTransform;
      const projective = activeTransform && projectionContext && hasPerspectiveTerms(activeTransform.matrix4)
        ? { matrix: activeTransform.matrix4, context: projectionContext }
        : undefined;
      const commandAlpha = beginTransformedCommand(canvas, activeTransform, !projective);
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
