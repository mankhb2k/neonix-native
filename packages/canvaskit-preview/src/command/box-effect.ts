import { hasPerspectiveTerms, type PaintCommand, type RuntimeEffectOp } from "@motionvideo/motion-runtime";
import { cssColorToRgba } from "../color";
import type { SkiaCanvasKit, SkiaImage } from "../canvas-kit";
import { createSkiaPaint } from "../paint";
import { boundsToRect, compositionBounds, matrix4ToSkia3x3, rRectArgs } from "./geometry";
import { cssShadowBlurRadiusToSkiaSigma, effectFilterExpansionPadding } from "./effects";
import type { ReplayLayer } from "./types";
import type { ReplayContext } from "./replay-context";

function tintEffectColor(kit: SkiaCanvasKit, color: string, opacity: number): unknown {
  const [red, green, blue, alpha] = cssColorToRgba(color);
  return kit.Color(red * 255, green * 255, blue * 255, Math.max(0, Math.min(1, alpha * opacity)));
}

type BoxShadowOverlayBranch = {
  kind: "outer" | "inner";
  blur: Extract<RuntimeEffectOp, { kind: "blur" }>;
  tint: Extract<RuntimeEffectOp, { kind: "tint" }>;
  offset?: Extract<RuntimeEffectOp, { kind: "offset" }>;
  /** CSS box-shadow spread on an outer (non-inset) branch only - see the identical field on effects.ts's BoxShadowBranch. */
  spread?: Extract<RuntimeEffectOp, { kind: "morphology" }>;
};

/**
 * Stops (rather than failing the whole parse) at the first op that doesn't
 * start/continue a shadow block, instead of requiring the ENTIRE program to
 * be shadow branches. `box-shadow: ...; filter: blur(...);` lowers to
 * [shadow branches][trailing filter ops] - effectFilterFor already
 * recognizes that combined shape (see splitLeadingBoxShadowThenFilter) and
 * installs the trailing filter on the layer's saveLayer paint separately;
 * this function only needs the leading shadow branches to draw their halos,
 * so a trailing op it doesn't recognize is expected, not an error.
 */

export function boxShadowOverlayBranches(
  program: Extract<PaintCommand, { op: "beginLayer" }>['effectProgram'],
): BoxShadowOverlayBranch[] | null {
  if (!program) return null;
  const branches: BoxShadowOverlayBranch[] = [];
  let index = 0;
  while (index < program.ops.length) {
    const alpha = program.ops[index];
    if (alpha?.kind !== "alpha-mask" || alpha.input !== "source" || alpha.source !== "box") break;

    // Mirrors the identical leading-spread shape effectFilterFor's
    // splitLeadingBoxShadowThenFilter recognizes (see its comment) - outer
    // (non-inset) only.
    const maybeSpread = program.ops[index + 1];
    if (maybeSpread?.kind === "morphology") {
      const spreadBlur = program.ops[index + 2];
      const spreadTint = program.ops[index + 3];
      const spreadOffset = program.ops[index + 4];
      const spreadComposite = program.ops[index + 5];
      if (
        spreadBlur?.kind !== "blur" ||
        spreadTint?.kind !== "tint" ||
        spreadOffset?.kind !== "offset" ||
        spreadComposite?.kind !== "composite" ||
        spreadComposite.mode !== "source-over"
      ) break;
      branches.push({ kind: "outer", blur: spreadBlur, tint: spreadTint, offset: spreadOffset, spread: maybeSpread });
      index += 6;
      continue;
    }

    const maybeOffset = program.ops[index + 1];
    const hasOffset = maybeOffset?.kind === "offset";
    const blur = program.ops[index + (hasOffset ? 2 : 1)];
    if (blur?.kind !== "blur") break;

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
      ) break;
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
    ) break;
    branches.push({ kind: "outer", blur, tint, offset });
    index += 5;
  }
  return branches.length > 0 ? branches : null;
}

// CSS box-shadow spread is a geometry change, not an image filter: a real
// browser grows the shadow rect (and its corner radius) before the single
// blur-fill pass (Blink's ApplySpreadToShadowShape/OutsetWithCornerCorrection
// in box_painter_base.cc). Rasterizing the owner-size mask first and then
// running a per-pixel dilate/erode filter on it - this file's previous
// approach - is dramatically more expensive at large radii (measured
// ~18s for a single MakeDilate(80) frame under software rendering, and it
// can crash the tab outright once combined with a large blur) and isn't
// how any real box-shadow spread has ever actually rendered.
//
// The corner radius does NOT simply grow by `spread` - pixel-diffing
// against real Chrome disproved that (a cornerRadius:0 rect stayed sharp
// at every spread up to 200px, and small radii grew far less than
// radius+spread would predict). Ported verbatim from Blink's real
// formula (ComputeOutsetAdjustedBorderRadius /
// FloatRoundedRect::Radii::OutsetWithCornerCorrection in
// float_rounded_rect.cc): a zero radius is never rounded by spread at
// all, and a radius smaller than spread grows by a cubic ease-in instead
// of a straight sum - only once radius exceeds spread (or the box is
// "mostly round" already, `coverage > 1`) does it become a plain sum.
const computeOutsetAdjustedRadius = (radius: number, outset: number, coverage: number): number => {
  if (radius > outset || coverage > 1) return radius + outset;
  const ratio = radius / outset;
  return radius + outset * (1 - (1 - ratio) ** 3 * (1 - coverage ** 3));
};
const outsetSilhouette = (width: number, height: number, cornerRadius: number, spread: number) => {
  const outWidth = Math.max(0, width + spread * 2);
  const outHeight = Math.max(0, height + spread * 2);
  if (cornerRadius === 0 || spread === 0) {
    return { width: outWidth, height: outHeight, cornerRadius };
  }
  // Coverage and the adjusted radius are measured against the ORIGINAL
  // (pre-outset) box size, matching Blink's `edge`/`box_size` argument.
  const coverage = 2 * Math.min(cornerRadius / width, cornerRadius / height);
  const adjusted = computeOutsetAdjustedRadius(cornerRadius, spread, coverage);
  const outRadius = Math.max(0, Math.min(adjusted, Math.min(outWidth, outHeight) / 2));
  return { width: outWidth, height: outHeight, cornerRadius: outRadius };
};

// Blink's ShadowData::BlurRadiusToStdDev: "Per spec, sigma is exactly half
// the blur radius" (css-backgrounds-3 #shadow-blur). Only valid for the
// mask-filter path below - the offscreen fallback keeps its own calibrated
// cssShadowBlurRadiusToSkiaSigma, tuned against its image-filter blur.
const blinkShadowSigma = (blurRadius: number): number => Math.max(0, blurRadius) * 0.5;

/**
 * Paints box-shadow branches exactly the way Blink does
 * (BoxPainterBase::PaintNormalBoxShadow / PaintInsetBoxShadow in
 * box_painter_base.cc): straight onto the destination canvas with a
 * blurred-shadow draw looper - cc::DrawLooper installs
 * SkMaskFilter::MakeBlur(kNormal, sigma, respectCTM) plus a SrcIn color -
 * and a clip, with no offscreen surface at all.
 *   outer: clip OUT the owner's box, fill the spread-outset rrect shifted by
 *          the shadow offset.
 *   inset: clip TO the owner's box, fill a rect-with-rrect-hole (the owner
 *          shape) shifted by the shadow offset, so the hole's blurred edge
 *          is what shows inside.
 * Skia draws a blurred rrect analytically on the GPU, so this costs ~2ms
 * for a 520px/200px-blur/80px-spread glow orb that the offscreen fallback
 * below needed ~600ms for (four CPU raster surfaces blurred on the CPU and
 * re-uploaded as textures every frame - measured with CanvasKit on a real
 * GPU, see debt-technical.md).
 */
function drawBoxShadowBranchesDirect(
  ctx: ReplayContext,
  source: NonNullable<ReplayLayer["boxEffectSource"]>,
  branches: readonly BoxShadowOverlayBranch[],
): void {
  const { kit, canvas } = ctx;
  const maskFilter = kit.MaskFilter!;
  const blurStyle = kit.BlurStyle!.Normal;
  const radius = Math.max(0, Math.min(source.cornerRadius ?? 0, Math.min(source.width, source.height) / 2));
  const ownerRRect = rRectArgs(0, 0, source.width, source.height, radius);
  // CSS paints the first listed shadow on top; Blink iterates the list
  // back to front for the same reason.
  for (let index = branches.length - 1; index >= 0; index -= 1) {
    const branch = branches[index]!;
    const [red, green, blue, alpha] = cssColorToRgba(branch.tint.color);
    const shadowAlpha = Math.max(0, Math.min(1, alpha * branch.tint.opacity));
    if (shadowAlpha <= 0) continue;
    const offsetX = branch.offset?.x ?? 0;
    const offsetY = branch.offset?.y ?? 0;
    const sigma = blinkShadowSigma(branch.blur.radius);
    const blur = sigma > 0 ? maskFilter.MakeBlur(blurStyle, sigma, true) : null;
    const paint = new kit.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(kit.PaintStyle.Fill);
    paint.setColor(kit.Color(red * 255, green * 255, blue * 255, shadowAlpha));
    if (blur) paint.setMaskFilter?.(blur);
    canvas.save();
    canvas.concat(matrix4ToSkia3x3(source.matrix4));
    if (branch.kind === "outer") {
      const spread = branch.spread
        ? (branch.spread.operator === "dilate" ? branch.spread.radius : -branch.spread.radius)
        : 0;
      const outset = outsetSilhouette(source.width, source.height, radius, spread);
      if (outset.width > 0 && outset.height > 0) {
        canvas.clipRRect!(ownerRRect, kit.ClipOp.Difference, true);
        const left = offsetX - spread;
        const top = offsetY - spread;
        canvas.drawRRect(rRectArgs(left, top, left + outset.width, top + outset.height, outset.cornerRadius), paint);
      }
    } else {
      canvas.clipRRect!(ownerRRect, kit.ClipOp.Intersect, true);
      // Blink's AreaCastingShadowInHole: the hole outset by the blur
      // radius, unioned with itself shifted back by the offset, so that
      // after the looper's offset the filled area still covers the clip.
      const outsetBy = Math.max(0, branch.blur.radius);
      const outer = [
        Math.min(-outsetBy, -outsetBy - offsetX),
        Math.min(-outsetBy, -outsetBy - offsetY),
        Math.max(source.width + outsetBy, source.width + outsetBy - offsetX),
        Math.max(source.height + outsetBy, source.height + outsetBy - offsetY),
      ] as const;
      canvas.concat([1, 0, offsetX, 0, 1, offsetY, 0, 0, 1]);
      canvas.drawDRRect!(rRectArgs(outer[0], outer[1], outer[2], outer[3], 0), ownerRRect, paint);
    }
    canvas.restore();
    paint.delete();
    blur?.delete();
  }
}

/** Draws a layer's box-shadow halo(s) from its synthetic effect box - see beginLayer/endLayer for when it runs. */
export function drawBoxEffect(ctx: ReplayContext, layer: ReplayLayer): void {
  const { kit, canvas, deviceScale, frameWidth, frameHeight, addDiagnostic, acquireSurface, releaseSurface } = ctx;
  const filter = layer.boxEffectFilter;
  const source = layer.boxEffectSource;
  const program = layer.boxEffectProgram;
  const boxBranches = boxShadowOverlayBranches(program);
  if ((!filter && !boxBranches) || !source) {
    if (filter && !source) addDiagnostic(`skia_box_effect_source_missing:${layer.key}`);
    return;
  }
  // A perspective effect box would need the mask filter to blur in a
  // projected space Skia's blur mask filter does not model; keep those on
  // the offscreen path, as well as any CanvasKit build/test double lacking
  // the mask-filter or rrect clip/DRRect entry points.
  if (
    boxBranches &&
    kit.MaskFilter && kit.BlurStyle && kit.ClipOp.Difference !== undefined &&
    canvas.clipRRect && canvas.drawDRRect &&
    !hasPerspectiveTerms(source.matrix4)
  ) {
    drawBoxShadowBranchesDirect(ctx, source, boxBranches);
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

        // CSS spread grows (or, negative, shrinks) the silhouette's rect and
        // corner radius before it is blurred - only ever set on an "outer"
        // branch (see BoxShadowOverlayBranch). Rasterize that expanded
        // shape into its own image up front; the *unexpanded* maskImage is
        // still used below for the owner-silhouette DstOut subtraction,
        // since spread never affects the owner's own rendered coverage.
        let spreadSurface: ReturnType<typeof kit.MakeSurface> | null = null;
        let spreadImage: SkiaImage | null = null;
        if (branch.spread) {
          const spreadAmount = branch.spread.operator === "dilate" ? branch.spread.radius : -branch.spread.radius;
          const outset = outsetSilhouette(source.width, source.height, radius, spreadAmount);
          spreadSurface = kit.MakeSurface(surfaceWidth, surfaceHeight);
          if (spreadSurface?.makeImageSnapshot) {
            const spreadCanvas = spreadSurface.getCanvas();
            spreadCanvas.clear(kit.TRANSPARENT);
            if (deviceScale !== 1) spreadCanvas.concat([deviceScale, 0, 0, 0, deviceScale, 0, 0, 0, 1]);
            const spreadPaint = createSkiaPaint(kit, "#ffffff", 1, kit.PaintStyle.Fill, undefined, outset.width, outset.height, true);
            const left = pad - spreadAmount;
            const top = pad - spreadAmount;
            if (outset.cornerRadius > 0) spreadCanvas.drawRRect(rRectArgs(left, top, left + outset.width, top + outset.height, outset.cornerRadius), spreadPaint);
            else spreadCanvas.drawRect([left, top, left + outset.width, top + outset.height], spreadPaint);
            spreadPaint.delete();
            spreadSurface.flush();
            spreadImage = spreadSurface.makeImageSnapshot();
          }
        }
        const shadowSourceImage = spreadImage ?? maskImage;
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
        blurCanvas.drawImageRect(shadowSourceImage, [0, 0, surfaceWidth, surfaceHeight], [0, 0, localWidth, localHeight], blurPaint, false);
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
            branchCanvas.drawImageRect(shadowSourceImage, [0, 0, surfaceWidth, surfaceHeight], [0, 0, localWidth, localHeight], branchPaint, false);
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
        spreadImage?.delete();
        spreadSurface?.dispose();
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
}
