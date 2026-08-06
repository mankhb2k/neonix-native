/**
 * Shared pixel-diff helpers for parity harness (capability thresholds).
 */

export type PixelDiffResult = {
  width: number;
  height: number;
  mismatchedPixels: number;
  maxChannelDelta: number;
  meanAbsoluteError: number;
  pass: boolean;
};

export type PixelDiffOptions = {
  /** Max allowed mean absolute error per channel (0–255). */
  maeThreshold?: number;
  /** Max fraction of mismatched pixels (0–1). */
  mismatchFraction?: number;
  /** Per-channel delta that counts as a mismatch. */
  mismatchDelta?: number;
};

/**
 * Compare two RGBA buffers (same length). Used by CI harness after canvas/still capture.
 */
export function diffRgbaBuffers(
  a: Uint8ClampedArray | Buffer,
  b: Uint8ClampedArray | Buffer,
  width: number,
  height: number,
  options: PixelDiffOptions = {},
): PixelDiffResult {
  const maeThreshold = options.maeThreshold ?? 8;
  const mismatchFraction = options.mismatchFraction ?? 0.02;
  const mismatchDelta = options.mismatchDelta ?? 16;
  const len = Math.min(a.length, b.length);
  let absSum = 0;
  let mismatchedPixels = 0;
  let maxChannelDelta = 0;
  const pixelCount = width * height;

  for (let i = 0; i + 3 < len; i += 4) {
    let pixelMismatch = false;
    for (let c = 0; c < 3; c += 1) {
      const d = Math.abs(a[i + c]! - b[i + c]!);
      absSum += d;
      if (d > maxChannelDelta) maxChannelDelta = d;
      if (d > mismatchDelta) pixelMismatch = true;
    }
    if (pixelMismatch) mismatchedPixels += 1;
  }

  const meanAbsoluteError = pixelCount > 0 ? absSum / (pixelCount * 3) : 0;
  const pass =
    meanAbsoluteError <= maeThreshold &&
    mismatchedPixels / Math.max(1, pixelCount) <= mismatchFraction;

  return {
    width,
    height,
    mismatchedPixels,
    maxChannelDelta,
    meanAbsoluteError,
    pass,
  };
}
