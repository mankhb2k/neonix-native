import type { PaintCommand, RuntimeEffectOp } from "@motionvideo/motion-runtime";
import { cssColorToRgba } from "../color";
import type { SkiaCanvasKit, SkiaColorFilter, SkiaImageFilter } from "../canvas-kit";

export type EffectFilterResult = { filter: SkiaImageFilter | null; supported: boolean };
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
 * CSS shadow blur is a blur radius, while CanvasKit's image-filter API takes
 * a Gaussian sigma. Use one calibrated CSS-to-Skia conversion for text-shadow,
 * alpha drop-shadow and filter blur so spatial effects do not acquire
 * different visual profiles.
 */
export function cssBlurRadiusToSkiaSigma(radius: number): number {
  // CanvasKit treats a zero-sigma drop shadow as an empty filter. CSS still
  // paints a zero-blur alpha silhouette, so use the smallest stable Skia
  // kernel for that valid CSS case without changing ordinary blur profiles.
  return radius === 0 ? 0.5 : 0.57735 * radius + 0.5;
}

function makeShadowFilter(
  kit: SkiaCanvasKit,
  offset: { x: number; y: number },
  blur: number,
  color: string,
  opacity: number,
  only: boolean,
  input: SkiaImageFilter | null = null,
): SkiaImageFilter | null {
  const sigma = cssBlurRadiusToSkiaSigma(blur);
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

export function effectFilterFor(kit: SkiaCanvasKit, program: EffectProgram): EffectFilterResult {
  if (!program) return { filter: null, supported: true };
  const ops = program.ops;
  // Noise is applied to the rasterized layer by the Skia backend after
  // readback; recognizing it here keeps it from being reported as unsupported.
  if (ops.length === 1 && ops[0]?.kind === "noise") return { filter: null, supported: true };
  const blur = ops[1];
  const tint = ops.find((op) => op.kind === "tint");
  const offset = ops.find((op) => op.kind === "offset");
  const shadows = shadowBlocks(program);
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
  if (matchEffectGraph(program, ["alpha-mask", "blur", "tint", "offset", "composite"]) && blur?.kind === "blur" && tint?.kind === "tint" && offset?.kind === "offset" && kit.ImageFilter.MakeDropShadow) {
    const filter = makeShadowFilter(kit, offset, blur.radius, tint.color, tint.opacity, false);
    return { filter, supported: Boolean(filter) };
  }
  if (matchEffectGraph(program, ["alpha-mask", "blur", "tint", "composite"]) && blur?.kind === "blur" && tint?.kind === "tint" && kit.ImageFilter.MakeDropShadow) {
    const filter = makeShadowFilter(kit, { x: 0, y: 0 }, blur.radius, tint.color, tint.opacity, false);
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
  if (matchEffectGraph(program, ["alpha-mask", "blur", "inner-alpha", "tint", "composite"]) && blur?.kind === "blur" && tint?.kind === "tint" && kit.ImageFilter.MakeBlend && kit.ImageFilter.MakeColorFilter && kit.ColorFilter?.MakeBlend) {
    const blurred = kit.ImageFilter.MakeBlur(blur.radius, blur.radius, kit.TileMode.Decal, null);
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
  if (ops.every(isLinearColorSpatialOp) && ops.every((op, index) => op.input === (index === 0 ? "source" : ops[index - 1]!.output)) && ops.at(-1)?.output === program.output) {
    const filter = buildLinearColorSpatialFilter(kit, ops);
    return { filter, supported: Boolean(filter) };
  }
  return { filter: null, supported: false };
}
