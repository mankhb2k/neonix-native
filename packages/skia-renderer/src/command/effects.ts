import type { PaintCommand, RuntimeEffectOp } from "@motionvideo/motion-runtime";
import { cssColorToRgba } from "../color";
import type { SkiaCanvasKit, SkiaColorFilter, SkiaImageFilter } from "../canvas-kit";

export type EffectFilterResult = { filter: SkiaImageFilter | null; supported: boolean; sourceOnly?: boolean };
type ColorMatrix = number[];
type EffectProgram = Extract<PaintCommand, { op: "beginLayer" }>['effectProgram'];

function identityColorMatrix(): ColorMatrix {
  return [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
}

/** Compose two CanvasKit 4x5 color matrices; the right matrix runs first. */
function multiplyColorMatrices(left: ColorMatrix, right: ColorMatrix): ColorMatrix {
  const result = new Array<number>(20).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      for (let inner = 0; inner < 4; inner += 1) result[row * 5 + column] += left[row * 5 + inner]! * right[inner * 5 + column]!;
    }
    result[row * 5 + 4] = left[row * 5 + 4]!;
    for (let inner = 0; inner < 4; inner += 1) result[row * 5 + 4] += left[row * 5 + inner]! * right[inner * 5 + 4]!;
  }
  return result;
}

function colorAdjustMatrix(op: Extract<RuntimeEffectOp, { kind: "color-adjust" }>): ColorMatrix {
  const saturation = op.saturation;
  const lumR = 0.2126;
  const lumG = 0.7152;
  const lumB = 0.0722;
  let matrix = multiplyColorMatrices([
    lumR * (1 - saturation) + saturation, lumG * (1 - saturation), lumB * (1 - saturation), 0, 0,
    lumR * (1 - saturation), lumG * (1 - saturation) + saturation, lumB * (1 - saturation), 0, 0,
    lumR * (1 - saturation), lumG * (1 - saturation), lumB * (1 - saturation) + saturation, 0, 0,
    0, 0, 0, 1, 0,
  ], identityColorMatrix());
  const angle = op.hueRotate * Math.PI / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  matrix = multiplyColorMatrices([
    lumR + cosine * (1 - lumR) - sine * lumR, lumG * (1 - cosine) - sine * lumG, lumB * (1 - cosine) + sine * (1 - lumB), 0, 0,
    lumR * (1 - cosine) + sine * 0.143, lumG + cosine * (1 - lumG) + sine * 0.140, lumB * (1 - cosine) - sine * 0.283, 0, 0,
    lumR * (1 - cosine) - sine * (1 - lumR), lumG * (1 - cosine) + sine * lumG, lumB + cosine * (1 - lumB) + sine * lumB, 0, 0,
    0, 0, 0, 1, 0,
  ], matrix);
  const contrast = op.contrast;
  matrix = multiplyColorMatrices([
    // CanvasKit ColorFilter matrices operate on normalized color channels.
    contrast, 0, 0, 0, 0.5 * (1 - contrast),
    0, contrast, 0, 0, 0.5 * (1 - contrast),
    0, 0, contrast, 0, 0.5 * (1 - contrast),
    0, 0, 0, 1, 0,
  ], matrix);
  return multiplyColorMatrices([
    1, 0, 0, 0, op.brightness,
    0, 1, 0, 0, op.brightness,
    0, 0, 1, 0, op.brightness,
    0, 0, 0, 1, 0,
  ], matrix);
}

function alphaMatrix(op: Extract<RuntimeEffectOp, { kind: "alpha" }>): ColorMatrix {
  return [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, op.amount, 0];
}

function tintColor(kit: SkiaCanvasKit, color: string, opacity: number): unknown {
  const [red, green, blue, alpha] = cssColorToRgba(color);
  return kit.Color(red * 255, green * 255, blue * 255, Math.max(0, Math.min(1, alpha * opacity)));
}

/**
 * CSS blur() is specified with a standard-deviation-like radius, while
 * CanvasKit's image-filter API takes a Gaussian sigma. Browser-vs-Skia
 * pixel probes at 4px, 18px and 48px show that the CSS radius maps directly
 * to CanvasKit sigma; the old 0.57735 multiplier made every halo too narrow.
 */
export function cssBlurRadiusToSkiaSigma(radius: number): number {
  // CanvasKit treats a zero-sigma drop shadow as an empty filter. CSS still
  // paints a zero-blur alpha silhouette, so use the smallest stable Skia
  // kernel for that valid CSS case without changing ordinary blur profiles.
  return radius === 0 ? 0.5 : radius;
}

/**
 * CSS box-shadow uses a different blur construction from filter: blur().
 * Keep its calibrated sigma separate so inset/outer shadow profiles do not
 * change when the filter-blur contract is refined.
 */
export function cssShadowBlurRadiusToSkiaSigma(radius: number): number {
  return radius === 0 ? 0.5 : 0.5 * radius + 0.5;
}

/** CSS filter: drop-shadow() follows the filter-blur profile, not the
 * inset box-shadow profile. Keep this mapping explicit so shadow calibration
 * does not make outer glow halos progressively too narrow or too wide.
 */
export function cssOuterGlowRadiusToSkiaSigma(radius: number): number {
  return radius === 0 ? 0.5 : radius;
}

/**
 * Extra pixels a foreground image filter may paint outside the owner geometry.
 * Blur kernels and drop-shadow offsets both expand the filtered output; padding
 * is additive so a blurred offset shadow keeps room for both contributions.
 */
export function effectFilterExpansionPadding(program: EffectProgram): number {
  if (!program) return 0;
  let blurPad = 0;
  let offsetPad = 0;
  let morphologyPad = 0;
  const usesInsetAlpha = program.ops.some((op) => op.kind === "inner-alpha");
  for (const op of program.ops) {
    if (op.kind === "blur") {
      const sigma = usesInsetAlpha ? cssShadowBlurRadiusToSkiaSigma(op.radius) : cssBlurRadiusToSkiaSigma(op.radius);
      blurPad = Math.max(blurPad, Math.ceil(sigma * 3 + 1));
    } else if (op.kind === "offset") {
      offsetPad = Math.max(offsetPad, Math.ceil(Math.max(Math.abs(op.x), Math.abs(op.y))));
    } else if (op.kind === "morphology" && op.operator === "dilate") {
      // Erode only shrinks the silhouette, so it needs no extra padding.
      morphologyPad = Math.max(morphologyPad, Math.ceil(op.radius));
    }
  }
  return blurPad + offsetPad + morphologyPad;
}

function makeShadowFilter(
  kit: SkiaCanvasKit,
  offset: { x: number; y: number },
  blur: number,
  color: string,
  opacity: number,
  only: boolean,
  input: SkiaImageFilter | null = null,
  sigmaForRadius: (radius: number) => number = cssShadowBlurRadiusToSkiaSigma,
): SkiaImageFilter | null {
  const sigma = sigmaForRadius(blur);
  // CanvasKit drops a completely coincident zero-blur shadow. Keep the
  // fallback in this shared helper so every alpha-shadow path behaves alike.
  const x = blur === 0 && offset.x === 0 ? 0.5 : offset.x;
  const y = blur === 0 && offset.y === 0 ? 0.5 : offset.y;
  const tint = tintColor(kit, color, opacity);
  return only
    ? kit.ImageFilter.MakeDropShadowOnly?.(x, y, sigma, sigma, tint, input) ?? null
    : kit.ImageFilter.MakeDropShadow?.(x, y, sigma, sigma, tint, input) ?? null;
}

function makeCssBlurFilter(
  kit: SkiaCanvasKit,
  radius: number,
  input: SkiaImageFilter | null = null,
): SkiaImageFilter | null {
  const sigma = cssBlurRadiusToSkiaSigma(radius);
  return kit.ImageFilter.MakeBlur(sigma, sigma, kit.TileMode.Decal, input);
}

function makeOffsetFilter(
  kit: SkiaCanvasKit,
  offset: Extract<RuntimeEffectOp, { kind: "offset" }>,
): SkiaImageFilter | null {
  if (!kit.ImageFilter.MakeMatrixTransform) return null;
  // CSS inset shadows cast toward the opposite side of a positive offset:
  // `inset 18px 14px` produces the strongest inner glow on the left/top.
  // CanvasKit's image-filter transform is expressed in source-space, so the
  // positive matrix translation gives that CSS-facing direction.
  const matrix = [1, 0, offset.x, 0, 1, offset.y, 0, 0, 1];
  return kit.ImageFilter.MakeMatrixTransform(
    matrix,
    { filter: kit.FilterMode?.Linear ?? 1, mipmap: kit.MipmapMode?.None ?? 0 },
    null,
  );
}

/** CSS box-shadow spread: dilate the silhouette outward (positive) or erode it inward (negative). */
function makeMorphologyFilter(
  kit: SkiaCanvasKit,
  op: Extract<RuntimeEffectOp, { kind: "morphology" }>,
  input: SkiaImageFilter | null = null,
): SkiaImageFilter | null {
  if (op.radius === 0) return input;
  return op.operator === "dilate"
    ? kit.ImageFilter.MakeDilate?.(op.radius, op.radius, input) ?? null
    : kit.ImageFilter.MakeErode?.(op.radius, op.radius, input) ?? null;
}

function matchEffectGraph(program: NonNullable<EffectProgram>, kinds: string[]): boolean {
  return program.ops.length === kinds.length && program.ops.every((op, index) => op.kind === kinds[index]);
}

type LinearColorSpatialOp = Extract<RuntimeEffectOp, { kind: "blur" | "color-adjust" | "color-matrix" | "alpha" }>;

function isLinearColorSpatialOp(op: RuntimeEffectOp): op is LinearColorSpatialOp {
  return op.kind === "blur" || op.kind === "color-adjust" || op.kind === "color-matrix" || op.kind === "alpha";
}

/** Build a chained blur/color-adjust/color-matrix/alpha image filter. */
function buildLinearColorSpatialFilter(
  kit: SkiaCanvasKit,
  ops: readonly LinearColorSpatialOp[],
): SkiaImageFilter | null {
  let filter: SkiaImageFilter | null = null;
  for (const op of ops) {
    let next: SkiaImageFilter | null;
    if (op.kind === "blur") {
      next = makeCssBlurFilter(kit, op.radius, filter);
    } else if (kit.ColorFilter?.MakeMatrix && kit.ImageFilter.MakeColorFilter) {
      const matrix = op.kind === "color-adjust" ? colorAdjustMatrix(op) : op.kind === "color-matrix" ? op.matrix : alphaMatrix(op);
      const colorFilter = kit.ColorFilter.MakeMatrix(matrix);
      next = colorFilter ? kit.ImageFilter.MakeColorFilter(colorFilter, filter) : null;
      colorFilter?.delete();
    } else {
      next = null;
    }
    if (!next) {
      filter?.delete();
      return null;
    }
    filter?.delete();
    filter = next;
  }
  return filter;
}

function shadowBlocks(program: NonNullable<EffectProgram>): Array<{
  blur: Extract<RuntimeEffectOp, { kind: "blur" }>;
  tint: Extract<RuntimeEffectOp, { kind: "tint" }>;
  offset: Extract<RuntimeEffectOp, { kind: "offset" }>;
}> {
  const blocks = [] as Array<{
    blur: Extract<RuntimeEffectOp, { kind: "blur" }>;
    tint: Extract<RuntimeEffectOp, { kind: "tint" }>;
    offset: Extract<RuntimeEffectOp, { kind: "offset" }>;
  }>;
  for (let index = 0; index < program.ops.length; index += 5) {
    const alpha = program.ops[index];
    const blur = program.ops[index + 1];
    const tint = program.ops[index + 2];
    const offset = program.ops[index + 3];
    const composite = program.ops[index + 4];
    if (alpha?.kind !== "alpha-mask" || alpha.input !== "source" || blur?.kind !== "blur" || tint?.kind !== "tint" || offset?.kind !== "offset" || composite?.kind !== "composite") return [];
    blocks.push({ blur, tint, offset });
  }
  return blocks;
}

type BoxShadowBranch = {
  kind: "outer" | "inner";
  blur: Extract<RuntimeEffectOp, { kind: "blur" }>;
  tint: Extract<RuntimeEffectOp, { kind: "tint" }>;
  offset?: Extract<RuntimeEffectOp, { kind: "offset" }>;
};

/**
 * Parse the ordered box-shadow graphs emitted by Runtime V3. A single
 * ImageFilter pattern is not enough for lists containing inset and outer
 * shadows together: each branch must read the original box silhouette and
 * then be composited in CSS list order.
 */
function boxShadowBranches(program: NonNullable<EffectProgram>): BoxShadowBranch[] | null {
  const branches: BoxShadowBranch[] = [];
  let index = 0;
  while (index < program.ops.length) {
    const alpha = program.ops[index];
    if (alpha?.kind !== "alpha-mask" || alpha.input !== "source" || alpha.source !== "box") return null;

    const maybeOffset = program.ops[index + 1];
    const hasInnerOffset = maybeOffset?.kind === "offset";
    const blur = program.ops[index + (hasInnerOffset ? 2 : 1)];
    if (blur?.kind !== "blur") return null;

    const maybeInner = program.ops[index + (hasInnerOffset ? 3 : 2)];
    if (maybeInner?.kind === "inner-alpha") {
      const tint = program.ops[index + (hasInnerOffset ? 4 : 3)];
      const composite = program.ops[index + (hasInnerOffset ? 5 : 4)];
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
        ...(hasInnerOffset ? { offset: maybeOffset } : {}),
      });
      index += hasInnerOffset ? 6 : 5;
      continue;
    }

    const tint = maybeInner;
    const offset = program.ops[index + 3];
    const composite = program.ops[index + 4];
    if (
      tint?.kind !== "tint" ||
      offset?.kind !== "offset" ||
      composite?.kind !== "composite" ||
      composite.backdrop !== offset.output ||
      composite.mode !== "source-over"
    ) return null;
    branches.push({ kind: "outer", blur, tint, offset });
    index += 5;
  }
  return branches.length > 1 ? branches : null;
}

function makeInnerShadowFilter(
  kit: SkiaCanvasKit,
  branch: BoxShadowBranch,
): SkiaImageFilter | null {
  const makeBlend = kit.ImageFilter.MakeBlend;
  if (!makeBlend) return null;
  const offsetFilter = branch.offset ? makeOffsetFilter(kit, branch.offset) : null;
  const blurred = kit.ImageFilter.MakeBlur(
    cssShadowBlurRadiusToSkiaSigma(branch.blur.radius),
    cssShadowBlurRadiusToSkiaSigma(branch.blur.radius),
    kit.TileMode.Decal,
    offsetFilter,
  );
  const inside = blurred ? makeBlend(kit.BlendMode.DstOut, null, blurred) : null;
  const colorFilter = inside && kit.ColorFilter?.MakeBlend
    ? kit.ColorFilter.MakeBlend(tintColor(kit, branch.tint.color, branch.tint.opacity), kit.BlendMode.SrcIn)
    : null;
  const tinted = inside && colorFilter && kit.ImageFilter.MakeColorFilter
    ? kit.ImageFilter.MakeColorFilter(colorFilter, inside)
    : null;
  const filter = tinted ? makeBlend(kit.BlendMode.SrcOver, null, tinted) : null;
  colorFilter?.delete();
  offsetFilter?.delete();
  blurred?.delete();
  inside?.delete();
  tinted?.delete();
  return filter;
}

function makeMixedBoxShadowFilter(
  kit: SkiaCanvasKit,
  branches: readonly BoxShadowBranch[],
): SkiaImageFilter | null {
  const first = branches[0];
  if (!first) return null;
  // Multi-branch box shadows are rendered by replay's isolated-mask
  // compositor. Do not build a backend ImageFilter blend here: CanvasKit
  // versions differ in support for blending DropShadow filters, and a failed
  // activation filter would prevent the explicit compositor from running.
  return first.kind === "inner"
    ? makeInnerShadowFilter(kit, first)
    : makeShadowFilter(
        kit,
        first.offset ?? { x: 0, y: 0 },
        first.blur.radius,
        first.tint.color,
        first.tint.opacity,
        false,
      );
}

/**
 * Noise is applied to the rasterized layer by the Skia backend as a separate
 * CPU pass after readback (see `applyNoise` in backend.ts); it never
 * participates in the ImageFilter graph. Strip every noise op out of the
 * program before pattern-matching the rest, bypassing its input/output link
 * so a downstream op that read the noise op's surface now reads straight
 * through to what fed the noise op. This means noise's authored position
 * relative to other effects is not preserved (it is always effectively a
 * final full-layer pass) but the remaining effects are no longer dropped.
 */
function stripNoiseOps(program: NonNullable<EffectProgram>): NonNullable<EffectProgram> {
  const noiseOps = program.ops.filter((op): op is Extract<RuntimeEffectOp, { kind: "noise" }> => op.kind === "noise");
  if (noiseOps.length === 0) return program;
  const bypass = new Map(noiseOps.map((op) => [op.output, op.input]));
  const remap = (surface: string): string => bypass.get(surface) ?? surface;
  const ops = program.ops
    .filter((op) => op.kind !== "noise")
    .map((op) => {
      if (op.kind === "composite") return { ...op, backdrop: remap(op.backdrop), source: remap(op.source) };
      if (op.kind === "inner-alpha") return { ...op, source: remap(op.source), blurred: remap(op.blurred) };
      return { ...op, input: remap(op.input) };
    });
  return { ...program, ops, output: remap(program.output) };
}

export function effectFilterFor(kit: SkiaCanvasKit, fullProgram: EffectProgram): EffectFilterResult {
  if (!fullProgram) return { filter: null, supported: true };
  const program = stripNoiseOps(fullProgram);
  if (program.ops.length === 0) return { filter: null, supported: true };
  const ops = program.ops;
  const blur = ops.find((op) => op.kind === "blur");
  const alpha = ops.find((op) => op.kind === "alpha-mask");
  const tint = ops.find((op) => op.kind === "tint");
  const offset = ops.find((op) => op.kind === "offset");
  const morphology = ops.find((op) => op.kind === "morphology");
  const shadows = shadowBlocks(program);
  const mixedBoxBranches = boxShadowBranches(program);
  if (mixedBoxBranches) {
    const filter = makeMixedBoxShadowFilter(kit, mixedBoxBranches);
    // The replay compositor is the authoritative implementation for an
    // ordered box-shadow list. The backend filter is only an optional
    // activation token; CanvasKit builds may not expose a usable drop-shadow
    // filter even though the primitive mask/blur APIs are available.
    return { filter, supported: true, sourceOnly: true };
  }
  if (shadows.length > 1 && shadows.length * 5 === ops.length && kit.ImageFilter.MakeDropShadow && kit.ImageFilter.MakeDropShadowOnly && kit.ImageFilter.MakeBlend) {
    // CSS paints the first listed shadow above later shadows. Keep the first
    // branch source-bearing and place later shadow-only branches behind it;
    // every branch still receives the same original source.
    let filter: SkiaImageFilter | null = null;
    for (let index = 0; index < shadows.length; index += 1) {
      const shadow = shadows[index]!;
      const next = makeShadowFilter(kit, shadow.offset, shadow.blur.radius, shadow.tint.color, shadow.tint.opacity, index !== 0);
      if (!next) {
        filter?.delete();
        return { filter: null, supported: false };
      }
      if (!filter) {
        filter = next;
        continue;
      }
      // Keep the source-bearing branch in the foreground. CanvasKit's blend
      // filter evaluates both branches against the source image, and placing
      // the shadow-only branch in the background otherwise darkens the owner
      // when it is composited into a saveLayer.
      const blended = kit.ImageFilter.MakeBlend(kit.BlendMode.SrcOver, next, filter);
      filter.delete();
      next.delete();
      if (!blended) return { filter: null, supported: false };
      filter = blended;
    }
    return { filter, supported: Boolean(filter) };
  }
  // Box-shadow spread inserts one morphology op between the silhouette and
  // the blur. This only ever occurs for box shadows (alpha shadows force
  // spread to 0 in the schema), and only covers the single-shadow-with-offset
  // shape here; a spread combined with a comma-separated shadow list or an
  // inset shadow's own offset falls through to the existing block/branch
  // parsers below, which already fail closed (return null/[]) on an
  // unexpected "morphology" op instead of misreading the sequence.
  if (matchEffectGraph(program, ["alpha-mask", "morphology", "blur", "tint", "offset", "composite"]) && alpha?.kind === "alpha-mask" && alpha.source === "box" && morphology?.kind === "morphology" && blur?.kind === "blur" && tint?.kind === "tint" && offset?.kind === "offset" && kit.ImageFilter.MakeDropShadowOnly && kit.ImageFilter.MakeBlend && kit.ImageFilter.MakeDilate && kit.ImageFilter.MakeErode) {
    // MakeDropShadow with a non-null `input` both computes the shadow from
    // `input` AND redraws `input` as the foreground. Feeding it the
    // dilated/eroded silhouette directly would visibly enlarge or shrink the
    // box itself, not just its shadow (CSS spread only ever affects the
    // shadow). Use DropShadowOnly to keep just the halo, then blend it
    // behind the UNMODIFIED original content.
    const morphed = makeMorphologyFilter(kit, morphology);
    const shadowOnly = makeShadowFilter(kit, offset, blur.radius, tint.color, tint.opacity, true, morphed, cssShadowBlurRadiusToSkiaSigma);
    const filter = shadowOnly ? kit.ImageFilter.MakeBlend(kit.BlendMode.SrcOver, shadowOnly, null) : null;
    shadowOnly?.delete();
    morphed?.delete();
    return { filter, supported: Boolean(filter) };
  }
  if (matchEffectGraph(program, ["alpha-mask", "blur", "tint", "offset", "composite"]) && blur?.kind === "blur" && tint?.kind === "tint" && offset?.kind === "offset" && kit.ImageFilter.MakeDropShadow) {
    const filter = makeShadowFilter(
      kit,
      offset,
      blur.radius,
      tint.color,
      tint.opacity,
      false,
      null,
      alpha?.kind === "alpha-mask" && alpha.source === "alpha" ? cssOuterGlowRadiusToSkiaSigma : cssShadowBlurRadiusToSkiaSigma,
    );
    return { filter, supported: Boolean(filter) };
  }
  if (matchEffectGraph(program, ["alpha-mask", "blur", "tint", "composite"]) && blur?.kind === "blur" && tint?.kind === "tint" && kit.ImageFilter.MakeDropShadow) {
    const filter = makeShadowFilter(
      kit,
      { x: 0, y: 0 },
      blur.radius,
      tint.color,
      tint.opacity,
      false,
      null,
      alpha?.kind === "alpha-mask" && alpha.source === undefined ? cssOuterGlowRadiusToSkiaSigma : cssShadowBlurRadiusToSkiaSigma,
    );
    return { filter, supported: Boolean(filter) };
  }
  // CSS filter order: blur/color*(...) drop-shadow(...). Prefix operators
  // reshape the owner; the shadow then receives that filtered silhouette.
  if (ops.length >= 6 && kit.ImageFilter.MakeDropShadowOnly && kit.ImageFilter.MakeBlend) {
    const shadowStart = ops.length - 5;
    const prefixOps = ops.slice(0, shadowStart);
    const shadowAlpha = ops[shadowStart];
    const shadowBlur = ops[shadowStart + 1];
    const shadowTint = ops[shadowStart + 2];
    const shadowOffset = ops[shadowStart + 3];
    const shadowComposite = ops[shadowStart + 4];
    const prefixValid = prefixOps.length > 0
      && prefixOps.every(isLinearColorSpatialOp)
      && prefixOps.every((op, index) => op.input === (index === 0 ? "source" : prefixOps[index - 1]!.output));
    const prefixOutput = prefixOps.at(-1)?.output;
    if (
      prefixValid &&
      prefixOutput !== undefined &&
      shadowAlpha?.kind === "alpha-mask" && shadowAlpha.input === prefixOutput &&
      shadowBlur?.kind === "blur" && shadowBlur.input === shadowAlpha.output &&
      shadowTint?.kind === "tint" && shadowTint.input === shadowBlur.output &&
      shadowOffset?.kind === "offset" && shadowOffset.input === shadowTint.output &&
      shadowComposite?.kind === "composite" &&
      shadowComposite.backdrop === shadowOffset.output &&
      shadowComposite.source === prefixOutput &&
      shadowComposite.output === program.output &&
      shadowComposite.mode === "source-over"
    ) {
      const filteredSource = buildLinearColorSpatialFilter(kit, prefixOps as LinearColorSpatialOp[]);
      const shadowOnly = filteredSource
        ? makeShadowFilter(kit, shadowOffset, shadowBlur.radius, shadowTint.color, shadowTint.opacity, true, filteredSource)
        : null;
      // MakeDropShadowOnly supplies only the shadow branch. Blend the filtered
      // owner back above it so ordered CSS programs keep the source.
      const filter = shadowOnly && filteredSource
        ? kit.ImageFilter.MakeBlend(kit.BlendMode.SrcOver, shadowOnly, filteredSource)
        : null;
      shadowOnly?.delete();
      filteredSource?.delete();
      return { filter, supported: Boolean(filter) };
    }
  }
  if (matchEffectGraph(program, ["alpha-mask", "blur", "inner-alpha", "tint", "composite"]) && alpha?.kind === "alpha-mask" && alpha.source !== "box" && blur?.kind === "blur" && tint?.kind === "tint" && kit.ImageFilter.MakeBlend && kit.ImageFilter.MakeColorFilter && kit.ColorFilter?.MakeBlend) {
    const sigma = cssShadowBlurRadiusToSkiaSigma(blur.radius);
    const blurred = kit.ImageFilter.MakeBlur(sigma, sigma, kit.TileMode.Decal, null);
    const inside = blurred ? kit.ImageFilter.MakeBlend(kit.BlendMode.DstOut, null, blurred) : null;
    const colorFilter: SkiaColorFilter | null = inside ? kit.ColorFilter.MakeBlend(tintColor(kit, tint.color, tint.opacity), kit.BlendMode.SrcIn) : null;
    const tinted = inside && colorFilter ? kit.ImageFilter.MakeColorFilter(colorFilter, inside) : null;
    const filter = tinted ? kit.ImageFilter.MakeBlend(kit.BlendMode.SrcOver, null, tinted) : null;
    colorFilter?.delete();
    blurred?.delete();
    inside?.delete();
    tinted?.delete();
    return { filter, supported: Boolean(filter) };
  }
  if (matchEffectGraph(program, ["alpha-mask", "offset", "blur", "inner-alpha", "tint", "composite"]) && alpha?.kind === "alpha-mask" && alpha.source === "box" && blur?.kind === "blur" && tint?.kind === "tint" && offset?.kind === "offset" && kit.ImageFilter.MakeBlend && kit.ImageFilter.MakeColorFilter && kit.ColorFilter?.MakeBlend) {
    const shiftedAlpha = makeOffsetFilter(kit, offset);
    const sigma = cssShadowBlurRadiusToSkiaSigma(blur.radius);
    const blurred = shiftedAlpha ? kit.ImageFilter.MakeBlur(sigma, sigma, kit.TileMode.Decal, shiftedAlpha) : null;
    const inside = blurred ? kit.ImageFilter.MakeBlend(kit.BlendMode.DstOut, null, blurred) : null;
    const colorFilter: SkiaColorFilter | null = inside ? kit.ColorFilter.MakeBlend(tintColor(kit, tint.color, tint.opacity), kit.BlendMode.SrcIn) : null;
    const tinted = inside && colorFilter ? kit.ImageFilter.MakeColorFilter(colorFilter, inside) : null;
    const filter = tinted;
    colorFilter?.delete();
    shiftedAlpha?.delete();
    blurred?.delete();
    inside?.delete();
    return { filter, supported: Boolean(filter), sourceOnly: true };
  }
  if (matchEffectGraph(program, ["alpha-mask", "blur", "inner-alpha", "tint", "composite"]) && alpha?.kind === "alpha-mask" && alpha.source === "box" && blur?.kind === "blur" && tint?.kind === "tint" && kit.ImageFilter.MakeBlend && kit.ImageFilter.MakeColorFilter && kit.ColorFilter?.MakeBlend) {
    const sigma = cssShadowBlurRadiusToSkiaSigma(blur.radius);
    const blurred = kit.ImageFilter.MakeBlur(sigma, sigma, kit.TileMode.Decal, null);
    const inside = blurred ? kit.ImageFilter.MakeBlend(kit.BlendMode.DstOut, null, blurred) : null;
    const colorFilter: SkiaColorFilter | null = inside ? kit.ColorFilter.MakeBlend(tintColor(kit, tint.color, tint.opacity), kit.BlendMode.SrcIn) : null;
    const filter = inside && colorFilter ? kit.ImageFilter.MakeColorFilter(colorFilter, inside) : null;
    colorFilter?.delete();
    blurred?.delete();
    inside?.delete();
    return { filter, supported: Boolean(filter), sourceOnly: true };
  }
  if (ops.every(isLinearColorSpatialOp) && ops.every((op, index) => op.input === (index === 0 ? "source" : ops[index - 1]!.output)) && ops.at(-1)?.output === program.output) {
    const filter = buildLinearColorSpatialFilter(kit, ops);
    return { filter, supported: Boolean(filter) };
  }
  return { filter: null, supported: false };
}
