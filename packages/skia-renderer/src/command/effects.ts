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

function tintColor(kit: SkiaCanvasKit, color: string, opacity: number): unknown {
  const [red, green, blue, alpha] = cssColorToRgba(color);
  return kit.Color(red * 255, green * 255, blue * 255, Math.max(0, Math.min(1, alpha * opacity)));
}

function matchEffectGraph(program: NonNullable<EffectProgram>, kinds: string[]): boolean {
  return program.ops.length === kinds.length && program.ops.every((op, index) => op.kind === kinds[index]);
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
  if (matchEffectGraph(program, ["alpha-mask", "blur", "tint", "offset", "composite"]) && blur?.kind === "blur" && tint?.kind === "tint" && offset?.kind === "offset" && kit.ImageFilter.MakeDropShadow) {
    const filter = kit.ImageFilter.MakeDropShadow(offset.x, offset.y, blur.radius, blur.radius, tintColor(kit, tint.color, tint.opacity), null);
    return { filter, supported: Boolean(filter) };
  }
  if (matchEffectGraph(program, ["alpha-mask", "blur", "tint", "composite"]) && blur?.kind === "blur" && tint?.kind === "tint" && kit.ImageFilter.MakeDropShadow) {
    const filter = kit.ImageFilter.MakeDropShadow(0, 0, blur.radius, blur.radius, tintColor(kit, tint.color, tint.opacity), null);
    return { filter, supported: Boolean(filter) };
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
  if (ops.every((op) => op.kind === "blur" || op.kind === "color-adjust") && ops.every((op, index) => op.input === (index === 0 ? "source" : ops[index - 1]!.output)) && ops.at(-1)?.output === program.output) {
    let filter: SkiaImageFilter | null = null;
    for (const op of ops) {
      let next: SkiaImageFilter | null;
      if (op.kind === "blur") {
        next = kit.ImageFilter.MakeBlur(op.radius, op.radius, kit.TileMode.Decal, filter);
      } else if (kit.ColorFilter?.MakeMatrix && kit.ImageFilter.MakeColorFilter) {
        const colorFilter = kit.ColorFilter.MakeMatrix(colorAdjustMatrix(op));
        next = colorFilter ? kit.ImageFilter.MakeColorFilter(colorFilter, filter) : null;
        colorFilter?.delete();
      } else {
        next = null;
      }
      if (!next) {
        filter?.delete();
        return { filter: null, supported: false };
      }
      filter?.delete();
      filter = next;
    }
    return { filter, supported: Boolean(filter) };
  }
  return { filter: null, supported: false };
}
